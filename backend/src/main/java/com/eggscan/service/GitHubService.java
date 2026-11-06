package com.eggscan.service;

import com.eggscan.exception.ApiException;
import com.eggscan.model.GitHubCommitResponse;
import com.eggscan.model.GitHubContentResponse;
import com.eggscan.model.GitHubProfile;
import com.eggscan.model.GitHubRepo;
import com.eggscan.model.GitHubTreeResponse;
import com.eggscan.model.ScanResult;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class GitHubService {

    private static final int MAX_USER_COMMITS = 30;

    private final WebClient client;

    public GitHubService(@Qualifier("githubClient") WebClient githubClient) {
        this.client = githubClient;
    }

    /**
     * Translates GitHub failures into client-safe errors. Previously every profile failure
     * (rate limits, outages, bad tokens) was reported as "User not found", and repo-list
     * failures were silently replaced with an empty list, producing a wrong low score.
     */
    static RuntimeException toApiException(Throwable error, String notFoundCode, String notFoundMessage) {
        if (error instanceof ApiException api) return api;
        if (error instanceof WebClientResponseException response) {
            int status = response.getStatusCode().value();
            String remaining = response.getHeaders().getFirst("x-ratelimit-remaining");
            if (status == 404 || status == 409) {
                return new ApiException(HttpStatus.NOT_FOUND, notFoundCode, notFoundMessage);
            }
            if (status == 429 || (status == 403 && "0".equals(remaining))) {
                return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "GitHub rate limit reached. Please try again later.");
            }
        }
        return new ApiException(HttpStatus.BAD_GATEWAY, "UPSTREAM_ERROR", "GitHub is temporarily unavailable. Please try again shortly.");
    }

    private static boolean isMissing(Throwable error) {
        return error instanceof WebClientResponseException response
                && (response.getStatusCode().value() == 404 || response.getStatusCode().value() == 409);
    }

    public ScanResult scanUser(String username) {
        var tuple = Mono.zip(fetchProfileMono(username), fetchReposMono(username)).block();
        if (tuple == null) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "UPSTREAM_ERROR", "Failed to fetch data for user: " + username);
        }

        GitHubProfile profile = tuple.getT1();
        List<GitHubRepo> repos = tuple.getT2();

        // Filter out forks for skill analysis
        List<GitHubRepo> ownRepos = repos.stream()
                .filter(r -> !Boolean.TRUE.equals(r.getFork()))
                .toList();

        Map<String, Integer> langs = ownRepos.stream()
                .filter(r -> r.getLanguage() != null)
                .collect(Collectors.groupingBy(
                        GitHubRepo::getLanguage,
                        Collectors.summingInt(r -> 1)
                ));

        int totalStars = ownRepos.stream()
                .mapToInt(r -> Optional.ofNullable(r.getStargazers_count()).orElse(0))
                .sum();

        int activeRepos = (int) ownRepos.stream()
                .filter(this::isActive)
                .count();

        String lastActivity = ownRepos.stream()
                .map(GitHubRepo::getPushed_at)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse("never");

        return ScanResult.builder()
                .profile(profile)
                .repos(ownRepos)
                .languageBreakdown(langs)
                .totalStars(totalStars)
                .activeRepos(activeRepos)
                .reposWithReadme(0) // filled in by ScanService from the README sample
                .lastActivity(lastActivity)
                .build();
    }

    private boolean isActive(GitHubRepo repo) {
        if (repo.getPushed_at() == null) return false;
        try {
            return Instant.parse(repo.getPushed_at()).isAfter(Instant.now().minus(180, ChronoUnit.DAYS));
        } catch (DateTimeParseException e) {
            return false;
        }
    }

    private Mono<GitHubProfile> fetchProfileMono(String username) {
        return client.get()
                .uri("/users/{u}", username)
                .retrieve()
                .bodyToMono(GitHubProfile.class)
                .onErrorMap(e -> toApiException(e, "GITHUB_USER_NOT_FOUND", "User not found: " + username));
    }

    private Mono<List<GitHubRepo>> fetchReposMono(String username) {
        return client.get()
                .uri("/users/{u}/repos?per_page=100&sort=updated", username)
                .retrieve()
                .bodyToMono(GitHubRepo[].class)
                .map(repos -> repos == null ? List.<GitHubRepo>of() : Arrays.asList(repos))
                .defaultIfEmpty(List.of())
                .onErrorMap(e -> toApiException(e, "GITHUB_USER_NOT_FOUND", "User not found: " + username));
    }

    /** Resolves a repository's real default branch; also proves the repository exists. */
    public String fetchDefaultBranch(String username, String repoName) {
        JsonNode repo = client.get()
                .uri("/repos/{u}/{r}", username, repoName)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .onErrorMap(e -> toApiException(e, "REPOSITORY_NOT_FOUND", "Repository was not found."))
                .block();
        String branch = repo == null ? "" : repo.path("default_branch").asText("");
        if (branch.isBlank()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "REPOSITORY_NOT_FOUND", "Repository was not found.");
        }
        return branch;
    }

    /** Returns null for a missing branch or an empty repository; other failures propagate. */
    public GitHubTreeResponse fetchRepoTree(String username, String repoName, String branch) {
        return fetchRepoTreeMono(username, repoName, branch).block();
    }

    public Mono<GitHubTreeResponse> fetchRepoTreeMono(String username, String repoName, String branch) {
        return client.get()
                .uri("/repos/{u}/{r}/git/trees/{b}?recursive=1", username, repoName, branch)
                .retrieve()
                .bodyToMono(GitHubTreeResponse.class)
                .onErrorResume(GitHubService::isMissing, e -> Mono.empty())
                .onErrorMap(e -> toApiException(e, "REPOSITORY_NOT_FOUND", "Repository or branch was not found."));
    }

    public Mono<String> fetchFileContentMono(String username, String repoName, String path) {
        return client.get()
                .uri("/repos/{u}/{r}/contents/{p}", username, repoName, path)
                .retrieve()
                .bodyToMono(GitHubContentResponse.class)
                .map(contentRes -> {
                    if (contentRes != null && contentRes.getContent() != null && "base64".equals(contentRes.getEncoding())) {
                        try {
                            return new String(Base64.getMimeDecoder().decode(contentRes.getContent()), StandardCharsets.UTF_8);
                        } catch (Exception e) {
                            return "";
                        }
                    }
                    return "";
                })
                .defaultIfEmpty("")
                .onErrorResume(e -> Mono.just(""));
    }

    public String fetchFileContent(String username, String repoName, String path) {
        String content = fetchFileContentMono(username, repoName, path).block();
        return content == null || content.isEmpty() ? null : content;
    }

    public List<GitHubCommitResponse> fetchRecentCommits(String username, String repoName) {
        return fetchRecentCommits(username, repoName, null);
    }

    public List<GitHubCommitResponse> fetchRecentCommits(String username, String repoName, String author) {
        WebClient.RequestHeadersSpec<?> request = author == null
                ? client.get().uri("/repos/{u}/{r}/commits?per_page=20", username, repoName)
                : client.get().uri("/repos/{u}/{r}/commits?per_page=20&author={a}", username, repoName, author);
        GitHubCommitResponse[] commits = request
                .retrieve()
                .bodyToMono(GitHubCommitResponse[].class)
                .onErrorResume(e -> Mono.just(new GitHubCommitResponse[0]))
                .block();
        return commits == null ? List.of() : Arrays.asList(commits);
    }

    /**
     * The user's own recent commit messages. GitHub's Events API stopped including commit
     * messages in PushEvent payloads (October 2025), so they are read from the user's most
     * recently pushed non-fork repositories instead.
     */
    public List<String> fetchUserCommitMessages(String username) {
        List<GitHubRepo> repos = fetchReposMono(username).block();
        if (repos == null) return List.of();
        List<String> messages = new ArrayList<>();
        repos.stream()
                .filter(r -> !Boolean.TRUE.equals(r.getFork()) && r.getPushed_at() != null)
                .sorted(Comparator.comparing(GitHubRepo::getPushed_at).reversed())
                .limit(3)
                .forEach(repo -> fetchRecentCommits(username, repo.getName(), username).stream()
                        .map(GitHubService::messageOf)
                        .filter(Objects::nonNull)
                        .forEach(messages::add));
        return messages.size() > MAX_USER_COMMITS ? messages.subList(0, MAX_USER_COMMITS) : messages;
    }

    static String messageOf(GitHubCommitResponse commit) {
        if (commit == null || commit.getCommit() == null) return null;
        String message = commit.getCommit().getMessage();
        return message == null || message.isBlank() ? null : message;
    }
}

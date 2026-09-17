package com.eggscan.service;

import com.eggscan.model.GitHubProfile;
import com.eggscan.model.GitHubRepo;
import com.eggscan.model.ScanResult;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

import com.eggscan.model.GitHubTreeResponse;
import com.eggscan.model.GitHubContentResponse;
import com.eggscan.model.GitHubCommitResponse;
import com.eggscan.model.GitHubEventResponse;
import java.util.Base64;


@Service
public class GitHubService {

    private final WebClient client;

    public GitHubService(@org.springframework.beans.factory.annotation.Qualifier("githubClient") WebClient githubClient) {
        this.client = githubClient;
    }

    public ScanResult scanUser(String username) {
        var tuple = Mono.zip(fetchProfileMono(username), fetchReposMono(username)).block();
        if (tuple == null) {
            throw new RuntimeException("Failed to fetch data for user: " + username);
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
                .reposWithReadme(0) // placeholder — we'll fetch READMEs in Phase 2
                .lastActivity(lastActivity)
                .build();
    }

    private boolean isActive(GitHubRepo repo) {
        if (repo.getPushed_at() == null) return false;
        Instant pushed = Instant.parse(repo.getPushed_at());
        return pushed.isAfter(Instant.now().minus(180, ChronoUnit.DAYS));
    }

    private Mono<GitHubProfile> fetchProfileMono(String username) {
        return client.get()
                .uri("/users/{u}", username)
                .retrieve()
                .bodyToMono(GitHubProfile.class)
                .onErrorResume(e -> Mono.error(new RuntimeException("User not found: " + username)));
    }

    private Mono<List<GitHubRepo>> fetchReposMono(String username) {
        return client.get()
                .uri("/users/{u}/repos?per_page=100&sort=updated", username)
                .retrieve()
                .bodyToMono(GitHubRepo[].class)
                .map(repos -> repos == null ? List.<GitHubRepo>of() : Arrays.asList(repos))
                .onErrorResume(e -> Mono.just(List.of()));
    }

    public GitHubTreeResponse fetchRepoTree(String username, String repoName, String defaultBranch) {
        return client.get()
                .uri("/repos/{u}/{r}/git/trees/{b}?recursive=1", username, repoName, defaultBranch)
                .retrieve()
                .bodyToMono(GitHubTreeResponse.class)
                .onErrorResume(e -> Mono.empty())
                .block();
    }

    public Mono<GitHubTreeResponse> fetchRepoTreeMono(String username, String repoName, String defaultBranch) {
        return client.get()
                .uri("/repos/{u}/{r}/git/trees/{b}?recursive=1", username, repoName, defaultBranch)
                .retrieve()
                .bodyToMono(GitHubTreeResponse.class)
                .onErrorResume(e -> Mono.empty());
    }

    public Mono<String> fetchFileContentMono(String username, String repoName, String path) {
        return client.get()
                .uri("/repos/{u}/{r}/contents/{p}", username, repoName, path)
                .retrieve()
                .bodyToMono(GitHubContentResponse.class)
                .map(contentRes -> {
                    if (contentRes != null && contentRes.getContent() != null && "base64".equals(contentRes.getEncoding())) {
                        try {
                            return new String(Base64.getMimeDecoder().decode(contentRes.getContent()));
                        } catch (Exception e) {
                            return "";
                        }
                    }
                    return "";
                })
                .onErrorResume(e -> Mono.just(""));
    }

    public String fetchFileContent(String username, String repoName, String path) {
        String content = fetchFileContentMono(username, repoName, path).block();
        return content == null || content.isEmpty() ? null : content;
    }

    public List<GitHubCommitResponse> fetchRecentCommits(String username, String repoName) {
        GitHubCommitResponse[] commits = client.get()
                .uri("/repos/{u}/{r}/commits?per_page=10", username, repoName)
                .retrieve()
                .bodyToMono(GitHubCommitResponse[].class)
                .onErrorResume(e -> Mono.just(new GitHubCommitResponse[0]))
                .block();
        return commits == null ? List.of() : Arrays.asList(commits);
    }

    public List<GitHubEventResponse> fetchUserEvents(String username) {
        GitHubEventResponse[] events = client.get()
                .uri("/users/{u}/events?per_page=100", username)
                .retrieve()
                .bodyToMono(GitHubEventResponse[].class)
                .onErrorResume(e -> Mono.just(new GitHubEventResponse[0]))
                .block();
        return events == null ? List.of() : Arrays.asList(events);
    }
}
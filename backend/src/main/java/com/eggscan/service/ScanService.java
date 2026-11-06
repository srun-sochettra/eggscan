package com.eggscan.service;

import com.eggscan.dto.AIInsights;
import com.eggscan.dto.BattleResponse;
import com.eggscan.dto.CommitShameResponse;
import com.eggscan.dto.LeaderboardEntry;
import com.eggscan.dto.ReadmeRaterResponse;
import com.eggscan.dto.RepoDeepDiveResponse;
import com.eggscan.dto.ScanResponse;
import com.eggscan.dto.StackRoastResponse;
import com.eggscan.exception.ApiException;
import com.eggscan.model.ContributionStats;
import com.eggscan.model.GitHubCommitResponse;
import com.eggscan.model.GitHubRepo;
import com.eggscan.model.GitHubTreeItem;
import com.eggscan.model.GitHubTreeResponse;
import com.eggscan.model.ScanRecord;
import com.eggscan.model.ScanResult;
import com.eggscan.repository.ScanRecordRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

@Service
@Slf4j
public class ScanService {

    private static final List<String> CONFIG_FILES = List.of("package.json", "pom.xml", "docker-compose.yml", "requirements.txt", "build.gradle", "go.mod");
    private static final String HONEST = "honest";

    private final GitHubService gitHubService;
    private final GitHubGraphQLService graphQLService;
    private final ReadmeService readmeService;
    private final AIAnalyzerService analyzer;
    private final ScanRecordRepository scanRecordRepository;
    private final ObjectMapper objectMapper;
    private final Executor scanExecutor;

    public ScanService(GitHubService gitHubService,
                       GitHubGraphQLService graphQLService,
                       ReadmeService readmeService,
                       AIAnalyzerService analyzer,
                       ScanRecordRepository scanRecordRepository,
                       ObjectMapper objectMapper,
                       @Qualifier("scanExecutor") Executor scanExecutor) {
        this.gitHubService = gitHubService;
        this.graphQLService = graphQLService;
        this.readmeService = readmeService;
        this.analyzer = analyzer;
        this.scanRecordRepository = scanRecordRepository;
        this.objectMapper = objectMapper;
        this.scanExecutor = scanExecutor;
    }

    public ScanResponse getScanById(String id) {
        ScanRecord record = scanRecordRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SCAN_NOT_FOUND", "That scan result was not found."));
        try {
            ScanResponse response = objectMapper.readValue(record.getJsonPayload(), ScanResponse.class);
            response.setId(record.getId());
            return response;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse cached scan result", e);
        }
    }

    public List<LeaderboardEntry> getLeaderboard() {
        return scanRecordRepository.findLeaderboard(PageRequest.of(0, 10)).stream()
                .map(record -> LeaderboardEntry.builder()
                        .id(record.getId())
                        .username(record.getUsername())
                        .avatarUrl(record.getAvatarUrl())
                        .vibe(record.getVibe())
                        .eggScore(record.getScore())
                        .eggVerdict(record.getVerdict())
                        .build())
                .toList();
    }

    public ScanResponse scan(String username, String mode) {
        String normalizedMode = normalizeMode(mode);
        log.info("Scanning username: {} (mode {})", username, normalizedMode);

        Optional<ScanResponse> cachedResponse = getCachedScan(username, normalizedMode);
        if (cachedResponse.isPresent()) {
            return cachedResponse.get();
        }

        ScanResponse response = performNewScan(username, normalizedMode);
        saveResult(response, normalizedMode);
        return response;
    }

    private static String normalizeMode(String mode) {
        return mode == null || mode.isBlank() ? HONEST : mode.toLowerCase(Locale.ROOT);
    }

    /** The 24h cache is per mode: a roast must never be served for an honest scan, or vice versa. */
    private Optional<ScanResponse> getCachedScan(String username, String mode) {
        List<ScanRecord> recent = scanRecordRepository.findRecentByUsernameAndMode(username, mode, PageRequest.of(0, 1));
        if (recent == null || recent.isEmpty()) return Optional.empty();
        ScanRecord record = recent.get(0);
        if (record.getScannedAt() == null || !record.getScannedAt().isAfter(LocalDateTime.now().minusHours(24))) {
            return Optional.empty();
        }
        try {
            ScanResponse cachedResponse = objectMapper.readValue(record.getJsonPayload(), ScanResponse.class);
            cachedResponse.setId(record.getId());
            log.info("Returning cached scan result for username: {}", username);
            return Optional.ofNullable(cachedResponse);
        } catch (Exception e) {
            log.warn("Failed to parse cached scan result for username: {}, falling back to re-scan", username, e);
            return Optional.empty();
        }
    }

    private ScanResponse performNewScan(String username, String mode) {
        CompletableFuture<ScanResult> futureData = CompletableFuture.supplyAsync(() -> gitHubService.scanUser(username), scanExecutor);
        CompletableFuture<ContributionStats> futureStats = CompletableFuture.supplyAsync(() -> graphQLService.fetchStats(username), scanExecutor);

        ScanResult data = futureData.join();
        ContributionStats stats = futureStats.join();
        Map<String, String> readmes = readmeService.fetchTopReadmes(username, data.getRepos(), 5);
        data.setReposWithReadme(readmeService.countReposWithReadme(readmes));

        AIInsights ai = analyzer.analyze(data, stats, readmes, mode);
        applyEasterEgg(data.getProfile().getLogin(), ai);

        return buildResponse(data, stats, ai);
    }

    /**
     * Easter eggs used to short-circuit in the controller and return a response with no id,
     * avatar, stats or raw data, which crashed the result page. They now overlay a real scan.
     */
    private static void applyEasterEgg(String login, AIInsights ai) {
        if ("torvalds".equalsIgnoreCase(login)) {
            ai.setEggVerdict("Golden Egg");
            ai.setEggScore(100);
            ai.setFirstImpression("Wait, are you actually Linus? *bows down*");
            ai.setVibe("Literal God Tier. Creator of Git and Linux.");
        } else if ("defunkt".equalsIgnoreCase(login)) {
            ai.setEggVerdict("Golden Egg");
            ai.setEggScore(100);
            ai.setFirstImpression("Oh wow, it's one of the founding fathers of GitHub.");
            ai.setVibe("Tech Royalty. The literal reason we have this site.");
        }
    }

    private ScanResponse buildResponse(ScanResult data, ContributionStats stats, AIInsights ai) {
        return ScanResponse.builder()
                .id(UUID.randomUUID().toString())
                .username(data.getProfile().getLogin())
                .avatarUrl(data.getProfile().getAvatar_url())
                .name(data.getProfile().getName())
                .bio(data.getProfile().getBio())
                .eggVerdict(ai.getEggVerdict())
                .eggEmoji("")
                .eggScore(ai.getEggScore())
                .firstImpression(ai.getFirstImpression())
                .skills(ai.getSkills() == null ? List.of() : ai.getSkills())
                .improvements(ai.getImprovements() == null ? List.of() : ai.getImprovements())
                .vibe(ai.getVibe())
                .predictedJobTitle(ai.getPredictedJobTitle())
                .predictedSalary(ai.getPredictedSalary())
                .githubWrapped(ai.getGithubWrapped())
                .rawData(data)
                .stats(stats)
                .build();
    }

    /**
     * Every scan is persisted so its share link (/?id=...) resolves; previously only honest scans
     * were saved, so share links for other modes returned an error. Only honest scans are ranked.
     */
    private void saveResult(ScanResponse response, String mode) {
        try {
            ScanRecord record = ScanRecord.builder()
                    .id(response.getId())
                    .username(response.getUsername())
                    .score(response.getEggScore())
                    .verdict(response.getEggVerdict())
                    .avatarUrl(response.getAvatarUrl())
                    .vibe(response.getVibe())
                    .jsonPayload(objectMapper.writeValueAsString(response))
                    .scannedAt(LocalDateTime.now())
                    .mode(mode)
                    .build();
            scanRecordRepository.save(record);
        } catch (Exception e) {
            log.error("Failed to save scan result for username: {}", response.getUsername(), e);
        }
    }

    public BattleResponse battle(String username1, String username2) {
        CompletableFuture<ScanResponse> futureS1 = CompletableFuture.supplyAsync(() -> scan(username1, HONEST), scanExecutor);
        CompletableFuture<ScanResponse> futureS2 = CompletableFuture.supplyAsync(() -> scan(username2, HONEST), scanExecutor);

        ScanResponse s1 = futureS1.join();
        ScanResponse s2 = futureS2.join();

        String verdict = analyzer.battle(s1.getRawData(), s1.getStats(), s2.getRawData(), s2.getStats());
        String[] parts = (verdict == null ? "" : verdict).split("\\|\\|\\|", 2);
        String claimed = parts[0].trim().replaceFirst("^@", "");
        String report = parts.length > 1 && !parts[1].isBlank() ? parts[1] : "A legendary battle without a report.";

        // The AI's winner must be one of the two players (matched case-insensitively);
        // otherwise the higher EggScore wins instead of always defaulting to player 1.
        String winner;
        if (claimed.equalsIgnoreCase(s1.getUsername())) {
            winner = s1.getUsername();
        } else if (claimed.equalsIgnoreCase(s2.getUsername())) {
            winner = s2.getUsername();
        } else {
            winner = s2.getEggScore() > s1.getEggScore() ? s2.getUsername() : s1.getUsername();
        }

        return BattleResponse.builder()
                .user1(s1)
                .user2(s2)
                .winnerUsername(winner)
                .battleReport(report)
                .build();
    }

    /** @param branch optional; when null the repository's real default branch is used. */
    public RepoDeepDiveResponse repoDeepDive(String username, String repoName, String branch) {
        log.info("Deep diving into repository: {}/{}", username, repoName);

        // Also verifies the repository exists, so a typo returns 404 instead of an AI review of nothing.
        String defaultBranch = gitHubService.fetchDefaultBranch(username, repoName);
        String ref = branch != null ? branch : defaultBranch;

        CompletableFuture<GitHubTreeResponse> futureTree = CompletableFuture.supplyAsync(() -> gitHubService.fetchRepoTree(username, repoName, ref), scanExecutor);
        CompletableFuture<List<GitHubCommitResponse>> futureCommits = CompletableFuture.supplyAsync(() -> gitHubService.fetchRecentCommits(username, repoName), scanExecutor);
        CompletableFuture<String> futureReadme = CompletableFuture.supplyAsync(() -> readmeService.fetchReadme(username, repoName), scanExecutor);

        GitHubTreeResponse tree = futureTree.join();
        List<GitHubCommitResponse> commits = futureCommits.join();
        String readme = futureReadme.join();

        Map<String, String> configFiles = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : fetchConfigFiles(username, repoName, tree, "")) {
            configFiles.put(entry.getKey(), entry.getValue());
        }

        return analyzer.analyzeRepository(username, repoName, readme, tree, configFiles, commits);
    }

    private List<Map.Entry<String, String>> fetchConfigFiles(String username, String repoName, GitHubTreeResponse tree, String keyPrefix) {
        if (tree == null || tree.getTree() == null) return List.of();
        List<String> matchingFiles = tree.getTree().stream()
                .map(GitHubTreeItem::getPath)
                .filter(CONFIG_FILES::contains)
                .toList();
        List<Map.Entry<String, String>> results = Flux.fromIterable(matchingFiles)
                .flatMapSequential(path -> gitHubService.fetchFileContentMono(username, repoName, path)
                        .map(content -> Map.entry(keyPrefix + path, content)))
                .filter(entry -> !entry.getValue().isEmpty())
                .collectList()
                .block();
        return results == null ? List.of() : results;
    }

    public CommitShameResponse shameCommits(String username, String repo, String tone) {
        log.info("Shaming commits for username: {}, repo: {}, tone: {}", username, repo, tone);
        List<String> commitMessages;

        if (repo != null && !repo.isBlank()) {
            commitMessages = gitHubService.fetchRecentCommits(username, repo).stream()
                    .map(GitHubService::messageOf)
                    .filter(Objects::nonNull)
                    .toList();
        } else {
            commitMessages = gitHubService.fetchUserCommitMessages(username);
        }

        // Previously the AI was asked to roast the literal string "No recent commits found."
        if (commitMessages.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NO_COMMITS_FOUND",
                    repo != null ? "No commits were found for that repository." : "No recent public commits were found for that user.");
        }

        return analyzer.shameCommits(commitMessages, tone);
    }

    public ReadmeRaterResponse rateReadmes(String username, String tone) {
        log.info("Rating readmes for username: {}, tone: {}", username, tone);

        // The profile README lives in the username/username repository.
        CompletableFuture<String> futureProfileReadme = CompletableFuture.supplyAsync(() -> readmeService.fetchReadme(username, username), scanExecutor);

        ScanResult data = gitHubService.scanUser(username);
        Map<String, String> readmes = new LinkedHashMap<>(readmeService.fetchTopReadmes(username, data.getRepos(), 3));

        String profileReadme = futureProfileReadme.join();
        if (profileReadme != null && !profileReadme.isBlank()) {
            String login = data.getProfile().getLogin();
            readmes.put(login + "/" + login + " (Profile)", profileReadme);
        }

        return analyzer.rateReadmes(readmes, tone);
    }

    public StackRoastResponse roastStack(String username, String tone) {
        log.info("Roasting stack for username: {}, tone: {}", username, tone);
        ScanResult data = gitHubService.scanUser(username);

        // Top 2 repos by stars (then recency); the list arrives sorted by last update, not importance.
        List<GitHubRepo> topRepos = data.getRepos().stream()
                .sorted(Comparator.comparingInt((GitHubRepo r) -> Optional.ofNullable(r.getStargazers_count()).orElse(0)).reversed()
                        .thenComparing(GitHubRepo::getPushed_at, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(2)
                .toList();

        List<CompletableFuture<List<Map.Entry<String, String>>>> futures = topRepos.stream()
                .map(repo -> CompletableFuture.supplyAsync(() -> {
                    String branch = repo.getDefault_branch() != null ? repo.getDefault_branch() : "main";
                    GitHubTreeResponse tree;
                    try {
                        tree = gitHubService.fetchRepoTree(username, repo.getName(), branch);
                    } catch (ApiException e) {
                        log.warn("Skipping config scan for {}/{}: {}", username, repo.getName(), e.getMessage());
                        return List.<Map.Entry<String, String>>of();
                    }
                    return fetchConfigFiles(username, repo.getName(), tree, repo.getName() + "/");
                }, scanExecutor))
                .toList();

        Map<String, String> configFiles = new LinkedHashMap<>();
        for (CompletableFuture<List<Map.Entry<String, String>>> future : futures) {
            for (Map.Entry<String, String> entry : future.join()) {
                configFiles.put(entry.getKey(), entry.getValue());
            }
        }

        return analyzer.roastStack(data.getLanguageBreakdown(), configFiles, tone);
    }
}

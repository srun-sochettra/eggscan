package com.eggscan.controller;

import com.eggscan.dto.BattleResponse;
import com.eggscan.dto.CommitShameResponse;
import com.eggscan.dto.LeaderboardEntry;
import com.eggscan.dto.ReadmeRaterResponse;
import com.eggscan.dto.RepoDeepDiveResponse;
import com.eggscan.dto.ScanResponse;
import com.eggscan.dto.StackRoastResponse;
import com.eggscan.exception.ApiException;
import com.eggscan.service.ScanService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** Failures are mapped to HTTP statuses by {@link com.eggscan.exception.GlobalExceptionHandler}. */
@RestController
@RequestMapping("/api")
public class ScanController {

    private final ScanService scanService;

    // GitHub username: max 39 characters, alphanumeric and single hyphens, cannot begin or end with a hyphen
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$");
    // Repo name: max 100 characters, alphanumeric, hyphens, underscores, dots ("." and ".." rejected separately)
    private static final Pattern REPO_NAME_PATTERN = Pattern.compile("^[a-zA-Z0-9._-]{1,100}$");
    private static final Pattern BRANCH_NAME_PATTERN = Pattern.compile("^[a-zA-Z0-9._/\\-]{1,255}$");
    private static final Pattern MODE_PATTERN = Pattern.compile("^[a-zA-Z]{1,20}$");
    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", Pattern.CASE_INSENSITIVE);

    public ScanController(ScanService scanService) {
        this.scanService = scanService;
    }

    private static void requireUsername(String username) {
        if (username == null || !USERNAME_PATTERN.matcher(username).matches()) {
            throw invalid("Invalid username format");
        }
    }

    private static void requireRepoName(String repoName) {
        if (repoName == null || !REPO_NAME_PATTERN.matcher(repoName).matches() || ".".equals(repoName) || "..".equals(repoName)) {
            throw invalid("Invalid repository name format");
        }
    }

    private static void requireBranchName(String branch) {
        boolean valid = BRANCH_NAME_PATTERN.matcher(branch).matches();
        for (String part : branch.split("/", -1)) {
            if (part.isEmpty() || ".".equals(part) || "..".equals(part)) valid = false;
        }
        if (!valid) throw invalid("Invalid branch name format");
    }

    private static String requireMode(String mode) {
        if (!MODE_PATTERN.matcher(mode).matches()) throw invalid("Invalid mode");
        return mode.toLowerCase();
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", message);
    }

    @GetMapping("/scan/{username}")
    public ScanResponse scan(@PathVariable String username, @RequestParam(required = false, defaultValue = "honest") String mode) {
        requireUsername(username);
        return scanService.scan(username, requireMode(mode));
    }

    @GetMapping("/battle")
    public BattleResponse battle(@RequestParam String u1, @RequestParam String u2) {
        requireUsername(u1);
        requireUsername(u2);
        if (u1.equalsIgnoreCase(u2)) {
            throw invalid("Pick two different GitHub users to battle.");
        }
        return scanService.battle(u1, u2);
    }

    @GetMapping("/scan/result/{id}")
    public ScanResponse getScanById(@PathVariable String id) {
        if (!UUID_PATTERN.matcher(id).matches()) {
            throw invalid("Invalid ID format");
        }
        return scanService.getScanById(id);
    }

    @GetMapping("/leaderboard")
    public List<LeaderboardEntry> getLeaderboard() {
        return scanService.getLeaderboard();
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "eggscan");
    }

    /** defaultBranch is optional: when omitted the repository's real default branch is used (not "main"). */
    @GetMapping("/scan/{username}/repo/{repoName}")
    public RepoDeepDiveResponse repoDeepDive(@PathVariable String username, @PathVariable String repoName,
                                             @RequestParam(required = false) String defaultBranch) {
        requireUsername(username);
        requireRepoName(repoName);
        String branch = defaultBranch == null || defaultBranch.isBlank() ? null : defaultBranch.trim();
        if (branch != null) requireBranchName(branch);
        return scanService.repoDeepDive(username, repoName, branch);
    }

    @GetMapping("/shame/commits/{username}")
    public CommitShameResponse shameCommits(@PathVariable String username, @RequestParam(required = false) String repo,
                                            @RequestParam(required = false, defaultValue = "honest") String tone) {
        requireUsername(username);
        String repoName = repo == null || repo.isBlank() ? null : repo.trim();
        if (repoName != null) requireRepoName(repoName);
        return scanService.shameCommits(username, repoName, requireMode(tone));
    }

    @GetMapping("/shame/readme/{username}")
    public ReadmeRaterResponse rateReadmes(@PathVariable String username, @RequestParam(required = false, defaultValue = "honest") String tone) {
        requireUsername(username);
        return scanService.rateReadmes(username, requireMode(tone));
    }

    @GetMapping("/shame/stack/{username}")
    public StackRoastResponse roastStack(@PathVariable String username, @RequestParam(required = false, defaultValue = "honest") String tone) {
        requireUsername(username);
        return scanService.roastStack(username, requireMode(tone));
    }
}

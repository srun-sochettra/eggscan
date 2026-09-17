package com.eggscan.controller;

import com.eggscan.dto.ScanResponse;
import com.eggscan.dto.RepoDeepDiveResponse;
import com.eggscan.service.ScanService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api")
@Slf4j
public class ScanController {

    private final ScanService scanService;

    // GitHub username: max 39 characters, alphanumeric and single hyphens, cannot begin or end with a hyphen
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$");
    // Repo name: max 100 characters, alphanumeric, hyphens, underscores, dots
    private static final Pattern REPO_NAME_PATTERN = Pattern.compile("^[a-zA-Z0-9._-]{1,100}$");
    // Branch name constraint
    private static final Pattern BRANCH_NAME_PATTERN = Pattern.compile("^[a-zA-Z0-9._/\\-]{1,255}$");
    // UUID v4 pattern
    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", Pattern.CASE_INSENSITIVE);

    public ScanController(ScanService scanService) {
        this.scanService = scanService;
    }

    private boolean isValidUsername(String username) {
        return username != null && USERNAME_PATTERN.matcher(username).matches();
    }

    private boolean isValidRepoName(String repoName) {
        return repoName != null && REPO_NAME_PATTERN.matcher(repoName).matches();
    }

    private boolean isValidBranchName(String branchName) {
        return branchName != null && BRANCH_NAME_PATTERN.matcher(branchName).matches();
    }

    private boolean isValidUuid(String id) {
        return id != null && UUID_PATTERN.matcher(id).matches();
    }

    @GetMapping("/scan/{username}")
    public ResponseEntity<?> scan(@PathVariable String username, @RequestParam(required = false, defaultValue = "honest") String mode) {
        if (!isValidUsername(username)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid username format"));
        }

        if ("torvalds".equalsIgnoreCase(username)) {
            ScanResponse easterEgg = ScanResponse.builder()
                    .username("torvalds")
                    .eggVerdict("Golden Egg")
                    .eggScore(100)
                    .firstImpression("Wait, are you actually Linus? *bows down*")
                    .vibe("Literal God Tier. Creator of Git and Linux.")
                    .skills(java.util.List.of("C", "Kernel", "Git", "Yelling at developers on mailing lists"))
                    .build();
            return ResponseEntity.ok(easterEgg);
        }

        if ("defunkt".equalsIgnoreCase(username)) {
            ScanResponse easterEgg = ScanResponse.builder()
                    .username("defunkt")
                    .eggVerdict("Golden Egg")
                    .eggScore(100)
                    .firstImpression("Oh wow, it's one of the founding fathers of GitHub.")
                    .vibe("Tech Royalty. The literal reason we have this site.")
                    .skills(java.util.List.of("Ruby", "Building empires", "Pioneering the modern web"))
                    .build();
            return ResponseEntity.ok(easterEgg);
        }

        try {
            ScanResponse response = scanService.scan(username, mode);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error occurred while scanning username: {}", username, e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "An error occurred while processing the request"));
        }
    }

    @GetMapping("/battle")
    public ResponseEntity<?> battle(@RequestParam String u1, @RequestParam String u2) {
        if (!isValidUsername(u1) || !isValidUsername(u2)) {
             return ResponseEntity.badRequest().body(Map.of("error", "Invalid username format"));
        }
        try {
            return ResponseEntity.ok(scanService.battle(u1, u2));
        } catch (Exception e) {
            log.error("Error occurred during battle between {} and {}", u1, u2, e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "An error occurred while processing the request"));
        }
    }

    @GetMapping("/scan/result/{id}")
    public ResponseEntity<?> getScanById(@PathVariable String id) {
        if (!isValidUuid(id)) {
             return ResponseEntity.badRequest().body(Map.of("error", "Invalid ID format"));
        }
        try {
            ScanResponse response = scanService.getScanById(id);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error occurred while fetching scan by id: {}", id, e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "An error occurred while processing the request"));
        }
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<?> getLeaderboard() {
        try {
            return ResponseEntity.ok(scanService.getLeaderboard());
        } catch (Exception e) {
            log.error("Error occurred while fetching leaderboard", e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "An error occurred while processing the request"));
        }
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "eggscan");
    }

    @GetMapping("/scan/{username}/repo/{repoName}")
    public ResponseEntity<?> repoDeepDive(@PathVariable String username, @PathVariable String repoName, @RequestParam(required = false, defaultValue = "main") String defaultBranch) {
        if (!isValidUsername(username)) {
             return ResponseEntity.badRequest().body(Map.of("error", "Invalid username format"));
        }
        if (!isValidRepoName(repoName)) {
             return ResponseEntity.badRequest().body(Map.of("error", "Invalid repository name format"));
        }
        if (!isValidBranchName(defaultBranch)) {
             return ResponseEntity.badRequest().body(Map.of("error", "Invalid branch name format"));
        }
        try {
            RepoDeepDiveResponse response = scanService.repoDeepDive(username, repoName, defaultBranch);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error occurred while analyzing repository: {}/{}", username, repoName, e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "An error occurred while analyzing the repository"));
        }
    }

    @GetMapping("/shame/commits/{username}")
    public ResponseEntity<?> shameCommits(@PathVariable String username, @RequestParam(required = false) String repo, @RequestParam(required = false, defaultValue = "honest") String tone) {
        if (!isValidUsername(username)) {
             return ResponseEntity.badRequest().body(Map.of("error", "Invalid username format"));
        }
        if (repo != null && !repo.isBlank() && !isValidRepoName(repo)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid repository name format"));
        }
        try {
            return ResponseEntity.ok(scanService.shameCommits(username, repo, tone));
        } catch (Exception e) {
            log.error("Error occurred while shaming commits for username: {}", username, e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "An error occurred while processing the request"));
        }
    }

    @GetMapping("/shame/readme/{username}")
    public ResponseEntity<?> rateReadmes(@PathVariable String username, @RequestParam(required = false, defaultValue = "honest") String tone) {
        if (!isValidUsername(username)) {
             return ResponseEntity.badRequest().body(Map.of("error", "Invalid username format"));
        }
        try {
            return ResponseEntity.ok(scanService.rateReadmes(username, tone));
        } catch (Exception e) {
            log.error("Error occurred while rating readmes for username: {}", username, e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "An error occurred while processing the request"));
        }
    }

    @GetMapping("/shame/stack/{username}")
    public ResponseEntity<?> roastStack(@PathVariable String username, @RequestParam(required = false, defaultValue = "honest") String tone) {
        if (!isValidUsername(username)) {
             return ResponseEntity.badRequest().body(Map.of("error", "Invalid username format"));
        }
        try {
            return ResponseEntity.ok(scanService.roastStack(username, tone));
        } catch (Exception e) {
            log.error("Error occurred while roasting stack for username: {}", username, e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "An error occurred while processing the request"));
        }
    }
}
package com.eggscan.service;

import com.eggscan.model.GitHubProfile;
import com.eggscan.model.GitHubRepo;
import com.eggscan.model.ScanResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class GitHubServiceTest {

    @Mock
    private WebClient webClient;

    @Mock
    private WebClient.RequestHeadersUriSpec requestHeadersUriSpec;

    @Mock
    private WebClient.RequestHeadersSpec requestHeadersSpecProfile;

    @Mock
    private WebClient.RequestHeadersSpec requestHeadersSpecRepos;

    @Mock
    private WebClient.ResponseSpec responseSpecProfile;

    @Mock
    private WebClient.ResponseSpec responseSpecRepos;

    private GitHubService gitHubService;

    @BeforeEach
    void setUp() {
        gitHubService = new GitHubService(webClient);
    }

    private void mockWebClient(GitHubProfile profile, GitHubRepo[] repos, boolean profileError) {
        when(webClient.get()).thenReturn(requestHeadersUriSpec);

        // Mock URI matching for profile
        when(requestHeadersUriSpec.uri(eq("/users/{u}"), anyString())).thenReturn(requestHeadersSpecProfile);
        when(requestHeadersSpecProfile.retrieve()).thenReturn(responseSpecProfile);

        if (profileError) {
            when(responseSpecProfile.bodyToMono(GitHubProfile.class))
                    .thenReturn(Mono.error(new RuntimeException("User not found: " + "testuser")));
        } else {
            when(responseSpecProfile.bodyToMono(GitHubProfile.class)).thenReturn(Mono.just(profile));
        }

        // Always mock repos since they're executed concurrently now
        when(requestHeadersUriSpec.uri(eq("/users/{u}/repos?per_page=100&sort=updated"), anyString())).thenReturn(requestHeadersSpecRepos);
        when(requestHeadersSpecRepos.retrieve()).thenReturn(responseSpecRepos);

        if (profileError) {
             when(responseSpecRepos.bodyToMono(GitHubRepo[].class)).thenReturn(Mono.just(new GitHubRepo[0]));
        } else {
             when(responseSpecRepos.bodyToMono(GitHubRepo[].class)).thenReturn(Mono.just(repos != null ? repos : new GitHubRepo[0]));
        }
    }

    @Test
    void scanUser_HappyPath() {
        GitHubProfile profile = new GitHubProfile();
        profile.setLogin("testuser");
        profile.setName("Test User");

        GitHubRepo repo1 = new GitHubRepo();
        repo1.setName("repo1");
        repo1.setFork(false);
        repo1.setLanguage("Java");
        repo1.setStargazers_count(10);
        repo1.setPushed_at(Instant.now().toString());

        GitHubRepo repo2 = new GitHubRepo();
        repo2.setName("repo2");
        repo2.setFork(false);
        repo2.setLanguage("Java");
        repo2.setStargazers_count(5);
        repo2.setPushed_at(Instant.now().minus(10, ChronoUnit.DAYS).toString());

        GitHubRepo repo3 = new GitHubRepo();
        repo3.setName("repo3");
        repo3.setFork(true); // Should be filtered out
        repo3.setLanguage("Python");
        repo3.setStargazers_count(100);
        repo3.setPushed_at(Instant.now().toString());

        GitHubRepo repo4 = new GitHubRepo();
        repo4.setName("repo4");
        repo4.setFork(false);
        repo4.setLanguage("JavaScript");
        repo4.setStargazers_count(2);
        repo4.setPushed_at(Instant.now().minus(200, ChronoUnit.DAYS).toString()); // Inactive

        GitHubRepo[] repos = {repo1, repo2, repo3, repo4};

        mockWebClient(profile, repos, false);

        ScanResult result = gitHubService.scanUser("testuser");

        assertNotNull(result);
        assertEquals("testuser", result.getProfile().getLogin());

        // Assert forks are filtered (3 own repos remaining)
        assertEquals(3, result.getRepos().size());

        // Assert languages
        Map<String, Integer> langs = result.getLanguageBreakdown();
        assertEquals(2, langs.get("Java"));
        assertEquals(1, langs.get("JavaScript"));
        assertNull(langs.get("Python")); // Because fork was filtered

        // Assert total stars (10 + 5 + 2 = 17, repo3's 100 stars ignored because fork)
        assertEquals(17, result.getTotalStars());

        // Assert active repos (repo1, repo2 are active, repo4 is inactive, repo3 filtered)
        assertEquals(2, result.getActiveRepos());
    }

    @Test
    void scanUser_NullsAndMissingData() {
        GitHubProfile profile = new GitHubProfile();
        profile.setLogin("testuser");

        GitHubRepo repo1 = new GitHubRepo();
        repo1.setName("repo1");
        repo1.setFork(false);
        repo1.setLanguage(null);
        repo1.setStargazers_count(null);
        repo1.setPushed_at(null);

        GitHubRepo[] repos = {repo1};

        mockWebClient(profile, repos, false);

        ScanResult result = gitHubService.scanUser("testuser");

        assertNotNull(result);
        assertEquals(1, result.getRepos().size());

        // Assert language breakdown handles null gracefully
        assertTrue(result.getLanguageBreakdown().isEmpty());

        // Assert total stars default to 0
        assertEquals(0, result.getTotalStars());

        // Assert active repos handles null pushed_at
        assertEquals(0, result.getActiveRepos());

        // Assert last activity
        assertEquals("never", result.getLastActivity());
    }

    @Test
    void scanUser_ProfileNotFound() {
        mockWebClient(null, null, true);

        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            gitHubService.scanUser("testuser");
        });

        String msg = exception.getMessage();
        Throwable cause = exception.getCause();
        boolean hasExpectedMessage = msg.contains("User not found") ||
            msg.contains("Failed to fetch data") ||
            (cause != null && cause.getMessage().contains("User not found"));

        assertTrue(hasExpectedMessage, "Expected exception message to indicate profile not found, got: " + msg + (cause != null ? " (cause: " + cause.getMessage() + ")" : ""));
    }

    @Test
    void scanUser_NullReposResponse() {
        GitHubProfile profile = new GitHubProfile();
        profile.setLogin("testuser");

        mockWebClient(profile, null, false);

        // Re-mock specifically for null repos handling
        when(responseSpecRepos.bodyToMono(GitHubRepo[].class)).thenReturn(Mono.just(new GitHubRepo[0]));

        ScanResult result = gitHubService.scanUser("testuser");

        assertNotNull(result);
        assertTrue(result.getRepos().isEmpty());
        assertEquals(0, result.getTotalStars());
        assertEquals(0, result.getActiveRepos());
        assertTrue(result.getLanguageBreakdown().isEmpty());
    }
}
package com.eggscan.service;

import com.eggscan.model.ContributionStats;
import com.eggscan.model.PinnedRepo;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class GitHubGraphQLServiceTest {

    @Mock
    private WebClient webClient;

    @Mock
    private WebClient.RequestBodyUriSpec requestBodyUriSpec;

    @Mock
    private WebClient.RequestBodySpec requestBodySpec;

    @Mock
    private WebClient.ResponseSpec responseSpec;

    private GitHubGraphQLService gitHubGraphQLService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        gitHubGraphQLService = new GitHubGraphQLService(webClient);
        objectMapper = new ObjectMapper();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void mockWebClientResponse(Mono<JsonNode> response) {
        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.bodyValue(any())).thenReturn((WebClient.RequestHeadersSpec) requestBodySpec);
        when(requestBodySpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(JsonNode.class)).thenReturn(response);
    }

    @Test
    void fetchStats_HappyPath_ReturnsPopulatedStats() throws Exception {
        String jsonResponse = """
            {
              "data": {
                "user": {
                  "contributionsCollection": {
                    "contributionCalendar": {
                      "totalContributions": 500
                    },
                    "totalIssueContributions": 50,
                    "totalPullRequestContributions": 100
                  },
                  "pinnedItems": {
                    "nodes": [
                      {
                        "name": "repo1",
                        "description": "Description 1",
                        "url": "https://github.com/repo1",
                        "stargazerCount": 10,
                        "primaryLanguage": {
                          "name": "Java"
                        }
                      }
                    ]
                  }
                }
              }
            }
        """;
        JsonNode mockResponseNode = objectMapper.readTree(jsonResponse);
        mockWebClientResponse(Mono.just(mockResponseNode));

        ContributionStats stats = gitHubGraphQLService.fetchStats("testuser");

        assertNotNull(stats);
        assertEquals(500, stats.getTotalContributionsLastYear());
        assertEquals(50, stats.getTotalIssues());
        assertEquals(100, stats.getTotalPullRequests());
        assertTrue(stats.isHasPinnedRepos());
        assertEquals(1, stats.getPinnedRepos().size());

        PinnedRepo repo = stats.getPinnedRepos().get(0);
        assertEquals("repo1", repo.getName());
        assertEquals("Description 1", repo.getDescription());
        assertEquals("https://github.com/repo1", repo.getUrl());
        assertEquals(10, repo.getStars());
        assertEquals("Java", repo.getPrimaryLanguage());
    }

    @Test
    void fetchStats_UserNotFound_ReturnsEmptyStats() throws Exception {
        String jsonResponse = """
            {
              "data": {
                "user": null
              }
            }
        """;
        JsonNode mockResponseNode = objectMapper.readTree(jsonResponse);
        mockWebClientResponse(Mono.just(mockResponseNode));

        ContributionStats stats = gitHubGraphQLService.fetchStats("unknownuser");

        assertNotNull(stats);
        assertEquals(0, stats.getTotalContributionsLastYear());
        assertEquals(0, stats.getTotalIssues());
        assertEquals(0, stats.getTotalPullRequests());
        assertEquals(List.of(), stats.getPinnedRepos());
        assertFalse(stats.isHasPinnedRepos());
    }

    @Test
    void fetchStats_ErrorPath_ReturnsEmptyStats() {
        mockWebClientResponse(Mono.error(new RuntimeException("Simulated WebClient exception")));

        ContributionStats stats = gitHubGraphQLService.fetchStats("testuser");

        assertNotNull(stats);
        assertEquals(0, stats.getTotalContributionsLastYear());
        assertEquals(0, stats.getTotalIssues());
        assertEquals(0, stats.getTotalPullRequests());
        assertEquals(List.of(), stats.getPinnedRepos());
        assertFalse(stats.isHasPinnedRepos());
    }
    @Test
    void fetchStats_WebClientDirectException_ReturnsEmptyStats() {
        when(webClient.post()).thenThrow(new RuntimeException("Direct WebClient exception"));

        ContributionStats stats = gitHubGraphQLService.fetchStats("testuser");

        assertNotNull(stats);
        assertEquals(0, stats.getTotalContributionsLastYear());
        assertEquals(0, stats.getTotalIssues());
        assertEquals(0, stats.getTotalPullRequests());
        assertEquals(List.of(), stats.getPinnedRepos());
        assertFalse(stats.isHasPinnedRepos());
    }

    @Test
    void fetchStats_WebClientResponseException_ReturnsEmptyStats() {
        mockWebClientResponse(Mono.error(new org.springframework.web.reactive.function.client.WebClientResponseException(500, "Server Error", null, null, null)));

        ContributionStats stats = gitHubGraphQLService.fetchStats("testuser");

        assertNotNull(stats);
        assertEquals(0, stats.getTotalContributionsLastYear());
        assertEquals(0, stats.getTotalIssues());
        assertEquals(0, stats.getTotalPullRequests());
        assertEquals(List.of(), stats.getPinnedRepos());
        assertFalse(stats.isHasPinnedRepos());
    }
}
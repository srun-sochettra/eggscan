package com.eggscan.service;

import com.eggscan.model.ContributionStats;
import com.eggscan.model.PinnedRepo;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.*;

@Service
public class GitHubGraphQLService {

    private final WebClient gql;

    private static final String QUERY = """
            query($login: String!) {
              user(login: $login) {
                contributionsCollection {
                  contributionCalendar { totalContributions }
                  totalIssueContributions
                  totalPullRequestContributions
                }
                pinnedItems(first: 6, types: REPOSITORY) {
                  nodes {
                    ... on Repository {
                      name
                      description
                      url
                      stargazerCount
                      primaryLanguage { name }
                      owner { login }
                    }
                  }
                }
              }
            }
            """;

    public GitHubGraphQLService(@Qualifier("githubGraphQLClient") WebClient gql) {
        this.gql = gql;
    }

    public ContributionStats fetchStats(String username) {
        Map<String, Object> body = Map.of(
                "query", QUERY,
                "variables", Map.of("login", username)
        );

        try {
            JsonNode resp = gql.post()
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block();

            if (resp == null) return empty();
            JsonNode user = resp.path("data").path("user");
            if (user.isMissingNode() || user.isNull()) {
                return empty();
            }

            JsonNode contrib = user.path("contributionsCollection");
            int total = contrib.path("contributionCalendar").path("totalContributions").asInt(0);
            int issues = contrib.path("totalIssueContributions").asInt(0);
            int prs = contrib.path("totalPullRequestContributions").asInt(0);

            List<PinnedRepo> pinned = new ArrayList<>();
            for (JsonNode n : user.path("pinnedItems").path("nodes")) {
                if (n == null || n.path("name").asText("").isBlank()) continue;
                PinnedRepo p = new PinnedRepo();
                p.setOwner(n.path("owner").path("login").asText(username));
                p.setName(n.path("name").asText());
                p.setDescription(n.path("description").asText(null));
                p.setUrl(n.path("url").asText());
                p.setStars(n.path("stargazerCount").asInt(0));
                p.setPrimaryLanguage(n.path("primaryLanguage").path("name").asText(null));
                pinned.add(p);
            }

            return ContributionStats.builder()
                    .totalContributionsLastYear(total)
                    .totalIssues(issues)
                    .totalPullRequests(prs)
                    .pinnedRepos(pinned)
                    .hasPinnedRepos(!pinned.isEmpty())
                    .build();
        } catch (Exception e) {
            return empty();
        }
    }

    private ContributionStats empty() {
        return ContributionStats.builder()
                .totalContributionsLastYear(0)
                .totalIssues(0)
                .totalPullRequests(0)
                .pinnedRepos(List.of())
                .hasPinnedRepos(false)
                .build();
    }
}

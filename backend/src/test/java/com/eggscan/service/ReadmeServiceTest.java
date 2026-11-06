package com.eggscan.service;

import com.eggscan.model.GitHubRepo;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class ReadmeServiceTest {

    @Mock
    private WebClient webClientMock;

    @Mock
    private WebClient.RequestHeadersUriSpec requestHeadersUriSpecMock;

    @Mock
    private WebClient.RequestHeadersSpec requestHeadersSpecMock;

    @Mock
    private WebClient.ResponseSpec responseSpecMock;

    private ReadmeService readmeService;

    @BeforeEach
    void setUp() {
        readmeService = new ReadmeService(webClientMock);
    }

    @Test
    void fetchTopReadmes_shouldHandleWebClientExceptionAndReturnEmptyString() {
        // Arrange
        String username = "testuser";
        GitHubRepo repo = new GitHubRepo();
        repo.setName("testrepo");
        repo.setStargazers_count(100);
        List<GitHubRepo> repos = List.of(repo);

        // Mock WebClient chain
        when(webClientMock.get()).thenReturn(requestHeadersUriSpecMock);
        when(requestHeadersUriSpecMock.uri(anyString(), anyString(), anyString())).thenReturn(requestHeadersSpecMock);
        when(requestHeadersSpecMock.retrieve()).thenReturn(responseSpecMock);
        // Simulate a 404 or any other exception by making the mono emit an error
        when(responseSpecMock.bodyToMono(JsonNode.class)).thenReturn(Mono.error(new RuntimeException("Simulated WebClient error")));

        // Act
        Map<String, String> result = readmeService.fetchTopReadmes(username, repos, 1);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result).hasSize(1);
        assertThat(result.get("testrepo")).isEqualTo(""); // Ensure fallback to empty string worked
    }
}

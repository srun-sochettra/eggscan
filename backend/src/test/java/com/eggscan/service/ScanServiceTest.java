package com.eggscan.service;

import com.eggscan.dto.ScanResponse;
import com.eggscan.model.ScanRecord;
import com.eggscan.repository.ScanRecordRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class ScanServiceTest {

    @Mock
    private GitHubService gitHubService;

    @Mock
    private GitHubGraphQLService graphQLService;

    @Mock
    private ReadmeService readmeService;

    @Mock
    private AIAnalyzerService analyzer;

    @Mock
    private ScanRecordRepository scanRecordRepository;

    @Mock
    private ObjectMapper objectMapper;

    @Spy
    private Executor scanExecutor = Executors.newFixedThreadPool(2);

    @InjectMocks
    private ScanService scanService;

    private ScanRecord mockRecord;
    private final String scanId = "test-id";

    @BeforeEach
    void setUp() {
        mockRecord = ScanRecord.builder()
                .id(scanId)
                .username("testuser")
                .score(100)
                .verdict("Golden Egg")
                .jsonPayload("{\"username\":\"testuser\"}")
                .scannedAt(LocalDateTime.now())
                .build();
    }


    @Test
    void getScanById_ReturnsScanResponse_WhenValidJson() throws Exception {
        // Arrange
        ScanResponse mockResponse = ScanResponse.builder()
                .username("testuser")
                .eggScore(100)
                .eggVerdict("Golden Egg")
                .build();

        when(scanRecordRepository.findById(scanId)).thenReturn(Optional.of(mockRecord));
        when(objectMapper.readValue(mockRecord.getJsonPayload(), ScanResponse.class)).thenReturn(mockResponse);

        // Act
        ScanResponse result = scanService.getScanById(scanId);

        // Assert
        assertNotNull(result);
        assertEquals(scanId, result.getId());
        assertEquals("testuser", result.getUsername());
        assertEquals(100, result.getEggScore());
    }


    @Test
    void getScanById_ThrowsRuntimeException_WhenInvalidJson() throws Exception {
        // Arrange
        when(scanRecordRepository.findById(scanId)).thenReturn(Optional.of(mockRecord));
        when(objectMapper.readValue(mockRecord.getJsonPayload(), ScanResponse.class))
                .thenThrow(new JsonProcessingException("Invalid JSON") {});

        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            scanService.getScanById(scanId);
        });

        assertEquals("Failed to parse cached scan result", exception.getMessage());
    }


    @Test
    void getScanById_Throws404_WhenMissing() {
        when(scanRecordRepository.findById("missing")).thenReturn(Optional.empty());
        com.eggscan.exception.ApiException e = assertThrows(com.eggscan.exception.ApiException.class, () -> scanService.getScanById("missing"));
        assertEquals(org.springframework.http.HttpStatus.NOT_FOUND, e.getStatus());
    }

    @Test
    void shameCommits_Throws404_InsteadOfRoastingNothing() {
        when(gitHubService.fetchUserCommitMessages("testuser")).thenReturn(java.util.List.of());
        com.eggscan.exception.ApiException e = assertThrows(com.eggscan.exception.ApiException.class, () -> scanService.shameCommits("testuser", null, "honest"));
        assertEquals("NO_COMMITS_FOUND", e.getCode());
    }

    @Test
    void battle_MatchesWinnerCaseInsensitively_AndFallsBackToHigherScore() throws Exception {
        ScanResponse alice = ScanResponse.builder().username("Alice").eggScore(40).build();
        ScanResponse bob = ScanResponse.builder().username("Bob").eggScore(80).build();
        ScanRecord aliceRecord = ScanRecord.builder().id("a").username("Alice").jsonPayload("a").scannedAt(LocalDateTime.now()).build();
        ScanRecord bobRecord = ScanRecord.builder().id("b").username("Bob").jsonPayload("b").scannedAt(LocalDateTime.now()).build();
        when(scanRecordRepository.findRecentByUsernameAndMode(eq("alice"), eq("honest"), any())).thenReturn(java.util.List.of(aliceRecord));
        when(scanRecordRepository.findRecentByUsernameAndMode(eq("bob"), eq("honest"), any())).thenReturn(java.util.List.of(bobRecord));
        when(objectMapper.readValue("a", ScanResponse.class)).thenReturn(alice);
        when(objectMapper.readValue("b", ScanResponse.class)).thenReturn(bob);

        when(analyzer.battle(any(), any(), any(), any())).thenReturn("@bob|||Bob wins");
        assertEquals("Bob", scanService.battle("alice", "bob").getWinnerUsername());

        when(analyzer.battle(any(), any(), any(), any())).thenReturn("|||no winner named");
        assertEquals("Bob", scanService.battle("alice", "bob").getWinnerUsername());
    }

    @Test
    void getLeaderboard_ReturnsTop10Entries_GroupedByUser() {
        when(scanRecordRepository.findLeaderboard(any(org.springframework.data.domain.Pageable.class))).thenReturn(java.util.List.of(
                ScanRecord.builder()
                        .id("uuid1")
                        .username("user1")
                        .score(90)
                        .verdict("Golden Egg")
                        .avatarUrl("url1")
                        .vibe("vibe1")
                        .build(),
                ScanRecord.builder()
                        .id("uuid2")
                        .username("user2")
                        .score(85)
                        .verdict("Fresh Egg")
                        .avatarUrl("url2")
                        .vibe("vibe2")
                        .build()
        ));

        java.util.List<com.eggscan.dto.LeaderboardEntry> result = scanService.getLeaderboard();

        assertEquals(2, result.size());
        assertEquals("user1", result.get(0).getUsername());
        assertEquals(90, result.get(0).getEggScore());
        assertEquals("user2", result.get(1).getUsername());
        assertEquals(85, result.get(1).getEggScore());
    }

    @Test
    void testPerformNewScan_Performance() throws Exception {
        // Arrange
        com.eggscan.model.GitHubProfile profile = new com.eggscan.model.GitHubProfile();
        profile.setLogin("testuser");
        com.eggscan.model.ScanResult mockData = com.eggscan.model.ScanResult.builder()
                .profile(profile)
                .repos(java.util.List.of())
                .build();

        com.eggscan.model.ContributionStats mockStats = com.eggscan.model.ContributionStats.builder().build();

        com.eggscan.dto.AIInsights mockAi = new com.eggscan.dto.AIInsights();
        mockAi.setEggVerdict("Golden Egg");
        mockAi.setEggScore(100);
        mockAi.setVibe("Awesome");

        // Introduce artificial 200ms delay to both methods
        when(gitHubService.scanUser("testuser")).thenAnswer(invocation -> {
            Thread.sleep(200);
            return mockData;
        });

        when(graphQLService.fetchStats("testuser")).thenAnswer(invocation -> {
            Thread.sleep(200);
            return mockStats;
        });

        when(readmeService.fetchTopReadmes(eq("testuser"), any(), eq(5))).thenReturn(java.util.Map.of());
        when(readmeService.countReposWithReadme(any())).thenReturn(0);
        when(analyzer.analyze(any(), any(), any(), any())).thenReturn(mockAi);
        when(scanRecordRepository.findRecentByUsernameAndMode(eq("testuser"), eq("honest"), any())).thenReturn(java.util.List.of());

        // Act
        long startTime = System.currentTimeMillis();
        ScanResponse result = scanService.scan("testuser", "honest");
        long endTime = System.currentTimeMillis();
        long duration = endTime - startTime;

        // Assert
        assertNotNull(result);
        assertEquals("testuser", result.getUsername());
        System.out.println("Execution time for scan(): " + duration + "ms");

        // This test only measures and prints the time.
        // Before optimization, it will be around 400ms.
        // After optimization, it should be around 200ms.
    }
}

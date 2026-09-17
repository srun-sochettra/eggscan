package com.eggscan.service;

import com.eggscan.dto.AIInsights;
import com.eggscan.dto.ScanResponse;
import com.eggscan.model.ContributionStats;
import com.eggscan.model.ScanResult;
import com.eggscan.model.GitHubProfile;
import com.eggscan.repository.ScanRecordRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.Mock;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.Optional;
import java.util.Collections;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class ScanServiceBenchmarkTest {

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

    private ScanService scanService;

    @Test
    void benchmarkBattle() throws Exception {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        // Configure enough threads so async tasks don't block each other
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.initialize();
        scanService = new ScanService(gitHubService, graphQLService, readmeService, analyzer, scanRecordRepository, objectMapper, executor);

        // Make mockData return unique object per call if possible to simulate true distinct objects,
        // but just making it delay correctly is the main goal.
        when(gitHubService.scanUser(anyString())).thenAnswer(inv -> {
            Thread.sleep(250);
            GitHubProfile profile = new GitHubProfile();
            profile.setLogin(inv.getArgument(0));
            return ScanResult.builder().profile(profile).repos(Collections.emptyList()).build();
        });

        when(graphQLService.fetchStats(anyString())).thenAnswer(inv -> {
            Thread.sleep(250);
            return ContributionStats.builder().build();
        });

        when(readmeService.fetchTopReadmes(anyString(), any(), org.mockito.ArgumentMatchers.anyInt())).thenReturn(Collections.emptyMap());
        when(readmeService.countReposWithReadme(any())).thenReturn(0);

        when(analyzer.analyze(any(), any(), any(), anyString())).thenAnswer(inv -> {
            AIInsights mockInsights = new AIInsights();
            mockInsights.setEggVerdict("Golden Egg");
            return mockInsights;
        });

        when(analyzer.battle(any(), any(), any(), any())).thenAnswer(inv -> {
            Thread.sleep(250);
            return "user1|||Great battle";
        });

        // Ensure we bypass cache so both scans actually run their delays.
        when(scanRecordRepository.findFirstByUsernameOrderByScannedAtDesc(anyString())).thenReturn(Optional.empty());

        // Warm up / wait for thread pool
        Thread.sleep(500);

        long start = System.currentTimeMillis();
        scanService.battle("user1", "user2");
        long end = System.currentTimeMillis();

        System.out.println("=================================================");
        System.out.println("Battle execution time: " + (end - start) + "ms");
        System.out.println("=================================================");

        executor.shutdown();
    }
}
package com.eggscan.service;

import com.eggscan.model.ContributionStats;
import com.eggscan.model.GitHubProfile;
import com.eggscan.model.ScanResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class AIAnalyzerServiceTest {

    @Mock
    private GroqService groqService;

    @InjectMocks
    private AIAnalyzerService aiAnalyzerService;

    @Test
    void battle_whenGroqSucceeds_returnsExpectedResult() throws Exception {
        // Arrange
        GitHubProfile profile1 = new GitHubProfile();
        profile1.setLogin("player1");
        profile1.setPublic_repos(10);
        ScanResult scan1 = ScanResult.builder().profile(profile1).totalStars(100).build();
        ContributionStats stats1 = ContributionStats.builder().totalContributionsLastYear(500).build();

        GitHubProfile profile2 = new GitHubProfile();
        profile2.setLogin("player2");
        profile2.setPublic_repos(20);
        ScanResult scan2 = ScanResult.builder().profile(profile2).totalStars(200).build();
        ContributionStats stats2 = ContributionStats.builder().totalContributionsLastYear(1000).build();

        ObjectMapper mapper = new ObjectMapper();
        JsonNode mockJsonNode = mapper.readTree("{\"winner\": \"player2\", \"report\": \"Player 2 destroyed Player 1!\"}");

        when(groqService.chatJson(anyString(), anyString())).thenReturn(mockJsonNode);

        // Act
        String result = aiAnalyzerService.battle(scan1, stats1, scan2, stats2);

        // Assert
        assertEquals("player2|||Player 2 destroyed Player 1!", result);
    }

    @Test
    void battle_whenGroqThrowsException_returnsFallbackTie() {
        // Arrange
        GitHubProfile profile1 = new GitHubProfile();
        profile1.setLogin("player1");
        profile1.setPublic_repos(10);
        ScanResult scan1 = ScanResult.builder().profile(profile1).totalStars(100).build();
        ContributionStats stats1 = ContributionStats.builder().totalContributionsLastYear(500).build();

        GitHubProfile profile2 = new GitHubProfile();
        profile2.setLogin("player2");
        profile2.setPublic_repos(20);
        ScanResult scan2 = ScanResult.builder().profile(profile2).totalStars(200).build();
        ContributionStats stats2 = ContributionStats.builder().totalContributionsLastYear(1000).build();

        when(groqService.chatJson(anyString(), anyString())).thenThrow(new RuntimeException("API Error"));

        // Act
        String result = aiAnalyzerService.battle(scan1, stats1, scan2, stats2);

        // Assert
        // Empty winner: ScanService then awards the battle to the higher EggScore.
        assertEquals("|||The announcer lost their voice, so the scoreboard decides this one.", result);
    }
}

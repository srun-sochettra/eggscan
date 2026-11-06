package com.eggscan.controller;

import com.eggscan.dto.BattleResponse;
import com.eggscan.dto.ScanResponse;
import com.eggscan.exception.ApiException;
import com.eggscan.service.ScanService;
import org.springframework.http.HttpStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ScanController.class)
public class ScanControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ScanService scanService;

    @Test
    void testBattle_Success() throws Exception {
        // Arrange
        ScanResponse user1 = ScanResponse.builder().username("user1").build();
        ScanResponse user2 = ScanResponse.builder().username("user2").build();
        BattleResponse battleResponse = BattleResponse.builder()
                .user1(user1)
                .user2(user2)
                .winnerUsername("user1")
                .battleReport("Epic battle!")
                .build();

        when(scanService.battle("user1", "user2")).thenReturn(battleResponse);

        // Act & Assert
        mockMvc.perform(get("/api/battle")
                        .param("u1", "user1")
                        .param("u2", "user2")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.winnerUsername").value("user1"))
                .andExpect(jsonPath("$.battleReport").value("Epic battle!"))
                .andExpect(jsonPath("$.user1.username").value("user1"))
                .andExpect(jsonPath("$.user2.username").value("user2"));
    }

    @Test
    void testBattle_Error() throws Exception {
        // Arrange
        when(scanService.battle(anyString(), anyString())).thenThrow(new RuntimeException("Service Error"));

        // Act & Assert
        mockMvc.perform(get("/api/battle")
                        .param("u1", "user1")
                        .param("u2", "user2")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("An error occurred while processing the request"))
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));
    }

    @Test
    void testBattle_SameUserRejected() throws Exception {
        mockMvc.perform(get("/api/battle").param("u1", "octocat").param("u2", "OctoCat"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        verifyNoInteractions(scanService);
    }

    @Test
    void testScan_InvalidUsernameRejected() throws Exception {
        mockMvc.perform(get("/api/scan/-bad--name-"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    @Test
    void testScan_UserNotFoundMapsTo404() throws Exception {
        when(scanService.scan("ghost", "honest"))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "GITHUB_USER_NOT_FOUND", "User not found: ghost"));
        mockMvc.perform(get("/api/scan/ghost"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GITHUB_USER_NOT_FOUND"));
    }

    @Test
    void testDeepDive_BranchIsOptional() throws Exception {
        when(scanService.repoDeepDive("octocat", "hello", null)).thenReturn(new com.eggscan.dto.RepoDeepDiveResponse());
        mockMvc.perform(get("/api/scan/octocat/repo/hello"))
                .andExpect(status().isOk());
    }
}

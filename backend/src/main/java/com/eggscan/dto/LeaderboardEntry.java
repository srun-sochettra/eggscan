package com.eggscan.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardEntry {
    private String id;
    private String username;
    private String avatarUrl;
    private String vibe;
    private int eggScore;
    private String eggVerdict;
}
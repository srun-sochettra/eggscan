package com.eggscan.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class BattleResponse {
    private ScanResponse user1;
    private ScanResponse user2;
    private String winnerUsername;
    private String battleReport;
}
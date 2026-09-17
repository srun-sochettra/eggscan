package com.eggscan.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.jackson.Jacksonized;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Jacksonized
public class CommitShameResponse {
    private String summary;
    private int lazinessScore;
    private List<String> worstCommits;
    private String roast;
}
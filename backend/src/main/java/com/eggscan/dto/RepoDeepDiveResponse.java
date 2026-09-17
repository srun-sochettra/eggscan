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
public class RepoDeepDiveResponse {
    private String summary;
    private String architectureAndStack;
    private String codeStructureFeedback;
    private String commitQualityFeedback;
    private List<String> actionableImprovements;
}
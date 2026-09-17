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
public class ReadmeRaterResponse {
    private String summary;
    private int uselessnessScore;
    private List<String> nitpicks;
    private String roast;
    private String generatedReadme;
}
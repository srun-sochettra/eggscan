package com.eggscan.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.jackson.Jacksonized;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Jacksonized
public class StackRoastResponse {
    private String topLanguagesRoast;
    private String configDeepDiveRoast;
    private String overallVerdict;
}

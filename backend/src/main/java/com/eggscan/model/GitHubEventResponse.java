package com.eggscan.model;

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
public class GitHubEventResponse {
    private String type;
    private Repo repo;
    private Payload payload;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Jacksonized
    public static class Repo {
        private String name;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Jacksonized
    public static class Payload {
        private List<Commit> commits;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Jacksonized
    public static class Commit {
        private String sha;
        private String message;
    }
}
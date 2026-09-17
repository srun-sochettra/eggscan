package com.eggscan.model;

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
public class GitHubCommitResponse {
    private String sha;
    private Commit commit;

    @Data
@Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Jacksonized
    public static class Commit {
        private String message;
        private Author author;

        @Data
@Builder
        @NoArgsConstructor
        @AllArgsConstructor
        @Jacksonized
        public static class Author {
            private String name;
            private String email;
            private String date;
        }
    }
}
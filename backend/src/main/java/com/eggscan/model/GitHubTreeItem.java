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
public class GitHubTreeItem {
    private String path;
    private String mode;
    private String type;
    private String sha;
    private Long size;
    private String url;
}
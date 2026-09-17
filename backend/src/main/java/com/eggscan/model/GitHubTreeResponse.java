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
public class GitHubTreeResponse {
    private String sha;
    private String url;
    private List<GitHubTreeItem> tree;
    private Boolean truncated;
}
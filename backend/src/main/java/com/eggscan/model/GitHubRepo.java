package com.eggscan.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@lombok.NoArgsConstructor
@lombok.AllArgsConstructor
public class GitHubRepo {
    private Long id;
    private String name;
    private String full_name;
    private String description;
    private String language;
    private Integer stargazers_count;
    private Integer forks_count;
    private Boolean fork;
    private Boolean archived;
    private String pushed_at;
    private String created_at;
    private String html_url;
    private Integer size;
    private String default_branch;
}
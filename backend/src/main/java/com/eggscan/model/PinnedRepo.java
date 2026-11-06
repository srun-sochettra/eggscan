package com.eggscan.model;

import lombok.Data;

@Data
@lombok.NoArgsConstructor
@lombok.AllArgsConstructor
public class PinnedRepo {
    private String name;
    private String description;
    private String primaryLanguage;
    private int stars;
    private String url;
    /** Owner login; pinned repos can belong to an organisation or another user. */
    private String owner;
}

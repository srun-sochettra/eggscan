package com.eggscan.service;

import com.eggscan.exception.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class GroqService {

    // 1,200 tokens truncated longer answers (e.g. the generated README) mid-JSON.
    private static final int MAX_TOKENS = 4096;

    private final WebClient client;
    private final String model;
    private final boolean configured;
    private final ObjectMapper mapper = new ObjectMapper();

    public GroqService(@Qualifier("groqClient") WebClient groqClient,
                       @Value("${groq.model}") String model,
                       @Value("${groq.api-key:}") String apiKey) {
        this.client = groqClient;
        this.model = model;
        this.configured = apiKey != null && !apiKey.isBlank();
    }

    public JsonNode chatJson(String systemPrompt, String userPrompt) {
        if (!configured) {
            log.error("GROQ_API_KEY is not set");
            throw unavailable();
        }

        Map<String, Object> body = Map.of(
                "model", model,
                "temperature", 0.7,
                "max_tokens", MAX_TOKENS,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userPrompt)
                )
        );

        JsonNode resp;
        try {
            resp = client.post()
                    .uri("/chat/completions")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block();
        } catch (WebClientResponseException e) {
            log.warn("Groq request failed with HTTP {}", e.getStatusCode().value());
            throw unavailable();
        } catch (RuntimeException e) {
            log.warn("Groq request failed: {}", e.getMessage());
            throw unavailable();
        }

        String content = resp == null ? "" : resp.path("choices").path(0).path("message").path("content").asText("");
        JsonNode parsed = parseObject(content);
        if (parsed == null) {
            // Never put model output in the exception message: it ends up in client-facing errors/logs.
            log.warn("Groq returned non-JSON content ({} chars)", content.length());
            throw unavailable();
        }
        return parsed;
    }

    /** Parses a JSON object, tolerating Markdown fences or prose around it. */
    JsonNode parseObject(String content) {
        if (content == null) return null;
        String trimmed = content.trim().replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        for (String candidate : List.of(trimmed, slice(trimmed))) {
            if (candidate.isEmpty()) continue;
            try {
                JsonNode node = mapper.readTree(candidate);
                if (node != null && node.isObject()) return node;
            } catch (Exception ignored) {
                // try next candidate
            }
        }
        return null;
    }

    private static String slice(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        return start >= 0 && end > start ? text.substring(start, end + 1) : "";
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "AI_UNAVAILABLE", "Analysis is temporarily unavailable. Please try again shortly.");
    }
}

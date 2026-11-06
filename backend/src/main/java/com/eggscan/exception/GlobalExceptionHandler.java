package com.eggscan.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;

/**
 * Maps failures to honest HTTP statuses. Previously every failure (including GitHub
 * outages and our own bugs) was reported to clients as 400 Bad Request.
 * The body keeps the original {"error": "..."} shape and adds a "code" field.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, String>> handleMissingParameter(MissingServletRequestParameterException e) {
        return body(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Missing required parameter: " + e.getParameterName());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handle(Exception e) {
        Throwable cause = unwrap(e);
        if (cause instanceof ApiException api) {
            if (api.getStatus().is5xxServerError()) {
                log.warn("Upstream failure: {} {}", api.getCode(), api.getMessage());
            }
            return body(api.getStatus(), api.getCode(), api.getMessage());
        }
        if (cause instanceof ErrorResponse springError) {
            // Spring's own errors (unknown route, wrong HTTP method, ...) keep their real status
            // instead of being swallowed into a 500 by this catch-all handler.
            HttpStatus status = HttpStatus.resolve(springError.getStatusCode().value());
            if (status == null) status = HttpStatus.BAD_REQUEST;
            return body(status, "HTTP_" + status.value(), status.getReasonPhrase());
        }
        log.error("Unhandled error", e);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "An error occurred while processing the request");
    }

    private static Throwable unwrap(Throwable e) {
        Throwable current = e;
        while ((current instanceof CompletionException || current instanceof ExecutionException) && current.getCause() != null) {
            current = current.getCause();
        }
        return current;
    }

    private static ResponseEntity<Map<String, String>> body(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message, "code", code));
    }
}

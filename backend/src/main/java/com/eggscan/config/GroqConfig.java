package com.eggscan.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import reactor.util.retry.Retry;

import java.time.Duration;

@Configuration
public class GroqConfig {

    @Value("${groq.api-key}")
    private String apiKey;

    @Value("${groq.api-url}")
    private String apiUrl;

    @Bean
    @Qualifier("groqClient")
    public WebClient groqClient() {
        HttpClient httpClient = HttpClient.create()
                .responseTimeout(Duration.ofSeconds(60));

        return WebClient.builder()
                .baseUrl(apiUrl)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", "application/json")
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .codecs(c -> c.defaultCodecs().maxInMemorySize(2 * 1024 * 1024))
                .filter(retryFilter())
                .build();
    }

    private ExchangeFilterFunction retryFilter() {
        return (request, next) -> next.exchange(request)
                .flatMap(response -> {
                    if (response.statusCode().is5xxServerError()) {
                        return response.createException().flatMap(Mono::error);
                    }
                    return Mono.just(response);
                })
                .retryWhen(Retry.backoff(3, Duration.ofMillis(500))
                        .filter(throwable -> throwable instanceof org.springframework.web.reactive.function.client.WebClientResponseException &&
                                ((org.springframework.web.reactive.function.client.WebClientResponseException) throwable).getStatusCode().is5xxServerError()));
    }
}
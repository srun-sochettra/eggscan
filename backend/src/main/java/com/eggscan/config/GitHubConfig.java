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
public class GitHubConfig {

    @Value("${github.token}")
    private String token;

    @Value("${github.api-url}")
    private String apiUrl;

    @Value("${github.graphql-url}")
    private String graphqlUrl;

    @Bean
    @Qualifier("githubClient")
    public WebClient githubClient() {
        HttpClient httpClient = HttpClient.create()
                .responseTimeout(Duration.ofSeconds(10));

        return WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .baseUrl(apiUrl)
                .defaultHeader("Authorization", "Bearer " + token)
                .defaultHeader("Accept", "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
                .defaultHeader("User-Agent", "EggScan")
                .codecs(c -> c.defaultCodecs().maxInMemorySize(4 * 1024 * 1024))
                .filter(retryFilter())
                .build();
    }

    @Bean
    @Qualifier("githubGraphQLClient")
    public WebClient githubGraphQLClient() {
        HttpClient httpClient = HttpClient.create()
                .responseTimeout(Duration.ofSeconds(10));

        return WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .baseUrl(graphqlUrl)
                .defaultHeader("Authorization", "Bearer " + token)
                .defaultHeader("Content-Type", "application/json")
                .defaultHeader("User-Agent", "EggScan")
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
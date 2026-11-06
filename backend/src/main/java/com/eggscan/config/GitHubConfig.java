package com.eggscan.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import reactor.util.retry.Retry;

import java.time.Duration;

@Configuration
public class GitHubConfig {

    // Retries on 5xx only.
    private static final int RETRIES = 3;

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
                .defaultHeaders(this::addAuthorization)
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
                .defaultHeaders(this::addAuthorization)
                .defaultHeader("Content-Type", "application/json")
                .defaultHeader("User-Agent", "EggScan")
                .filter(retryFilter())
                .build();
    }

    /**
     * With no token configured the old code sent "Authorization: Bearer " (empty), which GitHub
     * rejects with 401 on every call. Unauthenticated REST calls work (with a lower rate limit).
     */
    private void addAuthorization(org.springframework.http.HttpHeaders headers) {
        if (token != null && !token.isBlank()) {
            headers.setBearerAuth(token.trim());
        }
    }

    private ExchangeFilterFunction retryFilter() {
        // Explicit Mono<ClientResponse> types: the Eclipse compiler used by VS Code could not
        // infer the generic type of the old Mono::error method reference.
        return (request, next) -> next.exchange(request)
                .flatMap(response -> {
                    if (response.statusCode().is5xxServerError()) {
                        return response.createException().flatMap(ex -> Mono.<ClientResponse>error(ex));
                    }
                    return Mono.just(response);
                })
                .retryWhen(Retry.backoff(RETRIES, Duration.ofMillis(500))
                        .filter(t -> t instanceof WebClientResponseException e && e.getStatusCode().is5xxServerError()));
    }
}

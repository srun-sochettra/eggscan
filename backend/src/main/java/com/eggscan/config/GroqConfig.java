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
public class GroqConfig {

    // 3 retries x 60s meant one request could hang for ~4 minutes.
    private static final int RETRIES = 1;

    @Value("${groq.api-key}")
    private String apiKey;

    @Value("${groq.api-url}")
    private String apiUrl;

    @Bean
    @Qualifier("groqClient")
    public WebClient groqClient() {
        HttpClient httpClient = HttpClient.create()
                .responseTimeout(Duration.ofSeconds(30));

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

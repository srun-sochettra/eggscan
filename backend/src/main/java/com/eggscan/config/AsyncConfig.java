package com.eggscan.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
public class AsyncConfig {

    @Bean(name = "scanExecutor")
    public Executor scanExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        // Battles run scans on this pool and those scans submit more work to it while blocking.
        // With a queue, the pool never grew past 10 threads and nested tasks could wait forever
        // (deadlock under load). No queue + CallerRunsPolicy means a task always gets a thread.
        executor.setQueueCapacity(0);
        executor.setRejectedExecutionHandler(new java.util.concurrent.ThreadPoolExecutor.CallerRunsPolicy());
        executor.setThreadNamePrefix("ScanExecutor-");
        executor.initialize();
        return executor;
    }
}

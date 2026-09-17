package com.eggscan.repository;

import com.eggscan.model.ScanRecord;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest
public class ScanRecordRepositoryTest {

    @Autowired
    private ScanRecordRepository repository;

    @Test
    public void testFindLeaderboard() {
        repository.save(ScanRecord.builder().id("1").username("user1").score(10).scannedAt(LocalDateTime.now()).build());
        repository.save(ScanRecord.builder().id("2").username("user1").score(20).scannedAt(LocalDateTime.now()).build());
        repository.save(ScanRecord.builder().id("3").username("user2").score(15).scannedAt(LocalDateTime.now()).build());

        List<ScanRecord> top = repository.findLeaderboard(PageRequest.of(0, 10));
        assertEquals(2, top.size());
        assertEquals("user1", top.get(0).getUsername());
        assertEquals(20, top.get(0).getScore());
        assertEquals("user2", top.get(1).getUsername());
        assertEquals(15, top.get(1).getScore());
    }
}
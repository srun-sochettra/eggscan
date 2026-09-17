package com.eggscan.repository;

import com.eggscan.model.ScanRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ScanRecordRepository extends JpaRepository<ScanRecord, String> {
    Optional<ScanRecord> findFirstByUsernameOrderByScannedAtDesc(String username);
    List<ScanRecord> findTop10ByOrderByScoreDesc();

    @Query("SELECT s FROM ScanRecord s WHERE s.id IN " +
           "(SELECT MIN(s2.id) FROM ScanRecord s2 WHERE s2.score = " +
           "(SELECT MAX(s3.score) FROM ScanRecord s3 WHERE s3.username = s2.username) " +
           "GROUP BY s2.username) " +
           "ORDER BY s.score DESC")
    List<ScanRecord> findLeaderboard(Pageable pageable);
}
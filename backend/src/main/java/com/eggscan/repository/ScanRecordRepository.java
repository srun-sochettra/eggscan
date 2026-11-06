package com.eggscan.repository;

import com.eggscan.model.ScanRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Rows written before the mode column existed have mode = NULL and are treated as honest scans. */
@Repository
public interface ScanRecordRepository extends JpaRepository<ScanRecord, String> {

    @Query("SELECT s FROM ScanRecord s WHERE LOWER(s.username) = LOWER(:username) " +
           "AND (s.mode = :mode OR (:mode = 'honest' AND s.mode IS NULL)) " +
           "ORDER BY s.scannedAt DESC")
    List<ScanRecord> findRecentByUsernameAndMode(@Param("username") String username, @Param("mode") String mode, Pageable pageable);

    @Query("SELECT s FROM ScanRecord s WHERE s.id IN " +
           "(SELECT MIN(s2.id) FROM ScanRecord s2 WHERE (s2.mode = 'honest' OR s2.mode IS NULL) AND s2.score = " +
           "(SELECT MAX(s3.score) FROM ScanRecord s3 WHERE s3.username = s2.username AND (s3.mode = 'honest' OR s3.mode IS NULL)) " +
           "GROUP BY s2.username) " +
           "ORDER BY s.score DESC")
    List<ScanRecord> findLeaderboard(Pageable pageable);
}

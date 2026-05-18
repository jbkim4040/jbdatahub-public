package com.jb.datahub.publicdata.repository;

import com.jb.datahub.publicdata.entity.CollectionLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CollectionLogRepository extends JpaRepository<CollectionLog, Long> {

    /** 최근 N건 (completedAt 내림차순) */
    List<CollectionLog> findAllByOrderByCompletedAtDesc(Pageable pageable);

    /** sourceType 별 최근 N건 */
    List<CollectionLog> findBySourceTypeOrderByCompletedAtDesc(String sourceType, Pageable pageable);
}

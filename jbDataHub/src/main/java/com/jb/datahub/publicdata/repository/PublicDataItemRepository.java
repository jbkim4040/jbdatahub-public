package com.jb.datahub.publicdata.repository;

import com.jb.datahub.publicdata.entity.PublicDataItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PublicDataItemRepository extends JpaRepository<PublicDataItem, String> {

    /** source_type 별 건수 */
    @Query("SELECT p.sourceType, COUNT(p) FROM PublicDataItem p GROUP BY p.sourceType ORDER BY p.sourceType")
    List<Object[]> countBySourceType();
}

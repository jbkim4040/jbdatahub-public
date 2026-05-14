package com.jb.datahub.publicdata.repository;

import com.jb.datahub.publicdata.entity.PublicDataItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PublicDataItemRepository extends JpaRepository<PublicDataItem, String> {

    /** source_type 별 건수 (전체) */
    @Query("SELECT p.sourceType, COUNT(p) FROM PublicDataItem p GROUP BY p.sourceType ORDER BY p.sourceType")
    List<Object[]> countBySourceType();

    /** 특정 source_type 총 건수 */
    long countBySourceType(String sourceType);

    /** 특정 source_type의 카테고리별 건수 (상위 10개) */
    @Query("SELECT p.newCategoryNm, COUNT(p) FROM PublicDataItem p " +
           "WHERE p.sourceType = :sourceType AND p.newCategoryNm IS NOT NULL " +
           "GROUP BY p.newCategoryNm ORDER BY COUNT(p) DESC")
    List<Object[]> countByCategoryBySourceType(@Param("sourceType") String sourceType, Pageable pageable);

    Page<PublicDataItem> findBySourceType(String sourceType, Pageable pageable);

    Page<PublicDataItem> findBySourceTypeAndTitleContainingIgnoreCase(String sourceType, String title, Pageable pageable);

    Page<PublicDataItem> findByTitleContainingIgnoreCase(String title, Pageable pageable);
}

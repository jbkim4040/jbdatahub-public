package com.jb.datahub.publicdata.repository;

import com.jb.datahub.publicdata.entity.PublicDataItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PublicDataItemRepository extends JpaRepository<PublicDataItem, String> {

    @Query("SELECT p.sourceType, COUNT(p) FROM PublicDataItem p GROUP BY p.sourceType ORDER BY p.sourceType")
    List<Object[]> countBySourceType();

    long countBySourceType(String sourceType);

    @Query("SELECT p.newCategoryNm, COUNT(p) FROM PublicDataItem p " +
           "WHERE p.sourceType = :sourceType AND p.newCategoryNm IS NOT NULL " +
           "GROUP BY p.newCategoryNm ORDER BY COUNT(p) DESC")
    List<Object[]> countByCategoryBySourceType(@Param("sourceType") String sourceType, Pageable pageable);

    @Query("SELECT COALESCE(p.ext, p.dataType, '미분류'), COUNT(p) FROM PublicDataItem p " +
           "WHERE p.sourceType = :sourceType " +
           "GROUP BY COALESCE(p.ext, p.dataType, '미분류') ORDER BY COUNT(p) DESC")
    List<Object[]> countByFormatBySourceType(@Param("sourceType") String sourceType, Pageable pageable);

    @Query("SELECT p FROM PublicDataItem p WHERE p.sourceType = :sourceType")
    List<PublicDataItem> findPageBySourceType(@Param("sourceType") String sourceType, Pageable pageable);

    @Query("SELECT COUNT(p) FROM PublicDataItem p WHERE p.sourceType = :sourceType")
    long countOnlyBySourceType(@Param("sourceType") String sourceType);

    @Query("SELECT COUNT(p) FROM PublicDataItem p")
    long countAll();

    @Query("SELECT p FROM PublicDataItem p")
    List<PublicDataItem> findAllItems(Pageable pageable);

    Page<PublicDataItem> findBySourceType(String sourceType, Pageable pageable);

    Page<PublicDataItem> findBySourceTypeAndTitleContainingIgnoreCase(String sourceType, String title, Pageable pageable);

    Page<PublicDataItem> findByTitleContainingIgnoreCase(String title, Pageable pageable);
}

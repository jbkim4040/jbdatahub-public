package com.jb.datahub.publicdata.repository;

import com.jb.datahub.publicdata.entity.PublicApiList;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PublicApiListRepository extends JpaRepository<PublicApiList, String> {

    /** list_title 포함 검색 (대소문자 무시) */
    Page<PublicApiList> findByListTitleContainingIgnoreCase(String listTitle, Pageable pageable);

    /** api_type 별 건수 */
    @Query("SELECT p.apiType, COUNT(p) FROM PublicApiList p GROUP BY p.apiType ORDER BY COUNT(p) DESC")
    List<Object[]> countByApiType();

    /** 신규 분류체계 별 건수 (상위 10개) */
    @Query("SELECT p.newCategoryNm, COUNT(p) FROM PublicApiList p " +
           "WHERE p.newCategoryNm IS NOT NULL " +
           "GROUP BY p.newCategoryNm ORDER BY COUNT(p) DESC")
    List<Object[]> countByCategory();

    /** 제공기관 별 건수 (상위 10개) */
    @Query("SELECT p.orgNm, COUNT(p) FROM PublicApiList p " +
           "WHERE p.orgNm IS NOT NULL " +
           "GROUP BY p.orgNm ORDER BY COUNT(p) DESC")
    List<Object[]> countByOrg(Pageable pageable);
}

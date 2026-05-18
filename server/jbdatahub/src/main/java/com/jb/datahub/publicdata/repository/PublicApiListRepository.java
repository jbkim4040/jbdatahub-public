package com.jb.datahub.publicdata.repository;

import com.jb.datahub.publicdata.entity.PublicApiList;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PublicApiListRepository extends JpaRepository<PublicApiList, String> {

    @Query(value = "SELECT p FROM PublicApiList p WHERE LOWER(p.listTitle) LIKE LOWER(CONCAT('%', :title, '%'))",
           countQuery = "SELECT COUNT(p) FROM PublicApiList p WHERE LOWER(p.listTitle) LIKE LOWER(CONCAT('%', :title, '%'))")
    Page<PublicApiList> findByListTitleContainingIgnoreCase(@Param("title") String listTitle, Pageable pageable);

    @Query("SELECT p.apiType, COUNT(p) FROM PublicApiList p GROUP BY p.apiType ORDER BY COUNT(p) DESC")
    List<Object[]> countByApiType();

    @Query("SELECT p.newCategoryNm, COUNT(p) FROM PublicApiList p " +
           "WHERE p.newCategoryNm IS NOT NULL " +
           "GROUP BY p.newCategoryNm ORDER BY COUNT(p) DESC")
    List<Object[]> countByCategory();

    @Query("SELECT COUNT(p) FROM PublicApiList p")
    long countAll();

    @Query("SELECT p FROM PublicApiList p")
    List<PublicApiList> findAllLists(Pageable pageable);

    @Query("SELECT p.orgNm, COUNT(p) FROM PublicApiList p " +
           "WHERE p.orgNm IS NOT NULL " +
           "GROUP BY p.orgNm ORDER BY COUNT(p) DESC")
    List<Object[]> countByOrg(Pageable pageable);
}

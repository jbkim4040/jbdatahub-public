package com.jb.datahub.publicdata.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * 공공데이터포털 데이터셋 / 파일데이터 / 표준데이터 통합 엔티티
 * source_type: 'dataset' | 'file-data' | 'standard-data'
 */
@Entity
@Table(name = "public_data_item")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PublicDataItem {

    @Id
    @Column(name = "id", length = 200, nullable = false)
    private String id;

    /** 데이터 출처 구분: dataset / file-data / standard-data */
    @Column(name = "source_type", length = 20, nullable = false)
    private String sourceType;

    @Column(name = "list_id", length = 50)
    private String listId;

    @Column(name = "list_title", length = 300)
    private String listTitle;

    @Column(name = "list_type", length = 20)
    private String listType;

    @Column(name = "title", length = 300)
    private String title;

    @Column(name = "org_cd", length = 20)
    private String orgCd;

    @Column(name = "org_nm", length = 200)
    private String orgNm;

    @Column(name = "dept_nm", length = 200)
    private String deptNm;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "keywords", length = 500)
    private String keywords;

    @Column(name = "new_category_cd", length = 20)
    private String newCategoryCd;

    @Column(name = "new_category_nm", length = 100)
    private String newCategoryNm;

    @Column(name = "category_nm", length = 200)
    private String categoryNm;

    @Column(name = "created_at")
    private LocalDate createdAt;

    @Column(name = "updated_at")
    private LocalDate updatedAt;

    @Column(name = "download_cnt")
    private Integer downloadCnt;

    @Column(name = "view_cnt")
    private Integer viewCnt;

    @Column(name = "req_cnt")
    private Integer reqCnt;

    @Column(name = "register_status", length = 50)
    private String registerStatus;

    @Column(name = "is_deleted", length = 5)
    private String isDeleted;

    @Column(name = "ext", length = 20)
    private String ext;

    @Column(name = "data_type", length = 50)
    private String dataType;

    @Column(name = "meta_url", length = 500)
    private String metaUrl;

    @Column(name = "page_url", length = 500)
    private String pageUrl;

    @Column(name = "is_charged", length = 20)
    private String isCharged;

    @Column(name = "is_core_data", length = 5)
    private String isCoreData;

    @Column(name = "is_std_data", length = 5)
    private String isStdData;

    @Column(name = "ownership_grounds", columnDefinition = "TEXT")
    private String ownershipGrounds;

    @Column(name = "providing_scope", length = 20)
    private String providingScope;

    @Column(name = "share_scope_nm", length = 100)
    private String shareScopeNm;

    @Column(name = "update_cycle", length = 50)
    private String updateCycle;
}

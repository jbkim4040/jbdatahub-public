package com.jb.datahub.publicdata.dto;

import com.jb.datahub.publicdata.entity.PublicDataItem;
import lombok.Getter;

import java.time.LocalDate;

/** PublicDataItem 엔티티 → 목록 조회 응답 DTO */
@Getter
public class PublicDataItemResponseDto {

    private final String id;
    private final String sourceType;
    private final String title;
    private final String orgNm;
    private final String deptNm;
    private final String newCategoryNm;
    private final String categoryNm;
    private final LocalDate createdAt;
    private final LocalDate updatedAt;
    private final Integer downloadCnt;
    private final Integer viewCnt;
    private final Integer reqCnt;
    private final String ext;
    private final String dataType;
    private final String pageUrl;
    private final String isCharged;
    private final String keywords;
    private final String updateCycle;

    public PublicDataItemResponseDto(PublicDataItem e) {
        this.id            = e.getId();
        this.sourceType    = e.getSourceType();
        this.title         = e.getTitle();
        this.orgNm         = e.getOrgNm();
        this.deptNm        = e.getDeptNm();
        this.newCategoryNm = e.getNewCategoryNm();
        this.categoryNm    = e.getCategoryNm();
        this.createdAt     = e.getCreatedAt();
        this.updatedAt     = e.getUpdatedAt();
        this.downloadCnt   = e.getDownloadCnt();
        this.viewCnt       = e.getViewCnt();
        this.reqCnt        = e.getReqCnt();
        this.ext           = e.getExt();
        this.dataType      = e.getDataType();
        this.pageUrl       = e.getPageUrl();
        this.isCharged     = e.getIsCharged();
        this.keywords      = e.getKeywords();
        this.updateCycle   = e.getUpdateCycle();
    }
}

package com.jb.datahub.publicdata.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 공공데이터포털 dataset / file-data-list / standard-data-list 공통 응답 항목 DTO
 */
@Getter
@NoArgsConstructor
public class PublicDataItemDto {

    @JsonProperty("id")
    private String id;

    @JsonProperty("list_id")
    private String listId;

    @JsonProperty("list_title")
    private String listTitle;

    @JsonProperty("list_type")
    private String listType;

    @JsonProperty("title")
    private String title;

    @JsonProperty("org_cd")
    private String orgCd;

    @JsonProperty("org_nm")
    private String orgNm;

    @JsonProperty("dept_nm")
    private String deptNm;

    @JsonProperty("desc")
    private String desc;

    @JsonProperty("keywords")
    private String keywords;

    @JsonProperty("new_category_cd")
    private String newCategoryCd;

    @JsonProperty("new_category_nm")
    private String newCategoryNm;

    @JsonProperty("category_cd")
    private String categoryCd;

    @JsonProperty("category_nm")
    private String categoryNm;

    @JsonProperty("created_at")
    private String createdAt;

    /** standard-data-list 는 updated_dt, 나머지는 updated_at */
    @JsonAlias("updated_dt")
    @JsonProperty("updated_at")
    private String updatedAt;

    @JsonProperty("download_cnt")
    private Integer downloadCnt;

    @JsonProperty("view_cnt")
    private Integer viewCnt;

    @JsonProperty("req_cnt")
    private Integer reqCnt;

    @JsonProperty("register_status")
    private String registerStatus;

    @JsonProperty("is_deleted")
    private String isDeleted;

    @JsonProperty("is_list_deleted")
    private String isListDeleted;

    @JsonProperty("ext")
    private String ext;

    @JsonProperty("data_type")
    private String dataType;

    @JsonProperty("media_type")
    private String mediaType;

    @JsonProperty("media_cnt")
    private String mediaCnt;

    @JsonProperty("meta_url")
    private String metaUrl;

    @JsonProperty("page_url")
    private String pageUrl;

    @JsonProperty("swagger_json_url")
    private String swaggerJsonUrl;

    @JsonProperty("is_charged")
    private String isCharged;

    @JsonProperty("is_copyrighted")
    private String isCopyrighted;

    @JsonProperty("is_core_data")
    private String isCoreData;

    @JsonProperty("core_data_nm")
    private String coreDataNm;

    @JsonProperty("is_std_data")
    private String isStdData;

    @JsonProperty("is_requested_data")
    private String isRequestedData;

    @JsonProperty("is_third_party_copyrighted")
    private String isThirdPartyCopyrighted;

    @JsonProperty("ownership_grounds")
    private String ownershipGrounds;

    @JsonProperty("providing_scope")
    private String providingScope;

    @JsonProperty("share_scope_nm")
    private String shareScopeNm;

    @JsonProperty("collection_method")
    private String collectionMethod;

    @JsonProperty("update_cycle")
    private String updateCycle;

    @JsonProperty("next_registration_date")
    private String nextRegistrationDate;

    @JsonProperty("regist_type")
    private String registType;
}

package com.jb.datahub.publicdata.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 공공데이터포털 OpenAPI 목록 조회 - 개별 항목 DTO
 * data[] 배열의 각 요소에 해당
 */
@Getter
@NoArgsConstructor
public class PublicApiItemDto {

    /* ===================== List 레벨 ===================== */

    @JsonProperty("list_id")
    private String listId;

    @JsonProperty("list_title")
    private String listTitle;

    @JsonProperty("list_type")
    private String listType;

    /* ===================== API 서비스 레벨 ===================== */

    /** API 기본키 (UDDI) */
    @JsonProperty("id")
    private String id;

    @JsonProperty("api_type")
    private String apiType;

    @JsonProperty("data_format")
    private String dataFormat;

    @JsonProperty("title")
    private String title;

    @JsonProperty("title_en")
    private String titleEn;

    @JsonProperty("org_cd")
    private String orgCd;

    @JsonProperty("org_nm")
    private String orgNm;

    @JsonProperty("dept_nm")
    private String deptNm;

    @JsonProperty("category_nm")
    private String categoryNm;

    @JsonProperty("new_category_cd")
    private String newCategoryCd;

    @JsonProperty("new_category_nm")
    private String newCategoryNm;

    @JsonProperty("upper_category_cd")
    private String upperCategoryCd;

    @JsonProperty("share_scope_cd")
    private String shareScopeCd;

    @JsonProperty("share_scope_nm")
    private String shareScopeNm;

    @JsonProperty("guide_url")
    private String guideUrl;

    @JsonProperty("end_point_url")
    private String endPointUrl;

    @JsonProperty("soap_url")
    private String soapUrl;

    @JsonProperty("link_url")
    private String linkUrl;

    @JsonProperty("meta_url")
    private String metaUrl;

    @JsonProperty("desc")
    private String desc;

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

    @JsonProperty("is_list_deleted")
    private String isListDeleted;

    @JsonProperty("is_deleted")
    private String isDeleted;

    @JsonProperty("is_confirmed_for_dev")
    private String isConfirmedForDev;

    @JsonProperty("is_confirmed_for_dev_nm")
    private String isConfirmedForDevNm;

    @JsonProperty("is_confirmed_for_prod")
    private String isConfirmedForProd;

    @JsonProperty("is_confirmed_for_prod_nm")
    private String isConfirmedForProdNm;

    @JsonProperty("ownership_grounds")
    private String ownershipGrounds;

    @JsonProperty("is_third_party_copyrighted")
    private String isThirdPartyCopyrighted;

    @JsonProperty("use_prmisn_ennc")
    private String usePrmisnEnnc;

    @JsonProperty("keywords")
    private String keywords;

    @JsonProperty("request_cnt")
    private Integer requestCnt;

    @JsonProperty("use_scope_resn")
    private String useScopeResn;

    @JsonProperty("created_at")
    private String createdAt;

    @JsonProperty("updated_at")
    private String updatedAt;

    /* ===================== Operation 레벨 ===================== */

    @JsonProperty("operation_seq")
    private String operationSeq;

    @JsonProperty("operation_nm")
    private String operationNm;

    @JsonProperty("operation_url")
    private String operationUrl;

    @JsonProperty("register_status")
    private String registerStatus;

    @JsonProperty("request_param_nm")
    private String requestParamNm;

    @JsonProperty("request_param_nm_en")
    private String requestParamNmEn;

    @JsonProperty("response_param_nm")
    private String responseParamNm;

    @JsonProperty("response_param_nm_en")
    private String responseParamNmEn;
}

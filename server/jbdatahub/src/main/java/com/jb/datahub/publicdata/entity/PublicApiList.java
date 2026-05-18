package com.jb.datahub.publicdata.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 공공데이터 OpenAPI 목록 (list_id 기준 서비스 단위)
 */
@Entity
@Table(name = "public_api_list")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = "operations")
public class PublicApiList {

    /** 목록 기본키 */
    @Id
    @Column(name = "list_id", length = 20, nullable = false)
    private String listId;

    /** 목록명 */
    @Column(name = "list_title", length = 300)
    private String listTitle;

    /** 공공데이터 유형 코드 */
    @Column(name = "list_type", length = 20)
    private String listType;

    /** API 기본키 (UDDI) */
    @Column(name = "api_id", length = 200)
    private String apiId;

    /** 공공데이터 유형 (REST / SOAP) */
    @Column(name = "api_type", length = 20)
    private String apiType;

    /** 데이터 유형 (XML / JSON 등) */
    @Column(name = "data_format", length = 50)
    private String dataFormat;

    /** 서비스명 */
    @Column(name = "title", length = 300)
    private String title;

    /** 서비스 영문명 */
    @Column(name = "title_en", length = 300)
    private String titleEn;

    /** 제공기관코드 */
    @Column(name = "org_cd", length = 20)
    private String orgCd;

    /** 제공기관명 */
    @Column(name = "org_nm", length = 200)
    private String orgNm;

    /** 관리부서명 */
    @Column(name = "dept_nm", length = 200)
    private String deptNm;

    /** BRM 코드명 */
    @Column(name = "category_nm", length = 200)
    private String categoryNm;

    /** 신규 분류체계 코드 */
    @Column(name = "new_category_cd", length = 20)
    private String newCategoryCd;

    /** 신규 분류체계명 */
    @Column(name = "new_category_nm", length = 100)
    private String newCategoryNm;

    /** BRM 상위 코드 */
    @Column(name = "upper_category_cd", length = 100)
    private String upperCategoryCd;

    /** 공유 범위 코드 */
    @Column(name = "share_scope_cd", length = 20)
    private String shareScopeCd;

    /** 공유 범위 */
    @Column(name = "share_scope_nm", length = 100)
    private String shareScopeNm;

    /** 서비스 안내 URL */
    @Column(name = "guide_url", length = 500)
    private String guideUrl;

    /** end point url */
    @Column(name = "end_point_url", length = 500)
    private String endPointUrl;

    /** soap url */
    @Column(name = "soap_url", length = 500)
    private String soapUrl;

    /** link url */
    @Column(name = "link_url", length = 500)
    private String linkUrl;

    /** 메타데이터 url */
    @Column(name = "meta_url", length = 500)
    private String metaUrl;

    /** 목록설명 */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /** 비용 부과 유무 */
    @Column(name = "is_charged", length = 20)
    private String isCharged;

    /** 저작권 여부 */
    @Column(name = "is_copyrighted", length = 5)
    private String isCopyrighted;

    /** 국가중점여부 */
    @Column(name = "is_core_data", length = 5)
    private String isCoreData;

    /** 국가중점명 */
    @Column(name = "core_data_nm", length = 500)
    private String coreDataNm;

    /** 표준데이터 여부 */
    @Column(name = "is_std_data", length = 5)
    private String isStdData;

    /** 목록 폐기 여부 */
    @Column(name = "is_list_deleted", length = 5)
    private String isListDeleted;

    /** API서비스 폐기 여부 */
    @Column(name = "is_deleted", length = 5)
    private String isDeleted;

    /** 테스트 단계 자동 승인 여부 코드 */
    @Column(name = "is_confirmed_for_dev", length = 5)
    private String isConfirmedForDev;

    /** 테스트 단계 자동 승인 여부명 */
    @Column(name = "is_confirmed_for_dev_nm", length = 20)
    private String isConfirmedForDevNm;

    /** 운영단계 자동 승인 여부 코드 */
    @Column(name = "is_confirmed_for_prod", length = 5)
    private String isConfirmedForProd;

    /** 운영단계 자동 승인 여부명 */
    @Column(name = "is_confirmed_for_prod_nm", length = 20)
    private String isConfirmedForProdNm;

    /** 데이터 보유근거 */
    @Column(name = "ownership_grounds", columnDefinition = "TEXT")
    private String ownershipGrounds;

    /** 제3자권리포함유무 */
    @Column(name = "is_third_party_copyrighted", length = 50)
    private String isThirdPartyCopyrighted;

    /** 권리이용허가유무 */
    @Column(name = "use_prmisn_ennc", length = 50)
    private String usePrmisnEnnc;

    /** 키워드 */
    @Column(name = "keywords", length = 500)
    private String keywords;

    /** 활용수 */
    @Column(name = "request_cnt")
    private Integer requestCnt;

    /** 공유 범위 근거 */
    @Column(name = "use_scope_resn", columnDefinition = "TEXT")
    private String useScopeResn;

    /** 등록일 */
    @Column(name = "created_at")
    private LocalDate createdAt;

    /** 수정일 */
    @Column(name = "updated_at")
    private LocalDate updatedAt;

    /** 오퍼레이션 목록 (1:N) */
    @OneToMany(mappedBy = "publicApiList", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<PublicApiOperation> operations = new ArrayList<>();
}

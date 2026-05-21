package com.jb.datahub.publicdata.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 공공데이터 OpenAPI 오퍼레이션 (operation_seq 기준 개별 API 오퍼레이션)
 */
@Entity
@Table(name = "public_api_operation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = "publicApiList")
public class PublicApiOperation {

    /** 오퍼레이션 일련 번호 (PK) */
    @Id
    @Column(name = "operation_seq", nullable = false)
    private Long operationSeq;

    /** 상위 목록 (FK → public_api_list.list_id) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "list_id", nullable = false)
    private PublicApiList publicApiList;

    /** 오퍼레이션명 */
    @Column(name = "operation_nm", length = 300)
    private String operationNm;

    /** 오퍼레이션 URL */
    @Column(name = "operation_url", length = 500)
    private String operationUrl;

    /** 상태명 */
    @Column(name = "register_status", length = 50)
    private String registerStatus;

    /** 요청변수명 (한글) */
    @Column(name = "request_param_nm", columnDefinition = "TEXT")
    private String requestParamNm;

    /** 요청변수 영문명 */
    @Column(name = "request_param_nm_en", columnDefinition = "TEXT")
    private String requestParamNmEn;

    /** 필수 요청변수 영문명 (콤마 구분) */
    @Column(name = "required_param_nm_en", columnDefinition = "TEXT")
    private String requiredParamNmEn;

    /** 요청변수 예시값 (JSON: {"key":"val"}) */
    @Column(name = "example_param_nm_en", columnDefinition = "TEXT")
    private String exampleParamNmEn;

    /** 응답변수명 (한글) */
    @Column(name = "response_param_nm", columnDefinition = "TEXT")
    private String responseParamNm;

    /** 응답변수 영문명 */
    @Column(name = "response_param_nm_en", columnDefinition = "TEXT")
    private String responseParamNmEn;

    /** 자동 생성된 DDL */
    @Column(name = "generated_ddl", columnDefinition = "TEXT")
    private String generatedDdl;
}

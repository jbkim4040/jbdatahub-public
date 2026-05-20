package com.jb.datahub.publicdata.dto;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import java.util.Map;

/**
 * 공공 API 호출(프록시) 요청 DTO
 * - operationSeq 가 있으면 저장된 오퍼레이션의 URL 을 사용
 * - 없으면 endpointUrl 을 직접 사용
 */
@Getter
@Setter
@ToString(exclude = "serviceKey")  // 로그에 인증키 원문이 남지 않도록 제외
public class InvokeRequestDto {

    /** 저장된 오퍼레이션 일련번호 (선택) */
    private Long operationSeq;

    /** 직접 호출할 엔드포인트 URL (operationSeq 미지정 시 필수) */
    private String endpointUrl;

    /** 사용자의 공공데이터포털 인증키 (Encoding 키) */
    private String serviceKey;

    /** 추가 쿼리 파라미터 */
    private Map<String, String> params;
}

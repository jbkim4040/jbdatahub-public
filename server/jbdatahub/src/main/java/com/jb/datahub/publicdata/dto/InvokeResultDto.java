package com.jb.datahub.publicdata.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * 공공 API 호출(프록시) 결과 DTO
 */
@Getter
@Builder
public class InvokeResultDto {

    /** success / fail */
    private String status;

    /** 업스트림 응답 HTTP 상태코드 */
    private Integer httpStatus;

    /** 업스트림 응답 Content-Type */
    private String contentType;

    /** 업스트림 응답 본문 (JSON/XML 원본) */
    private String body;

    /** 호출 소요 시간(ms) */
    private long elapsedMs;

    /** 실제 호출한 URL (인증키는 마스킹) */
    private String requestUrl;

    /** 실패 사유 */
    private String message;

    public static InvokeResultDto success(int httpStatus, String contentType,
                                          String body, long elapsedMs, String requestUrl) {
        return InvokeResultDto.builder()
                .status("success")
                .httpStatus(httpStatus)
                .contentType(contentType)
                .body(body)
                .elapsedMs(elapsedMs)
                .requestUrl(requestUrl)
                .build();
    }

    public static InvokeResultDto fail(String message) {
        return InvokeResultDto.builder()
                .status("fail")
                .message(message)
                .build();
    }
}

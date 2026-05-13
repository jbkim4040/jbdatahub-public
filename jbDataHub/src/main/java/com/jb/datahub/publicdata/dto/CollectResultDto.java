package com.jb.datahub.publicdata.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * 수집 작업 결과 응답 DTO
 */
@Getter
@Builder
public class CollectResultDto {

    private String status;
    private int page;
    private int totalCount;
    private int savedCount;
    private String message;

    public static CollectResultDto success(int page, int totalCount, int savedCount) {
        return CollectResultDto.builder()
                .status("success")
                .page(page)
                .totalCount(totalCount)
                .savedCount(savedCount)
                .build();
    }

    public static CollectResultDto fail(String message) {
        return CollectResultDto.builder()
                .status("fail")
                .message(message)
                .build();
    }
}

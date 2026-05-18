package com.jb.datahub.publicdata.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 공공데이터포털 OpenAPI 목록 조회 응답 최상위 DTO
 */
@Getter
@NoArgsConstructor
public class PublicApiResponseDto {

    @JsonProperty("page")
    private int page;

    @JsonProperty("perPage")
    private int perPage;

    @JsonProperty("totalCount")
    private int totalCount;

    @JsonProperty("currentCount")
    private int currentCount;

    @JsonProperty("matchCount")
    private int matchCount;

    @JsonProperty("data")
    private List<PublicApiItemDto> data;
}

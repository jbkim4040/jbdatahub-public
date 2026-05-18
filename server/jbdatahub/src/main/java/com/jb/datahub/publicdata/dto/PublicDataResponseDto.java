package com.jb.datahub.publicdata.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * dataset / file-data-list / standard-data-list 응답 최상위 DTO
 */
@Getter
@NoArgsConstructor
public class PublicDataResponseDto {

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
    private List<PublicDataItemDto> data;
}

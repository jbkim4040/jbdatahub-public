package com.jb.datahub.publicdata.dto;

import com.jb.datahub.publicdata.entity.PublicApiList;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Builder
public class PublicApiDetailDto {

    private String listId;
    private String listTitle;
    private String apiType;
    private String dataFormat;
    private String orgNm;
    private String deptNm;
    private String newCategoryNm;
    private String description;
    private String keywords;
    private String isCharged;
    private String endPointUrl;
    private String guideUrl;
    private LocalDate updatedAt;

    private List<PublicApiOperationDto> operations;

    public static PublicApiDetailDto from(PublicApiList e, List<PublicApiOperationDto> ops) {
        return PublicApiDetailDto.builder()
                .listId(e.getListId())
                .listTitle(e.getListTitle())
                .apiType(e.getApiType())
                .dataFormat(e.getDataFormat())
                .orgNm(e.getOrgNm())
                .deptNm(e.getDeptNm())
                .newCategoryNm(e.getNewCategoryNm())
                .description(e.getDescription())
                .keywords(e.getKeywords())
                .isCharged(e.getIsCharged())
                .endPointUrl(e.getEndPointUrl())
                .guideUrl(e.getGuideUrl())
                .updatedAt(e.getUpdatedAt())
                .operations(ops)
                .build();
    }
}

package com.jb.datahub.publicdata.dto;

import com.jb.datahub.publicdata.entity.PublicApiList;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;

@Getter
@Builder
public class PublicApiListDto {

    private String listId;
    private String listTitle;
    private String apiType;
    private String dataFormat;
    private String title;
    private String orgNm;
    private String newCategoryNm;
    private String isCharged;
    private String isDeleted;
    private Integer requestCnt;
    private LocalDate updatedAt;

    public static PublicApiListDto from(PublicApiList e) {
        return PublicApiListDto.builder()
                .listId(e.getListId())
                .listTitle(e.getListTitle())
                .apiType(e.getApiType())
                .dataFormat(e.getDataFormat())
                .title(e.getTitle())
                .orgNm(e.getOrgNm())
                .newCategoryNm(e.getNewCategoryNm())
                .isCharged(e.getIsCharged())
                .isDeleted(e.getIsDeleted())
                .requestCnt(e.getRequestCnt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}

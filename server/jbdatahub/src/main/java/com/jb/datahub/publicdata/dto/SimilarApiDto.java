package com.jb.datahub.publicdata.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SimilarApiDto {
    private String listId;
    private String listTitle;
    private String orgNm;
    private String categoryNm;
    private double score;
}

package com.jb.datahub.publicdata.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class RelatedDatasetDto {
    private String  listId;
    private String  listTitle;
    private String  title;
    private String  orgNm;
    private String  categoryNm;
    private Integer requestCnt;
    private Double  score;
}

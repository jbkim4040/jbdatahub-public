package com.jb.datahub.publicdata.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
@Builder
public class DataItemStatsDto {
    private long totalCount;
    private List<Map<String, Object>> countByCategory;
}

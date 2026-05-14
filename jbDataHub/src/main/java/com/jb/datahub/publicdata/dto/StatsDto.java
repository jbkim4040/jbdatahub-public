package com.jb.datahub.publicdata.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
@Builder
public class StatsDto {

    private long totalCount;
    private Map<String, Long> countByApiType;
    private List<Map<String, Object>> countByCategory;
    private List<Map<String, Object>> countByOrg;
}

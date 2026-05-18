package com.jb.datahub.publicdata.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TopicDto {
    private int topicId;
    private String topicKeywords;
    private long itemCount;
}

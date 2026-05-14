package com.jb.datahub.publicdata.dto;

import com.jb.datahub.publicdata.entity.CollectionLog;
import lombok.Getter;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Getter
public class CollectionLogDto {

    private final Long id;
    private final String sourceType;
    private final String status;
    private final int totalSaved;
    private final int totalCount;
    private final LocalDateTime startedAt;
    private final LocalDateTime completedAt;
    private final long durationSecs;

    public CollectionLogDto(CollectionLog log) {
        this.id           = log.getId();
        this.sourceType   = log.getSourceType();
        this.status       = log.getStatus();
        this.totalSaved   = log.getTotalSaved();
        this.totalCount   = log.getTotalCount();
        this.startedAt    = log.getStartedAt();
        this.completedAt  = log.getCompletedAt();
        this.durationSecs = (log.getStartedAt() != null && log.getCompletedAt() != null)
                ? ChronoUnit.SECONDS.between(log.getStartedAt(), log.getCompletedAt())
                : 0;
    }
}

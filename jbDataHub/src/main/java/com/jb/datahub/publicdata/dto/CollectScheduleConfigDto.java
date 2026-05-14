package com.jb.datahub.publicdata.dto;

import com.jb.datahub.publicdata.entity.CollectScheduleConfig;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor
public class CollectScheduleConfigDto {
    private boolean enabled;
    private int hour;
    private int minute;
    private String sourceType;
    private LocalDateTime lastRunAt;
    private LocalDateTime updatedAt;

    public CollectScheduleConfigDto(CollectScheduleConfig config) {
        this.enabled    = config.isEnabled();
        this.hour       = config.getHour();
        this.minute     = config.getMinute();
        this.sourceType = config.getSourceType();
        this.lastRunAt  = config.getLastRunAt();
        this.updatedAt  = config.getUpdatedAt();
    }
}

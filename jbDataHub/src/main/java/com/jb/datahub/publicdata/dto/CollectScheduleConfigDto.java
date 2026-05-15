package com.jb.datahub.publicdata.dto;

import com.jb.datahub.publicdata.entity.CollectScheduleConfig;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor
public class CollectScheduleConfigDto {
    private boolean     enabled;
    private String      scheduleType; // DAILY | HOURLY | WEEKLY | MONTHLY
    private int         hour;
    private int         minute;
    private int         intervalHours;
    private int         dayOfWeek;
    private int         dayOfMonth;
    private String      sourceType;
    private LocalDateTime lastRunAt;
    private LocalDateTime updatedAt;

    public CollectScheduleConfigDto(CollectScheduleConfig c) {
        this.enabled       = c.isEnabled();
        this.scheduleType  = c.getScheduleType() != null ? c.getScheduleType() : "DAILY";
        this.hour          = c.getHour();
        this.minute        = c.getMinute();
        this.intervalHours = c.getIntervalHours() > 0 ? c.getIntervalHours() : 1;
        this.dayOfWeek     = c.getDayOfWeek() > 0 ? c.getDayOfWeek() : 1;
        this.dayOfMonth    = c.getDayOfMonth() > 0 ? c.getDayOfMonth() : 1;
        this.sourceType    = c.getSourceType();
        this.lastRunAt     = c.getLastRunAt();
        this.updatedAt     = c.getUpdatedAt();
    }
}

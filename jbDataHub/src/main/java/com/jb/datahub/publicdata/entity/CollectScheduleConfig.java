package com.jb.datahub.publicdata.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * scheduleType: DAILY | HOURLY | WEEKLY | MONTHLY
 * - DAILY   : 매일 hour:minute 에 실행
 * - HOURLY  : intervalHours 간격으로 실행
 * - WEEKLY  : 매주 dayOfWeek(1=월 ~ 7=일) hour:minute 에 실행
 * - MONTHLY : 매월 dayOfMonth 일 hour:minute 에 실행
 */
@Entity
@Table(name = "collect_schedule_config")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CollectScheduleConfig {

    @Id
    private String id;

    private boolean enabled;

    @Column(length = 20)
    @Builder.Default
    private String scheduleType = "DAILY";

    private int hour;
    private int minute;

    /** HOURLY: 몇 시간 간격 (기본 1) */
    @Builder.Default
    private int intervalHours = 1;

    /** WEEKLY: 1=월 ~ 7=일 */
    @Builder.Default
    private int dayOfWeek = 1;

    /** MONTHLY: 1~31 */
    @Builder.Default
    private int dayOfMonth = 1;

    @Column(length = 30)
    @Builder.Default
    private String sourceType = "openapi";

    private LocalDateTime lastRunAt;
    private LocalDateTime updatedAt;

    public static CollectScheduleConfig createDefault() {
        return CollectScheduleConfig.builder()
                .id("default")
                .enabled(false)
                .scheduleType("DAILY")
                .hour(2)
                .minute(0)
                .intervalHours(1)
                .dayOfWeek(1)
                .dayOfMonth(1)
                .sourceType("openapi")
                .build();
    }
}

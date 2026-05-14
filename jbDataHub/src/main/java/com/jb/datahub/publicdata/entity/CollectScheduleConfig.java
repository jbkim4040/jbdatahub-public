package com.jb.datahub.publicdata.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "collect_schedule_config")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CollectScheduleConfig {

    @Id
    private String id;

    private boolean enabled;
    private int hour;
    private int minute;
    private String sourceType; // openapi, dataset, file-data, standard-data

    private LocalDateTime lastRunAt;
    private LocalDateTime updatedAt;

    public static CollectScheduleConfig createDefault() {
        return CollectScheduleConfig.builder()
                .id("default")
                .enabled(false)
                .hour(2)
                .minute(0)
                .sourceType("openapi")
                .build();
    }
}

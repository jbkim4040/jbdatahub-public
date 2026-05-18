package com.jb.datahub.publicdata.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "collection_log")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollectionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_type", length = 20, nullable = false)
    private String sourceType;

    /** DONE / STOPPED */
    @Column(name = "status", length = 10, nullable = false)
    private String status;

    @Column(name = "total_saved", nullable = false)
    private int totalSaved;

    @Column(name = "total_count")
    private int totalCount;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}

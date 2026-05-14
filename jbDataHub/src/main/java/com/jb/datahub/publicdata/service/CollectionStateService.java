package com.jb.datahub.publicdata.service;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 수집 작업의 실행 상태 및 진행률을 관리
 */
@Service
public class CollectionStateService {

    public enum Status { IDLE, RUNNING, STOPPED, DONE }

    /** 중지 요청 플래그 */
    private final AtomicBoolean stopRequested = new AtomicBoolean(false);

    /** 현재 수집 상태 */
    private volatile Status status = Status.IDLE;
    private volatile String currentSourceType = null;
    private volatile int currentPage = 0;
    private volatile int totalCount = 0;
    private volatile int savedCount = 0;
    private volatile LocalDateTime startedAt = null;

    /** 타입별 마지막 수집 완료 이력 */
    private final Map<String, TypeHistory> history = new ConcurrentHashMap<>();

    // ─── 수집 제어 ─────────────────────────────────────────────

    public boolean isRunning() {
        return status == Status.RUNNING;
    }

    public void startCollection(String sourceType) {
        stopRequested.set(false);
        this.status          = Status.RUNNING;
        this.currentSourceType = sourceType;
        this.currentPage     = 0;
        this.totalCount      = 0;
        this.savedCount      = 0;
        this.startedAt       = LocalDateTime.now();
    }

    public void updateProgress(int page, int totalCount, int savedCount) {
        this.currentPage  = page;
        this.totalCount   = totalCount;
        this.savedCount   = savedCount;
    }

    public void completeCollection(String sourceType, int totalSaved, int totalCount) {
        history.put(sourceType, new TypeHistory(LocalDateTime.now(), totalSaved, totalCount));
        this.status = Status.DONE;
    }

    public void stopCollection(String sourceType, int savedSoFar, int totalCount) {
        history.put(sourceType, new TypeHistory(LocalDateTime.now(), savedSoFar, totalCount));
        this.status = Status.STOPPED;
    }

    public void requestStop() {
        stopRequested.set(true);
    }

    public boolean isStopRequested() {
        return stopRequested.get();
    }

    // ─── 상태 조회 ─────────────────────────────────────────────

    public StatusSnapshot snapshot() {
        return new StatusSnapshot(
                status.name(),
                currentSourceType,
                currentPage,
                totalCount,
                savedCount,
                startedAt,
                new HashMap<>(history)
        );
    }

    // ─── 내부 데이터 클래스 ────────────────────────────────────

    public record TypeHistory(LocalDateTime lastCompletedAt, int lastSavedCount, int lastTotalCount) {}

    public record StatusSnapshot(
            String status,
            String sourceType,
            int currentPage,
            int totalCount,
            int savedCount,
            LocalDateTime startedAt,
            Map<String, TypeHistory> history
    ) {}
}

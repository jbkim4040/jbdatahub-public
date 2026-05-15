package com.jb.datahub.publicdata.service;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class CollectionStateService {

    public enum Status { IDLE, RUNNING, STOPPED, DONE }

    private final AtomicBoolean stopRequested = new AtomicBoolean(false);

    private volatile Status        status          = Status.IDLE;
    private volatile String        currentSourceType = null;
    private volatile int           currentPage     = 0;
    private volatile int           totalCount      = 0;
    private volatile int           savedCount      = 0;
    private volatile LocalDateTime startedAt       = null;

    private final Map<String, TypeHistory> history = new ConcurrentHashMap<>();

    // ─── ETA 이동평균 계산용 ───────────────────────────────────
    private static final int MOVING_AVG_WINDOW = 10;
    private final Deque<Long> recentPageDurations = new ArrayDeque<>();
    private volatile long lastPageTimestamp = 0L;
    private final Object etaLock = new Object();

    // ─── 수집 제어 ─────────────────────────────────────────────

    public boolean isRunning() { return status == Status.RUNNING; }

    public void startCollection(String sourceType) {
        stopRequested.set(false);
        this.status            = Status.RUNNING;
        this.currentSourceType = sourceType;
        this.currentPage       = 0;
        this.totalCount        = 0;
        this.savedCount        = 0;
        this.startedAt         = LocalDateTime.now();
        synchronized (etaLock) {
            this.recentPageDurations.clear();
            this.lastPageTimestamp = 0L;
        }
    }

    public void updateProgress(int page, int totalCount, int savedCount) {
        // 페이지 단위 이동평균 갱신 (한 페이지 단위 진행 시점마다 호출됨)
        synchronized (etaLock) {
            long now = System.currentTimeMillis();
            if (lastPageTimestamp > 0 && page > this.currentPage) {
                long pageDuration = now - lastPageTimestamp;
                if (pageDuration > 0) {
                    recentPageDurations.addLast(pageDuration);
                    if (recentPageDurations.size() > MOVING_AVG_WINDOW) {
                        recentPageDurations.removeFirst();
                    }
                }
            }
            lastPageTimestamp = now;
        }

        this.currentPage = page;
        this.totalCount  = totalCount;
        this.savedCount  = savedCount;
    }

    public void completeCollection(String sourceType, int totalSaved, int totalCount) {
        history.put(sourceType, new TypeHistory(LocalDateTime.now(), totalSaved, totalCount));
        this.status = Status.DONE;
    }

    public void stopCollection(String sourceType, int savedSoFar, int totalCount) {
        history.put(sourceType, new TypeHistory(LocalDateTime.now(), savedSoFar, totalCount));
        this.status = Status.STOPPED;
    }

    public void requestStop()       { stopRequested.set(true); }
    public boolean isStopRequested(){ return stopRequested.get(); }

    public String getCurrentSourceType() { return currentSourceType; }
    public int    getCurrentPage()       { return currentPage; }

    // ─── 상태 조회 ─────────────────────────────────────────────

    public StatusSnapshot snapshot() {
        long elapsed = 0;
        Long eta     = null;

        if (startedAt != null && status == Status.RUNNING) {
            elapsed = ChronoUnit.SECONDS.between(startedAt, LocalDateTime.now());
            if (savedCount > 0 && totalCount > 0 && savedCount < totalCount) {
                long remaining = totalCount - savedCount;

                // 1) 페이지 단위 이동평균 기반 ETA (우선)
                long avgPageDurationMs;
                int windowSize;
                synchronized (etaLock) {
                    windowSize = recentPageDurations.size();
                    avgPageDurationMs = windowSize == 0
                            ? 0L
                            : (long) recentPageDurations.stream()
                                .mapToLong(Long::longValue).average().orElse(0);
                }

                if (windowSize > 0 && avgPageDurationMs > 0 && currentPage > 0) {
                    // 한 페이지당 평균 저장 건수 = savedCount / currentPage
                    // 남은 페이지 수 ≈ remaining / (savedCount / currentPage)
                    double avgSavedPerPage = (double) savedCount / (double) currentPage;
                    if (avgSavedPerPage > 0) {
                        double remainingPages = (double) remaining / avgSavedPerPage;
                        eta = Math.max(0L,
                                (long) ((avgPageDurationMs * remainingPages) / 1000.0));
                    }
                }

                // 2) 이동평균이 아직 비어 있으면 누적 평균으로 fallback
                if (eta == null) {
                    eta = elapsed * remaining / savedCount;
                }
            }
        }

        return new StatusSnapshot(
                status.name(),
                currentSourceType,
                currentPage,
                totalCount,
                savedCount,
                startedAt,
                elapsed,
                eta,
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
            long elapsedSeconds,
            Long etaSeconds,
            Map<String, TypeHistory> history
    ) {}
}

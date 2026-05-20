package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.PublicApiResponseDto;
import com.jb.datahub.publicdata.dto.PublicDataResponseDto;
import com.jb.datahub.publicdata.entity.CollectScheduleConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ScheduledCollector {

    private final SchedulerConfigService schedulerConfigService;
    private final PublicApiService       publicApiService;
    private final CollectionStateService stateService;
    private final PublicApiFetchService  fetchService;
    private final JdbcTemplate           jdbcTemplate;
    private final SchedulerLock          schedulerLock;

    @Value("${publicdata.api.dataset-path:/15077093/v1/dataset}")
    private String datasetPath;

    @Value("${publicdata.api.file-data-path:/15077093/v1/file-data-list}")
    private String fileDataPath;

    @Value("${publicdata.api.standard-data-path:/15077093/v1/standard-data-list}")
    private String standardDataPath;

    /** 매 분마다 실행하여 설정된 시각인지 확인 */
    @Scheduled(cron = "0 * * * * *")
    public void checkAndRun() {
        // Blue/Green 오버랩 중 중복 실행 방지 (TTL 50s < 60s 주기)
        if (!schedulerLock.tryAcquire("collector-check", 50)) return;
        CollectScheduleConfig config = schedulerConfigService.getOrDefault();
        if (!config.isEnabled()) return;

        LocalDateTime now = LocalDateTime.now();
        if (!shouldRun(config, now)) return;

        // 오늘 이미 실행했으면 스킵 (HOURLY는 시간 단위로 체크)
        if (config.getLastRunAt() != null && !hasEnoughTimePassed(config, now)) return;

        if (stateService.isRunning()) {
            log.warn("[Scheduler] 수집 진행 중 — 스케줄 건너뜀");
            return;
        }

        log.info("[Scheduler] 자동 수집 시작: type={} source={}", config.getScheduleType(), config.getSourceType());
        schedulerConfigService.updateLastRunAt(now);
        triggerCollection(config.getSourceType());
    }

    /**
     * 매일 자정: 데이터 타입별 포털 총건수 vs DB 건수를 비교하여
     * 변동이 있는 타입만 선택적으로 수집을 트리거한다.
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void midnightChangeCheck() {
        if (!schedulerLock.tryAcquire("collector-midnight", 600)) return;
        log.info("[MidnightCheck] 자정 변화량 감지 시작");
        if (stateService.isRunning()) {
            log.warn("[MidnightCheck] 수집 진행 중 — 건너뜀");
            return;
        }

        // sourceType -> path (openapi만 null 사용)
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("openapi",        null);
        sources.put("dataset",        datasetPath);
        sources.put("file-data",      fileDataPath);
        sources.put("standard-data",  standardDataPath);

        for (Map.Entry<String, String> entry : sources.entrySet()) {
            String sourceType = entry.getKey();
            String path       = entry.getValue();

            try {
                int portalCount = fetchPortalCount(sourceType, path);
                if (portalCount < 0) {
                    log.warn("[MidnightCheck] {} 포털 조회 실패 — 스킵", sourceType);
                    continue;
                }

                int dbCount = fetchDbCount(sourceType);
                log.info("[MidnightCheck] {} 포털={} DB={}", sourceType, portalCount, dbCount);

                if (portalCount != dbCount) {
                    if (stateService.isRunning()) {
                        log.warn("[MidnightCheck] {} 변동 감지했으나 이미 수집 중 — 건너뜀", sourceType);
                        continue;
                    }
                    log.info("[MidnightCheck] {} 수량 변동({} → {}) 감지 → 수집 트리거",
                            sourceType, dbCount, portalCount);
                    triggerCollection(sourceType);
                }
            } catch (Exception e) {
                log.error("[MidnightCheck] {} 오류: {}", sourceType, e.getMessage());
            }
        }
    }

    /** 포털 API에서 해당 타입의 totalCount 조회 (실패 시 -1) */
    private int fetchPortalCount(String sourceType, String path) {
        if (path == null) {
            PublicApiResponseDto resp = fetchService.fetchPage(1);
            return (resp != null) ? resp.getTotalCount() : -1;
        }
        PublicDataResponseDto resp = fetchService.fetchDataPage(1, path);
        return (resp != null) ? resp.getTotalCount() : -1;
    }

    /** DB에서 해당 타입의 현재 건수 조회 */
    private int fetchDbCount(String sourceType) {
        if ("openapi".equals(sourceType)) {
            Integer cnt = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM public_api_list", Integer.class);
            return cnt != null ? cnt : 0;
        }
        Integer cnt = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM public_data_item WHERE source_type = ?",
                Integer.class, sourceType);
        return cnt != null ? cnt : 0;
    }

    private boolean shouldRun(CollectScheduleConfig c, LocalDateTime now) {
        String type = c.getScheduleType() != null ? c.getScheduleType() : "DAILY";
        return switch (type) {
            case "HOURLY" -> now.getMinute() == c.getMinute();
            case "WEEKLY" -> {
                int dow = now.getDayOfWeek().getValue(); // 1=Mon ~ 7=Sun
                yield dow == c.getDayOfWeek()
                        && now.getHour() == c.getHour()
                        && now.getMinute() == c.getMinute();
            }
            case "MONTHLY" -> now.getDayOfMonth() == c.getDayOfMonth()
                    && now.getHour() == c.getHour()
                    && now.getMinute() == c.getMinute();
            default -> // DAILY
                    now.getHour() == c.getHour() && now.getMinute() == c.getMinute();
        };
    }

    private boolean hasEnoughTimePassed(CollectScheduleConfig c, LocalDateTime now) {
        LocalDateTime last = c.getLastRunAt();
        String type = c.getScheduleType() != null ? c.getScheduleType() : "DAILY";
        return switch (type) {
            case "HOURLY"  -> last.plusHours(c.getIntervalHours()).isBefore(now);
            case "WEEKLY"  -> last.plusWeeks(1).isBefore(now);
            case "MONTHLY" -> last.plusMonths(1).isBefore(now);
            default          -> !last.toLocalDate().equals(now.toLocalDate()); // DAILY
        };
    }

    private void triggerCollection(String sourceType) {
        switch (sourceType) {
            case "dataset"       -> publicApiService.collectDatasetAsync();
            case "file-data"     -> publicApiService.collectFileDataAsync();
            case "standard-data" -> publicApiService.collectStandardDataAsync();
            default               -> publicApiService.collectAllAsync();
        }
    }
}

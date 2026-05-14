package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.entity.CollectScheduleConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class ScheduledCollector {

    private final SchedulerConfigService schedulerConfigService;
    private final PublicApiService       publicApiService;
    private final CollectionStateService stateService;

    /** 매 분마다 실행하여 설정된 시각인지 확인 */
    @Scheduled(cron = "0 * * * * *")
    public void checkAndRun() {
        CollectScheduleConfig config = schedulerConfigService.getOrDefault();
        if (!config.isEnabled()) return;

        LocalDateTime now = LocalDateTime.now();
        if (now.getHour() != config.getHour() || now.getMinute() != config.getMinute()) return;

        // 오늘 이미 실행했으면 스킵
        if (config.getLastRunAt() != null &&
                config.getLastRunAt().toLocalDate().equals(now.toLocalDate())) return;

        if (stateService.isRunning()) {
            log.warn("[Scheduler] 수집 진행 중 — 스케줄 건너뜀");
            return;
        }

        log.info("[Scheduler] 자동 수집 시작: {}", config.getSourceType());
        schedulerConfigService.updateLastRunAt(now);

        switch (config.getSourceType()) {
            case "dataset"       -> publicApiService.collectDatasetAsync();
            case "file-data"     -> publicApiService.collectFileDataAsync();
            case "standard-data" -> publicApiService.collectStandardDataAsync();
            default              -> publicApiService.collectAllAsync();
        }
    }
}

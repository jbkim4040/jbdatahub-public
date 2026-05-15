package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.entity.CollectScheduleConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
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
            case "HOURLY" -> last.plusHours(c.getIntervalHours()).isBefore(now);
            case "WEEKLY" -> last.plusWeeks(1).isBefore(now);
            case "MONTHLY" -> last.plusMonths(1).isBefore(now);
            default -> !last.toLocalDate().equals(now.toLocalDate()); // DAILY
        };
    }

    private void triggerCollection(String sourceType) {
        switch (sourceType) {
            case "dataset"       -> publicApiService.collectDatasetAsync();
            case "file-data"     -> publicApiService.collectFileDataAsync();
            case "standard-data" -> publicApiService.collectStandardDataAsync();
            default              -> publicApiService.collectAllAsync();
        }
    }
}

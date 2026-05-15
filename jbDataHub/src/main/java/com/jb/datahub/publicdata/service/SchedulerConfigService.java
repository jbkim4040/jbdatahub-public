package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.CollectScheduleConfigDto;
import com.jb.datahub.publicdata.entity.CollectScheduleConfig;
import com.jb.datahub.publicdata.repository.CollectScheduleConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class SchedulerConfigService {

    private final CollectScheduleConfigRepository repository;

    public CollectScheduleConfig getOrDefault() {
        return repository.findById("default")
                .orElseGet(() -> repository.save(CollectScheduleConfig.createDefault()));
    }

    @Transactional
    public CollectScheduleConfig update(CollectScheduleConfigDto dto) {
        CollectScheduleConfig c = getOrDefault();
        c.setEnabled(dto.isEnabled());
        c.setScheduleType(dto.getScheduleType() != null ? dto.getScheduleType() : "DAILY");
        c.setHour(Math.max(0, Math.min(23, dto.getHour())));
        c.setMinute(Math.max(0, Math.min(59, dto.getMinute())));
        c.setIntervalHours(Math.max(1, Math.min(24, dto.getIntervalHours())));
        c.setDayOfWeek(Math.max(1, Math.min(7, dto.getDayOfWeek())));
        c.setDayOfMonth(Math.max(1, Math.min(31, dto.getDayOfMonth())));
        c.setSourceType(dto.getSourceType());
        c.setUpdatedAt(LocalDateTime.now());
        return repository.save(c);
    }

    @Transactional
    public void updateLastRunAt(LocalDateTime time) {
        CollectScheduleConfig c = getOrDefault();
        c.setLastRunAt(time);
        repository.save(c);
    }
}

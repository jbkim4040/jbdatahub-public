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
        CollectScheduleConfig config = getOrDefault();
        config.setEnabled(dto.isEnabled());
        config.setHour(Math.max(0, Math.min(23, dto.getHour())));
        config.setMinute(Math.max(0, Math.min(59, dto.getMinute())));
        config.setSourceType(dto.getSourceType());
        config.setUpdatedAt(LocalDateTime.now());
        return repository.save(config);
    }

    @Transactional
    public void updateLastRunAt(LocalDateTime time) {
        CollectScheduleConfig config = getOrDefault();
        config.setLastRunAt(time);
        repository.save(config);
    }
}

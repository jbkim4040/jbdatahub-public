package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.CollectionLogDto;
import com.jb.datahub.publicdata.entity.CollectionLog;
import com.jb.datahub.publicdata.repository.CollectionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CollectionLogService {

    private final CollectionLogRepository repository;

    @Transactional
    @CacheEvict(value = {"stats", "dataItemStats"}, allEntries = true)
    public void saveLog(String sourceType, String status, int totalSaved, int totalCount,
                        LocalDateTime startedAt) {
        CollectionLog log = CollectionLog.builder()
                .sourceType(sourceType)
                .status(status)
                .totalSaved(totalSaved)
                .totalCount(totalCount)
                .startedAt(startedAt)
                .completedAt(LocalDateTime.now())
                .build();
        repository.save(log);
    }

    public List<CollectionLogDto> getRecent(int limit) {
        return repository.findAllByOrderByCompletedAtDesc(PageRequest.of(0, limit))
                .stream().map(CollectionLogDto::new).toList();
    }
}

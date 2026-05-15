package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.DataItemStatsDto;
import com.jb.datahub.publicdata.dto.PageResponseDto;
import com.jb.datahub.publicdata.dto.PublicApiDetailDto;
import com.jb.datahub.publicdata.dto.PublicApiListDto;
import com.jb.datahub.publicdata.dto.PublicApiOperationDto;
import com.jb.datahub.publicdata.dto.PublicDataItemResponseDto;
import com.jb.datahub.publicdata.dto.StatsDto;
import com.jb.datahub.publicdata.repository.PublicApiListRepository;
import com.jb.datahub.publicdata.repository.PublicApiOperationRepository;
import com.jb.datahub.publicdata.repository.PublicDataItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PublicApiQueryService {

    private final PublicApiListRepository     repository;
    private final PublicApiOperationRepository operationRepository;
    private final PublicDataItemRepository    dataItemRepository;

    private static final Set<String> LIST_SORT_FIELDS =
            Set.of("listTitle", "orgNm", "requestCnt", "updatedAt", "isCharged");
    private static final Set<String> ITEM_SORT_FIELDS =
            Set.of("title", "orgNm", "viewCnt", "downloadCnt", "updatedAt");

    private Sort buildSort(Set<String> allowed, String sortBy, String sortDir) {
        String field = (sortBy != null && allowed.contains(sortBy)) ? sortBy : "updatedAt";
        return "asc".equalsIgnoreCase(sortDir)
                ? Sort.by(field).ascending()
                : Sort.by(field).descending();
    }

    public PageResponseDto<PublicApiListDto> getList(int page, int size, String title,
                                                      String sortBy, String sortDir) {
        Pageable pageable = PageRequest.of(page, size, buildSort(LIST_SORT_FIELDS, sortBy, sortDir));
        var result = (title != null && !title.isBlank())
                ? repository.findByListTitleContainingIgnoreCase(title, pageable)
                : repository.findAll(pageable);
        return PageResponseDto.from(result.map(PublicApiListDto::from));
    }

    @Cacheable("stats")
    public StatsDto getStats() {
        long total = repository.count();

        Map<String, Long> byApiType = repository.countByApiType().stream()
                .collect(Collectors.toMap(
                        row -> row[0] != null ? (String) row[0] : "미분류",
                        row -> (Long) row[1],
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        List<Map<String, Object>> byCategory = repository.countByCategory().stream()
                .limit(10)
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", row[0] != null ? row[0] : "미분류");
                    m.put("count", row[1]);
                    return m;
                })
                .collect(Collectors.toList());

        Pageable top10 = PageRequest.of(0, 10);
        List<Map<String, Object>> byOrg = repository.countByOrg(top10).stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", row[0] != null ? row[0] : "미분류");
                    m.put("count", row[1]);
                    return m;
                })
                .collect(Collectors.toList());

        return StatsDto.builder()
                .totalCount(total)
                .countByApiType(byApiType)
                .countByCategory(byCategory)
                .countByOrg(byOrg)
                .build();
    }

    @Cacheable(value = "dataItemStats", key = "#sourceType")
    public DataItemStatsDto getDataItemStats(String sourceType) {
        long total = dataItemRepository.countBySourceType(sourceType);
        Pageable top10 = PageRequest.of(0, 10);

        List<Map<String, Object>> byCategory = dataItemRepository
                .countByCategoryBySourceType(sourceType, top10).stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", row[0] != null ? row[0] : "미분류");
                    m.put("count", row[1]);
                    return m;
                })
                .collect(Collectors.toList());

        List<Map<String, Object>> byFormat = dataItemRepository
                .countByFormatBySourceType(sourceType, top10).stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", row[0] != null ? row[0] : "미분류");
                    m.put("count", row[1]);
                    return m;
                })
                .collect(Collectors.toList());

        return DataItemStatsDto.builder()
                .totalCount(total)
                .countByCategory(byCategory)
                .countByFormat(byFormat)
                .build();
    }

    public PageResponseDto<PublicDataItemResponseDto> getDataItems(
            String sourceType, int page, int size, String title,
            String sortBy, String sortDir) {

        Pageable pageable = PageRequest.of(page, size, buildSort(ITEM_SORT_FIELDS, sortBy, sortDir));
        boolean hasType  = sourceType != null && !sourceType.isBlank();
        boolean hasTitle = title != null && !title.isBlank();

        var result = (hasType && hasTitle)
                ? dataItemRepository.findBySourceTypeAndTitleContainingIgnoreCase(sourceType, title, pageable)
                : hasType
                ? dataItemRepository.findBySourceType(sourceType, pageable)
                : hasTitle
                ? dataItemRepository.findByTitleContainingIgnoreCase(title, pageable)
                : dataItemRepository.findAll(pageable);

        return PageResponseDto.from(result.map(PublicDataItemResponseDto::new));
    }

    public PublicApiDetailDto getDetail(String listId) {
        var apiList = repository.findById(listId)
                .orElseThrow(() -> new IllegalArgumentException("API를 찾을 수 없습니다: " + listId));
        var operations = operationRepository.findByPublicApiList_ListId(listId).stream()
                .map(PublicApiOperationDto::new)
                .toList();
        return PublicApiDetailDto.from(apiList, operations);
    }
}

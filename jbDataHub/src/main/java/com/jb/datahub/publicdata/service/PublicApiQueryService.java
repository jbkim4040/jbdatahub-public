package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.PageResponseDto;
import com.jb.datahub.publicdata.dto.PublicApiListDto;
import com.jb.datahub.publicdata.dto.PublicDataItemResponseDto;
import com.jb.datahub.publicdata.dto.StatsDto;
import com.jb.datahub.publicdata.repository.PublicApiListRepository;
import com.jb.datahub.publicdata.repository.PublicDataItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PublicApiQueryService {

    private final PublicApiListRepository repository;
    private final PublicDataItemRepository dataItemRepository;

    /**
     * 전체 목록 조회 (페이징)
     * title 파라미터가 있으면 list_title 포함 검색
     */
    public PageResponseDto<PublicApiListDto> getList(int page, int size, String title) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("updatedAt").descending());

        var result = (title != null && !title.isBlank())
                ? repository.findByListTitleContainingIgnoreCase(title, pageable)
                : repository.findAll(pageable);

        return PageResponseDto.from(result.map(PublicApiListDto::from));
    }

    /** 통계 조회 */
    public StatsDto getStats() {
        long total = repository.count();

        // api_type 별 건수
        Map<String, Long> byApiType = repository.countByApiType().stream()
                .collect(Collectors.toMap(
                        row -> row[0] != null ? (String) row[0] : "미분류",
                        row -> (Long) row[1],
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        // 카테고리 별 건수 (상위 10개)
        List<Map<String, Object>> byCategory = repository.countByCategory().stream()
                .limit(10)
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", row[0] != null ? row[0] : "미분류");
                    m.put("count", row[1]);
                    return m;
                })
                .collect(Collectors.toList());

        // 제공기관 별 건수 (상위 10개)
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

    /** 데이터셋 / 파일데이터 / 표준데이터 목록 조회 (페이징 + 검색) */
    public PageResponseDto<PublicDataItemResponseDto> getDataItems(
            String sourceType, int page, int size, String title) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("updatedAt").descending());
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
}

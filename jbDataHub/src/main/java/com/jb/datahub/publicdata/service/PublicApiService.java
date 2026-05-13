package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.CollectResultDto;
import com.jb.datahub.publicdata.dto.PublicApiResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 조회 + 저장을 조율하는 서비스
 * - Controller는 이 서비스만 바라본다
 * - 결과를 CollectResultDto로 반환
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublicApiService {

    private final PublicApiFetchService fetchService;
    private final PublicApiSaveService  saveService;

    /**
     * 전체 페이지 수집 → 저장
     */
    public CollectResultDto collectAll() {
        int page = 1;
        int totalSaved = 0;
        int totalCount = 0;

        while (true) {
            PublicApiResponseDto response = fetchService.fetchPage(page);

            if (response == null || response.getData() == null || response.getData().isEmpty()) {
                log.warn("[Collect] page={} 응답 없음 - 수집 종료", page);
                break;
            }

            totalCount = response.getTotalCount();
            int saved  = saveService.saveAll(response.getData());
            totalSaved += saved;

            log.info("[Collect] page={} / saved={} / 누적={} / 전체={}", page, saved, totalSaved, totalCount);

            if ((long) page * fetchService.getPageSize() >= totalCount) break;
            page++;
        }

        return CollectResultDto.success(page, totalCount, totalSaved);
    }

    /**
     * 단일 페이지 수집 → 저장
     */
    public CollectResultDto collectPage(int page) {
        PublicApiResponseDto response = fetchService.fetchPage(page);

        if (response == null || response.getData() == null || response.getData().isEmpty()) {
            return CollectResultDto.fail("page=" + page + " 데이터가 없습니다.");
        }

        int saved = saveService.saveAll(response.getData());
        return CollectResultDto.success(page, response.getTotalCount(), saved);
    }
}

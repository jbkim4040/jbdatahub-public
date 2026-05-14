package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.CollectResultDto;
import com.jb.datahub.publicdata.dto.PublicApiResponseDto;
import com.jb.datahub.publicdata.dto.PublicDataResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * 조회 + 저장을 조율하는 서비스 (비동기 실행)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublicApiService {

    private final PublicApiFetchService   fetchService;
    private final PublicApiSaveService    saveService;
    private final PublicDataSaveService   dataSaveService;
    private final CollectionStateService  stateService;

    @Value("${publicdata.api.dataset-path:/15077093/v1/dataset}")
    private String datasetPath;

    @Value("${publicdata.api.file-data-path:/15077093/v1/file-data-list}")
    private String fileDataPath;

    @Value("${publicdata.api.standard-data-path:/15077093/v1/standard-data-list}")
    private String standardDataPath;

    // ─── 비동기 수집 메서드 ────────────────────────────────────

    @Async
    public void collectAllAsync() {
        final String TYPE = "openapi";
        stateService.startCollection(TYPE);
        int page = 1, totalSaved = 0, totalCount = 0;

        while (true) {
            if (stateService.isStopRequested()) {
                log.info("[Collect-{}] 중지 요청 - page={}, 누적={}", TYPE, page, totalSaved);
                stateService.stopCollection(TYPE, totalSaved, totalCount);
                return;
            }
            PublicApiResponseDto response = fetchService.fetchPage(page);
            if (response == null || response.getData() == null || response.getData().isEmpty()) {
                log.warn("[Collect-{}] page={} 응답 없음 - 종료", TYPE, page);
                break;
            }
            totalCount = response.getTotalCount();
            int saved  = saveService.saveAll(response.getData());
            totalSaved += saved;
            stateService.updateProgress(page, totalCount, totalSaved);
            log.info("[Collect-{}] page={} saved={} 누적={}/{}", TYPE, page, saved, totalSaved, totalCount);
            if ((long) page * fetchService.getPageSize() >= totalCount) break;
            page++;
        }
        stateService.completeCollection(TYPE, totalSaved, totalCount);
    }

    @Async
    public void collectDatasetAsync() {
        collectDataTypeAsync(datasetPath, "dataset");
    }

    @Async
    public void collectFileDataAsync() {
        collectDataTypeAsync(fileDataPath, "file-data");
    }

    @Async
    public void collectStandardDataAsync() {
        collectDataTypeAsync(standardDataPath, "standard-data");
    }

    // ─── 단일 페이지 (동기, 테스트용) ─────────────────────────

    public CollectResultDto collectPage(int page) {
        PublicApiResponseDto response = fetchService.fetchPage(page);
        if (response == null || response.getData() == null || response.getData().isEmpty()) {
            return CollectResultDto.fail("page=" + page + " 데이터가 없습니다.");
        }
        int saved = saveService.saveAll(response.getData());
        return CollectResultDto.success(page, response.getTotalCount(), saved);
    }

    // ─── 중지 ─────────────────────────────────────────────────

    public void stopCollect() {
        stateService.requestStop();
        log.info("[Collect] 중지 요청 접수");
    }

    // ─── 내부 공통 로직 ───────────────────────────────────────

    private void collectDataTypeAsync(String path, String sourceType) {
        stateService.startCollection(sourceType);
        int page = 1, totalSaved = 0, totalCount = 0;

        while (true) {
            if (stateService.isStopRequested()) {
                log.info("[Collect-{}] 중지 요청 - page={}, 누적={}", sourceType, page, totalSaved);
                stateService.stopCollection(sourceType, totalSaved, totalCount);
                return;
            }
            PublicDataResponseDto response = fetchService.fetchDataPage(page, path);
            if (response == null || response.getData() == null || response.getData().isEmpty()) {
                log.warn("[Collect-{}] page={} 응답 없음 - 종료", sourceType, page);
                break;
            }
            totalCount = response.getTotalCount();
            int saved  = dataSaveService.saveAll(response.getData(), sourceType);
            totalSaved += saved;
            stateService.updateProgress(page, totalCount, totalSaved);
            log.info("[Collect-{}] page={} saved={} 누적={}/{}", sourceType, page, saved, totalSaved, totalCount);
            if ((long) page * fetchService.getPageSize() >= totalCount) break;
            page++;
        }
        stateService.completeCollection(sourceType, totalSaved, totalCount);
    }
}

package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.CollectResultDto;
import com.jb.datahub.publicdata.dto.PublicApiResponseDto;
import com.jb.datahub.publicdata.dto.PublicDataResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class PublicApiService {

    private final PublicApiFetchService  fetchService;
    private final PublicApiSaveService   saveService;
    private final PublicDataSaveService  dataSaveService;
    private final CollectionStateService stateService;
    private final CollectionLogService   logService;

    @Value("${publicdata.api.dataset-path:/15077093/v1/dataset}")
    private String datasetPath;

    @Value("${publicdata.api.file-data-path:/15077093/v1/file-data-list}")
    private String fileDataPath;

    @Value("${publicdata.api.standard-data-path:/15077093/v1/standard-data-list}")
    private String standardDataPath;

    // ─── 비동기 전체 수집 ──────────────────────────────────────

    @Async
    public void collectAllAsync() { collectOpenApiFrom(1); }

    @Async
    public void collectDatasetAsync()      { collectDataTypeAsync(datasetPath,       "dataset"); }

    @Async
    public void collectFileDataAsync()     { collectDataTypeAsync(fileDataPath,      "file-data"); }

    @Async
    public void collectStandardDataAsync() { collectDataTypeAsync(standardDataPath,  "standard-data"); }

    // ─── Resume: 마지막 중단 페이지 다음부터 수집 ────────────

    @Async
    public void resumeAsync() {
        String sourceType = stateService.getCurrentSourceType();
        int    fromPage   = stateService.getCurrentPage() + 1;
        if (sourceType == null || fromPage <= 1) {
            collectAllAsync();
            return;
        }
        log.info("[Resume] sourceType={} fromPage={}", sourceType, fromPage);
        switch (sourceType) {
            case "openapi"       -> collectOpenApiFrom(fromPage);
            case "dataset"       -> collectDataTypeFrom(datasetPath,      "dataset",       fromPage);
            case "file-data"     -> collectDataTypeFrom(fileDataPath,     "file-data",     fromPage);
            case "standard-data" -> collectDataTypeFrom(standardDataPath, "standard-data", fromPage);
            default              -> collectAllAsync();
        }
    }

    // ─── 단일 페이지 (테스트용) ───────────────────────────────

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

    private void collectOpenApiFrom(int startPage) {
        final String TYPE = "openapi";
        stateService.startCollection(TYPE);
        LocalDateTime startedAt = LocalDateTime.now();
        int page = startPage, totalSaved = 0, totalCount = 0;

        while (true) {
            if (stateService.isStopRequested()) {
                stateService.stopCollection(TYPE, totalSaved, totalCount);
                logService.saveLog(TYPE, "STOPPED", totalSaved, totalCount, startedAt);
                return;
            }
            PublicApiResponseDto response = fetchService.fetchPage(page);
            if (response == null || response.getData() == null || response.getData().isEmpty()) break;

            totalCount  = response.getTotalCount();
            int saved   = saveService.saveAll(response.getData());
            totalSaved += saved;
            stateService.updateProgress(page, totalCount, totalSaved);
            log.info("[Collect-{}] page={} saved={} 누적={}/{}", TYPE, page, saved, totalSaved, totalCount);
            if ((long) page * fetchService.getPageSize() >= totalCount) break;
            page++;
        }
        stateService.completeCollection(TYPE, totalSaved, totalCount);
        logService.saveLog(TYPE, "DONE", totalSaved, totalCount, startedAt);
    }

    private void collectDataTypeAsync(String path, String sourceType) {
        collectDataTypeFrom(path, sourceType, 1);
    }

    private void collectDataTypeFrom(String path, String sourceType, int startPage) {
        stateService.startCollection(sourceType);
        LocalDateTime startedAt = LocalDateTime.now();
        int page = startPage, totalSaved = 0, totalCount = 0;

        while (true) {
            if (stateService.isStopRequested()) {
                stateService.stopCollection(sourceType, totalSaved, totalCount);
                logService.saveLog(sourceType, "STOPPED", totalSaved, totalCount, startedAt);
                return;
            }
            PublicDataResponseDto response = fetchService.fetchDataPage(page, path);
            if (response == null || response.getData() == null || response.getData().isEmpty()) break;

            totalCount  = response.getTotalCount();
            int saved   = dataSaveService.saveAll(response.getData(), sourceType);
            totalSaved += saved;
            stateService.updateProgress(page, totalCount, totalSaved);
            log.info("[Collect-{}] page={} saved={} 누적={}/{}", sourceType, page, saved, totalSaved, totalCount);
            if ((long) page * fetchService.getPageSize() >= totalCount) break;
            page++;
        }
        stateService.completeCollection(sourceType, totalSaved, totalCount);
        logService.saveLog(sourceType, "DONE", totalSaved, totalCount, startedAt);
    }
}

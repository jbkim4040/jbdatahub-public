package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.CollectResultDto;
import com.jb.datahub.publicdata.dto.PublicApiResponseDto;
import com.jb.datahub.publicdata.dto.PublicDataResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PublicApiService {

    private final PublicApiFetchService  fetchService;
    private final PublicApiSaveService   saveService;
    private final PublicDataSaveService  dataSaveService;
    private final CollectionStateService stateService;
    private final CollectionLogService   logService;

    private static final int FETCH_CONCURRENCY = 3;

    @Value("${publicdata.api.dataset-path:/15077093/v1/dataset}")
    private String datasetPath;

    @Value("${publicdata.api.file-data-path:/15077093/v1/file-data-list}")
    private String fileDataPath;

    @Value("${publicdata.api.standard-data-path:/15077093/v1/standard-data-list}")
    private String standardDataPath;

    @Async
    public void collectAllAsync() { collectOpenApiFrom(1); }

    @Async
    public void collectDatasetAsync()      { collectDataTypeAsync(datasetPath,      "dataset"); }

    @Async
    public void collectFileDataAsync()     { collectDataTypeAsync(fileDataPath,     "file-data"); }

    @Async
    public void collectStandardDataAsync() { collectDataTypeAsync(standardDataPath, "standard-data"); }

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

    public CollectResultDto collectPage(int page) {
        PublicApiResponseDto response = fetchService.fetchPage(page);
        if (response == null || response.getData() == null || response.getData().isEmpty()) {
            return CollectResultDto.fail("page=" + page + " 데이터가 없습니다.");
        }
        int saved = saveService.saveAll(response.getData());
        return CollectResultDto.success(page, response.getTotalCount(), saved);
    }

    public void stopCollect() {
        stateService.requestStop();
        log.info("[Collect] 중지 요청 접수");
    }

    // ─── OpenAPI 병렬 수집 ────────────────────────────────────

    private void collectOpenApiFrom(int startPage) {
        final String TYPE = "openapi";
        stateService.startCollection(TYPE);
        LocalDateTime startedAt = LocalDateTime.now();
        int totalSaved = 0, totalCount = 0;

        // 첫 페이지로 totalCount 확보
        PublicApiResponseDto first = fetchService.fetchPage(startPage);
        if (first == null || first.getData() == null || first.getData().isEmpty()) {
            stateService.completeCollection(TYPE, 0, 0);
            logService.saveLog(TYPE, "DONE", 0, 0, startedAt);
            return;
        }
        totalCount = first.getTotalCount();
        int saved = saveService.saveAll(first.getData());
        totalSaved += saved;
        stateService.updateProgress(startPage, totalCount, totalSaved);
        log.info("[Collect-{}] page={} saved={} 누적={}/{}", TYPE, startPage, saved, totalSaved, totalCount);

        int totalPages = (int) Math.ceil((double) totalCount / fetchService.getPageSize());
        ExecutorService executor = Executors.newFixedThreadPool(FETCH_CONCURRENCY);

        try {
            for (int page = startPage + 1; page <= totalPages; ) {
                if (stateService.isStopRequested()) {
                    stateService.stopCollection(TYPE, totalSaved, totalCount);
                    logService.saveLog(TYPE, "STOPPED", totalSaved, totalCount, startedAt);
                    return;
                }

                // 최대 FETCH_CONCURRENCY 페이지 병렬 fetch
                List<CompletableFuture<PublicApiResponseDto>> futures = new ArrayList<>();
                List<Integer> pages = new ArrayList<>();
                for (int i = 0; i < FETCH_CONCURRENCY && page <= totalPages; i++, page++) {
                    final int p = page;
                    futures.add(CompletableFuture.supplyAsync(() -> fetchService.fetchPage(p), executor));
                    pages.add(p);
                }

                // 순서대로 저장
                for (int i = 0; i < futures.size(); i++) {
                    try {
                        PublicApiResponseDto response = futures.get(i).get();
                        if (response != null && response.getData() != null && !response.getData().isEmpty()) {
                            int s = saveService.saveAll(response.getData());
                            totalSaved += s;
                            stateService.updateProgress(pages.get(i), totalCount, totalSaved);
                            log.info("[Collect-{}] page={} saved={} 누적={}/{}", TYPE, pages.get(i), s, totalSaved, totalCount);
                        }
                    } catch (Exception e) {
                        log.warn("[Collect-{}] page={} 실패: {}", TYPE, pages.get(i), e.getMessage());
                    }
                }
                // 배치 간격: 외부 API 부하 분산 (100ms)
                try { Thread.sleep(100); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            }
        } finally {
            executor.shutdown();
        }

        stateService.completeCollection(TYPE, totalSaved, totalCount);
        logService.saveLog(TYPE, "DONE", totalSaved, totalCount, startedAt);
    }

    // ─── DataType 병렬 수집 ───────────────────────────────────

    private void collectDataTypeAsync(String path, String sourceType) {
        collectDataTypeFrom(path, sourceType, 1);
    }

    private void collectDataTypeFrom(String path, String sourceType, int startPage) {
        stateService.startCollection(sourceType);
        LocalDateTime startedAt = LocalDateTime.now();
        int totalSaved = 0, totalCount = 0;

        // 첫 페이지로 totalCount 확보
        PublicDataResponseDto first = fetchService.fetchDataPage(startPage, path);
        if (first == null || first.getData() == null || first.getData().isEmpty()) {
            stateService.completeCollection(sourceType, 0, 0);
            logService.saveLog(sourceType, "DONE", 0, 0, startedAt);
            return;
        }
        totalCount = first.getTotalCount();
        int saved = dataSaveService.saveAll(first.getData(), sourceType);
        totalSaved += saved;
        stateService.updateProgress(startPage, totalCount, totalSaved);
        log.info("[Collect-{}] page={} saved={} 누적={}/{}", sourceType, startPage, saved, totalSaved, totalCount);

        int totalPages = (int) Math.ceil((double) totalCount / fetchService.getPageSize());
        ExecutorService executor = Executors.newFixedThreadPool(FETCH_CONCURRENCY);

        try {
            for (int page = startPage + 1; page <= totalPages; ) {
                if (stateService.isStopRequested()) {
                    stateService.stopCollection(sourceType, totalSaved, totalCount);
                    logService.saveLog(sourceType, "STOPPED", totalSaved, totalCount, startedAt);
                    return;
                }

                List<CompletableFuture<PublicDataResponseDto>> futures = new ArrayList<>();
                List<Integer> pages = new ArrayList<>();
                for (int i = 0; i < FETCH_CONCURRENCY && page <= totalPages; i++, page++) {
                    final int p = page;
                    futures.add(CompletableFuture.supplyAsync(() -> fetchService.fetchDataPage(p, path), executor));
                    pages.add(p);
                }

                for (int i = 0; i < futures.size(); i++) {
                    try {
                        PublicDataResponseDto response = futures.get(i).get();
                        if (response != null && response.getData() != null && !response.getData().isEmpty()) {
                            int s = dataSaveService.saveAll(response.getData(), sourceType);
                            totalSaved += s;
                            stateService.updateProgress(pages.get(i), totalCount, totalSaved);
                            log.info("[Collect-{}] page={} saved={} 누적={}/{}", sourceType, pages.get(i), s, totalSaved, totalCount);
                        }
                    } catch (Exception e) {
                        log.warn("[Collect-{}] page={} 실패: {}", sourceType, pages.get(i), e.getMessage());
                    }
                }
                // 배치 간격: 외부 API 부하 분산 (100ms)
                try { Thread.sleep(100); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            }
        } finally {
            executor.shutdown();
        }

        stateService.completeCollection(sourceType, totalSaved, totalCount);
        logService.saveLog(sourceType, "DONE", totalSaved, totalCount, startedAt);
    }
}

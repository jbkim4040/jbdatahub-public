package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.CollectResultDto;
import com.jb.datahub.publicdata.dto.PublicApiResponseDto;
import com.jb.datahub.publicdata.dto.PublicDataResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    /**
     * 전체 페이지 수집 → 저장
     */
    public CollectResultDto collectAll() {
        stateService.reset();
        int page = 1;
        int totalSaved = 0;
        int totalCount = 0;

        while (true) {
            if (stateService.isStopRequested()) {
                log.info("[Collect] 중지 요청으로 수집 종료 - page={}, 누적={}", page, totalSaved);
                return CollectResultDto.stopped(page, totalCount, totalSaved);
            }

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

    /** 데이터셋 전체 수집 */
    public CollectResultDto collectDataset() {
        return collectDataType(datasetPath, "dataset");
    }

    /** 파일데이터 전체 수집 */
    public CollectResultDto collectFileData() {
        return collectDataType(fileDataPath, "file-data");
    }

    /** 표준데이터 전체 수집 */
    public CollectResultDto collectStandardData() {
        return collectDataType(standardDataPath, "standard-data");
    }

    public void stopCollect() {
        stateService.requestStop();
        log.info("[Collect] 중지 요청 접수");
    }

    private CollectResultDto collectDataType(String path, String sourceType) {
        stateService.reset();
        int page = 1;
        int totalSaved = 0;
        int totalCount = 0;

        while (true) {
            if (stateService.isStopRequested()) {
                log.info("[Collect-{}] 중지 요청으로 수집 종료 - page={}, 누적={}", sourceType, page, totalSaved);
                return CollectResultDto.stopped(page, totalCount, totalSaved);
            }

            PublicDataResponseDto response = fetchService.fetchDataPage(page, path);

            if (response == null || response.getData() == null || response.getData().isEmpty()) {
                log.warn("[Collect-{}] page={} 응답 없음 - 수집 종료", sourceType, page);
                break;
            }

            totalCount = response.getTotalCount();
            int saved = dataSaveService.saveAll(response.getData(), sourceType);
            totalSaved += saved;

            log.info("[Collect-{}] page={} / saved={} / 누적={} / 전체={}",
                    sourceType, page, saved, totalSaved, totalCount);

            if ((long) page * fetchService.getPageSize() >= totalCount) break;
            page++;
        }

        return CollectResultDto.success(page, totalCount, totalSaved);
    }
}

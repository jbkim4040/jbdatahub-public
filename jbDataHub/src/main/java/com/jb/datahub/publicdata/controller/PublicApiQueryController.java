package com.jb.datahub.publicdata.controller;

import com.jb.datahub.publicdata.dto.DataItemStatsDto;
import com.jb.datahub.publicdata.dto.PublicApiDetailDto;
import com.jb.datahub.publicdata.dto.PageResponseDto;
import com.jb.datahub.publicdata.dto.PublicApiListDto;
import com.jb.datahub.publicdata.dto.PublicDataItemResponseDto;
import com.jb.datahub.publicdata.dto.StatsDto;
import com.jb.datahub.publicdata.service.PublicApiQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public-data")
@RequiredArgsConstructor
@Tag(name = "공공데이터 조회 API", description = "DB 저장 데이터 조회 (인증 불필요)")
public class PublicApiQueryController {

    private final PublicApiQueryService queryService;

    @GetMapping("/list")
    @Operation(summary = "목록 조회", description = "저장된 OpenAPI 목록을 페이징 조회합니다.")
    public ResponseEntity<PageResponseDto<PublicApiListDto>> getList(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String title,
            @Parameter(description = "정렬 필드: listTitle | orgNm | requestCnt | updatedAt")
            @RequestParam(required = false) String sortBy,
            @Parameter(description = "정렬 방향: asc | desc")
            @RequestParam(required = false) String sortDir
    ) {
        return ResponseEntity.ok(queryService.getList(page, size, title, sortBy, sortDir));
    }

    @GetMapping("/stats")
    @Operation(summary = "통계 조회 (OpenAPI)", description = "전체 건수, API 유형별·분류별·제공기관별 건수를 반환합니다.")
    public ResponseEntity<StatsDto> getStats() {
        return ResponseEntity.ok(queryService.getStats());
    }

    @GetMapping("/stats/data-items")
    @Operation(summary = "통계 조회 (데이터 유형)", description = "dataset | file-data | standard-data 유형별 통계를 반환합니다.")
    public ResponseEntity<DataItemStatsDto> getDataItemStats(
            @Parameter(description = "데이터 유형: dataset | file-data | standard-data", required = true)
            @RequestParam String sourceType
    ) {
        return ResponseEntity.ok(queryService.getDataItemStats(sourceType));
    }

    @GetMapping("/data-items")
    @Operation(summary = "수집 데이터 목록 조회", description = "저장된 데이터셋/파일데이터/표준데이터를 페이징 조회합니다.")
    public ResponseEntity<PageResponseDto<PublicDataItemResponseDto>> getDataItems(
            @RequestParam(required = false) String sourceType,
            @RequestParam(required = false) String title,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "정렬 필드: title | orgNm | viewCnt | downloadCnt | updatedAt")
            @RequestParam(required = false) String sortBy,
            @Parameter(description = "정렬 방향: asc | desc")
            @RequestParam(required = false) String sortDir
    ) {
        return ResponseEntity.ok(queryService.getDataItems(sourceType, page, size, title, sortBy, sortDir));
    }

    @GetMapping("/detail/{listId}")
    @Operation(summary = "API detail")
    public ResponseEntity<PublicApiDetailDto> getDetail(@PathVariable String listId) {
        return ResponseEntity.ok(queryService.getDetail(listId));
    }
}
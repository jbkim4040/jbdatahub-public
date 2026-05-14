package com.jb.datahub.publicdata.controller;

import com.jb.datahub.publicdata.dto.CollectResultDto;
import com.jb.datahub.publicdata.service.PublicApiService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "관리자 API", description = "관리자 전용 — JWT Bearer 토큰 필요")
@SecurityRequirement(name = "bearerAuth")
public class PublicApiCollectController {

    private final PublicApiService publicApiService;

    @PostMapping("/collect")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "전체 수집", description = "외부 API 전체 페이지를 수집하여 DB에 저장합니다. (관리자 전용)")
    public ResponseEntity<CollectResultDto> collectAll() {
        return ResponseEntity.ok(publicApiService.collectAll());
    }

    @PostMapping("/collect/page/{page}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "단일 페이지 수집", description = "지정한 페이지(100건)만 수집합니다. (관리자 전용)")
    public ResponseEntity<CollectResultDto> collectPage(
            @Parameter(description = "페이지 번호 (1부터 시작)", example = "1", required = true)
            @PathVariable int page
    ) {
        CollectResultDto result = publicApiService.collectPage(page);
        return "fail".equals(result.getStatus())
                ? ResponseEntity.badRequest().body(result)
                : ResponseEntity.ok(result);
    }

    @PostMapping("/collect/dataset")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "데이터셋 전체 수집", description = "공공데이터포털 전체 데이터셋 목록을 수집하여 DB에 저장합니다. (관리자 전용)")
    public ResponseEntity<CollectResultDto> collectDataset() {
        return ResponseEntity.ok(publicApiService.collectDataset());
    }

    @PostMapping("/collect/file-data")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "파일데이터 전체 수집", description = "공공데이터포털 파일데이터 목록을 수집하여 DB에 저장합니다. (관리자 전용)")
    public ResponseEntity<CollectResultDto> collectFileData() {
        return ResponseEntity.ok(publicApiService.collectFileData());
    }

    @PostMapping("/collect/standard-data")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "표준데이터 전체 수집", description = "공공데이터포털 표준데이터 목록을 수집하여 DB에 저장합니다. (관리자 전용)")
    public ResponseEntity<CollectResultDto> collectStandardData() {
        return ResponseEntity.ok(publicApiService.collectStandardData());
    }

    @PostMapping("/collect/stop")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "수집 중지", description = "현재 진행 중인 수집 작업을 중단합니다. (관리자 전용)")
    public ResponseEntity<Void> stopCollect() {
        publicApiService.stopCollect();
        return ResponseEntity.ok().build();
    }
}

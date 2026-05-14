package com.jb.datahub.publicdata.controller;

import com.jb.datahub.publicdata.dto.CollectResultDto;
import com.jb.datahub.publicdata.dto.CollectStatusDto;
import com.jb.datahub.publicdata.service.CollectionStateService;
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

    private final PublicApiService       publicApiService;
    private final CollectionStateService stateService;

    @GetMapping("/collect/status")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "수집 상태 조회", description = "현재 수집 진행 상태 및 타입별 최근 수집 이력을 반환합니다.")
    public ResponseEntity<CollectStatusDto> getStatus() {
        return ResponseEntity.ok(new CollectStatusDto(stateService.snapshot()));
    }

    @PostMapping("/collect")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "OpenAPI 목록 전체 수집", description = "비동기로 수집을 시작합니다. 진행 상황은 /collect/status 로 조회하세요.")
    public ResponseEntity<Void> collectAll() {
        if (stateService.isRunning()) return ResponseEntity.status(409).build();
        publicApiService.collectAllAsync();
        return ResponseEntity.accepted().build();
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
    @Operation(summary = "데이터셋 전체 수집", description = "비동기로 수집을 시작합니다.")
    public ResponseEntity<Void> collectDataset() {
        if (stateService.isRunning()) return ResponseEntity.status(409).build();
        publicApiService.collectDatasetAsync();
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/collect/file-data")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "파일데이터 전체 수집", description = "비동기로 수집을 시작합니다.")
    public ResponseEntity<Void> collectFileData() {
        if (stateService.isRunning()) return ResponseEntity.status(409).build();
        publicApiService.collectFileDataAsync();
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/collect/standard-data")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "표준데이터 전체 수집", description = "비동기로 수집을 시작합니다.")
    public ResponseEntity<Void> collectStandardData() {
        if (stateService.isRunning()) return ResponseEntity.status(409).build();
        publicApiService.collectStandardDataAsync();
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/collect/stop")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "수집 중지", description = "현재 진행 중인 수집 작업을 중단합니다.")
    public ResponseEntity<Void> stopCollect() {
        publicApiService.stopCollect();
        return ResponseEntity.ok().build();
    }
}

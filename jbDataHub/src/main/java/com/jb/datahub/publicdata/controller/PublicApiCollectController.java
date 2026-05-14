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
}

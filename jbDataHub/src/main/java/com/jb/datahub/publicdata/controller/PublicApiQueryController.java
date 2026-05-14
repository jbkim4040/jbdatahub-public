package com.jb.datahub.publicdata.controller;

import com.jb.datahub.publicdata.dto.PageResponseDto;
import com.jb.datahub.publicdata.dto.PublicApiListDto;
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
    @Operation(
            summary = "목록 조회",
            description = "저장된 OpenAPI 목록을 페이징 조회합니다. title 파라미터로 list_title 검색 가능."
    )
    public ResponseEntity<PageResponseDto<PublicApiListDto>> getList(
            @Parameter(description = "페이지 번호 (0부터 시작)", example = "0")
            @RequestParam(defaultValue = "0") int page,

            @Parameter(description = "페이지 크기", example = "20")
            @RequestParam(defaultValue = "20") int size,

            @Parameter(description = "목록명 검색어 (list_title 포함 검색)")
            @RequestParam(required = false) String title
    ) {
        return ResponseEntity.ok(queryService.getList(page, size, title));
    }

    @GetMapping("/stats")
    @Operation(
            summary = "통계 조회",
            description = "전체 건수, API 유형별·분류별·제공기관별 건수를 반환합니다."
    )
    public ResponseEntity<StatsDto> getStats() {
        return ResponseEntity.ok(queryService.getStats());
    }
}

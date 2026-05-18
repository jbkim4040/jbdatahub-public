package com.jb.datahub.publicdata.controller;

import com.jb.datahub.publicdata.dto.RelatedDatasetDto;
import com.jb.datahub.publicdata.service.RelatedDatasetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public-data")
@RequiredArgsConstructor
@Tag(name = "관련 데이터셋 API", description = "키워드 기반 연관 데이터셋 추천")
public class RelatedDatasetController {

    private final RelatedDatasetService service;

    @GetMapping("/related")
    @Operation(summary = "검색 키워드와 연관있는 데이터셋", description = "pg_trgm 유사도 + 부분 매칭으로 상위 N개 추천")
    public ResponseEntity<List<RelatedDatasetDto>> related(
            @RequestParam String q,
            @RequestParam(defaultValue = "5") int limit
    ) {
        if (q == null || q.isBlank()) {
            return ResponseEntity.ok(List.of());
        }
        int safeLimit = Math.max(1, Math.min(limit, 20));
        return ResponseEntity.ok(service.related(q.trim(), safeLimit));
    }
}

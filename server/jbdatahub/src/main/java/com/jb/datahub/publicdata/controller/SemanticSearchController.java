package com.jb.datahub.publicdata.controller;

import com.jb.datahub.publicdata.dto.PageResponseDto;
import com.jb.datahub.publicdata.dto.PublicApiListDto;
import com.jb.datahub.publicdata.dto.SimilarApiDto;
import com.jb.datahub.publicdata.dto.TopicDto;
import com.jb.datahub.publicdata.service.SemanticSearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public-data")
@RequiredArgsConstructor
@Tag(name = "의미 검색 API", description = "pgvector 임베딩 기반 의미 검색, 유사 API, 토픽 그룹핑")
public class SemanticSearchController {

    private final SemanticSearchService semanticSearchService;

    @GetMapping("/semantic")
    @Operation(summary = "의미 기반 검색", description = "쿼리를 임베딩하여 의미적으로 유사한 API 목록을 반환합니다.")
    public ResponseEntity<PageResponseDto<PublicApiListDto>> semanticSearch(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        return ResponseEntity.ok(semanticSearchService.semanticSearch(q, safePage, safeSize));
    }

    @GetMapping("/{listId}/similar")
    @Operation(summary = "유사 API 조회", description = "지정한 API와 의미적으로 가장 유사한 상위 10개를 반환합니다.")
    public ResponseEntity<List<SimilarApiDto>> getSimilar(@PathVariable String listId) {
        return ResponseEntity.ok(semanticSearchService.getSimilar(listId));
    }

    @GetMapping("/topics")
    @Operation(summary = "토픽 목록 조회", description = "K-means 클러스터링으로 생성된 토픽 목록과 각 토픽의 건수를 반환합니다.")
    public ResponseEntity<List<TopicDto>> getTopics() {
        return ResponseEntity.ok(semanticSearchService.getTopics());
    }

    @GetMapping("/topics/{topicId}/list")
    @Operation(summary = "토픽별 API 목록 조회", description = "지정한 토픽에 속하는 API 목록을 페이징 조회합니다.")
    public ResponseEntity<PageResponseDto<PublicApiListDto>> getListByTopic(
            @PathVariable int topicId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        return ResponseEntity.ok(semanticSearchService.getListByTopic(topicId, safePage, safeSize));
    }
}

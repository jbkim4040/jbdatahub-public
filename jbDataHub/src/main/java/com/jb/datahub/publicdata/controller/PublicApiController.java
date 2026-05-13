package com.jb.datahub.publicdata.controller;

import com.jb.datahub.publicdata.dto.CollectResultDto;
import com.jb.datahub.publicdata.service.PublicApiService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public-data")
@RequiredArgsConstructor
@Tag(name = "공공데이터 수집 API", description = "data.go.kr OpenAPI 목록 수집 및 DB 저장")
public class PublicApiController {

    private final PublicApiService publicApiService;

    @PostMapping("/collect")
    @Operation(
            summary = "전체 수집",
            description = "공공데이터포털 OpenAPI 목록 전체를 페이지별로 수집하여 DB에 저장합니다."
    )
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "수집 성공",
                    content = @Content(
                            mediaType = MediaType.APPLICATION_JSON_VALUE,
                            schema = @Schema(implementation = CollectResultDto.class),
                            examples = @ExampleObject(value = """
                                    {
                                      "status": "success",
                                      "page": 172,
                                      "totalCount": 17170,
                                      "savedCount": 17170,
                                      "message": null
                                    }
                                    """)
                    )
            ),
            @ApiResponse(responseCode = "500", description = "서버 오류 또는 외부 API 호출 실패")
    })
    public ResponseEntity<CollectResultDto> collectAll() {
        CollectResultDto result = publicApiService.collectAll();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/collect/page/{page}")
    @Operation(
            summary = "단일 페이지 수집",
            description = "지정한 페이지(100건)만 수집합니다. 테스트 및 부분 재수집 용도."
    )
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "수집 성공",
                    content = @Content(
                            mediaType = MediaType.APPLICATION_JSON_VALUE,
                            schema = @Schema(implementation = CollectResultDto.class),
                            examples = @ExampleObject(value = """
                                    {
                                      "status": "success",
                                      "page": 1,
                                      "totalCount": 17170,
                                      "savedCount": 100,
                                      "message": null
                                    }
                                    """)
                    )
            ),
            @ApiResponse(responseCode = "400", description = "해당 페이지 데이터 없음"),
            @ApiResponse(responseCode = "500", description = "서버 오류")
    })
    public ResponseEntity<CollectResultDto> collectPage(
            @Parameter(description = "수집할 페이지 번호 (1부터 시작)", example = "1", required = true)
            @PathVariable int page
    ) {
        CollectResultDto result = publicApiService.collectPage(page);

        if ("fail".equals(result.getStatus())) {
            return ResponseEntity.badRequest().body(result);
        }
        return ResponseEntity.ok(result);
    }
}

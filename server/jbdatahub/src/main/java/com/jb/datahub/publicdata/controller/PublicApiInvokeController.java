package com.jb.datahub.publicdata.controller;

import com.jb.datahub.publicdata.dto.InvokeRequestDto;
import com.jb.datahub.publicdata.dto.InvokeResultDto;
import com.jb.datahub.publicdata.service.PublicApiInvokeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/public-data")
@RequiredArgsConstructor
@Tag(name = "공공 API 호출", description = "카탈로그의 공공 OpenAPI를 사용자 인증키로 직접 호출(프록시)")
public class PublicApiInvokeController {

    private final PublicApiInvokeService publicApiInvokeService;

    @PostMapping("/invoke")
    @Operation(
            summary = "공공 API 호출",
            description = """
                    목록 화면의 'API 호출'에 대응하는 엔드포인트.
                    operationSeq(저장된 오퍼레이션) 또는 endpointUrl 로 대상 API를 지정하고,
                    사용자의 인증키(serviceKey)로 호출하여 원본 응답을 그대로 반환한다.
                    SSRF 방지를 위해 공공데이터포털 계열 HTTPS 도메인만 호출할 수 있다.
                    외부 호출은 논블로킹으로 처리된다.
                    """
    )
    public Mono<ResponseEntity<InvokeResultDto>> invoke(@RequestBody InvokeRequestDto request) {
        return publicApiInvokeService.invoke(request)
                .map(result -> "fail".equals(result.getStatus())
                        ? ResponseEntity.badRequest().body(result)
                        : ResponseEntity.ok(result));
    }
}

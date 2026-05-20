package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.InvokeRequestDto;
import com.jb.datahub.publicdata.dto.InvokeResultDto;
import com.jb.datahub.publicdata.entity.PublicApiOperation;
import com.jb.datahub.publicdata.repository.PublicApiOperationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 공공 API 호출(프록시) 서비스
 * - 사용자가 가져온 인증키로 공공데이터포털 OpenAPI 를 대신 호출하고 원본 응답을 반환
 * - 컨트롤러가 Mono 를 반환하므로, DB 조회·외부 호출 동안 서블릿 요청 스레드는 비동기로 풀린다
 *   (DB 조회는 blocking 이라 boundedElastic 스케줄러로 분리한다)
 * - DB 에 저장하지 않는다 (단발 호출 / 테스트 용도)
 * - 목록 화면의 'API 호출' 기능이 이 서비스를 사용한다
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublicApiInvokeService {

    /** invoke 전용 WebClient (followRedirect=false, 2MB 버퍼) — WebClientConfig 참조 */
    private final WebClient invokeWebClient;
    private final PublicApiOperationRepository operationRepository;

    /** SSRF 방지 — 공공데이터포털 계열 호스트만 허용 */
    private static final Set<String> ALLOWED_HOSTS = Set.of(
            "apis.data.go.kr",
            "api.data.go.kr",
            "data.go.kr",
            "www.data.go.kr",
            "api.odcloud.kr",
            "odcloud.kr"
    );

    /** data.go.kr 의 1단계 서브도메인만 허용 (deep subdomain 우회 방지) */
    private static final Pattern DATA_GO_KR_SUBDOMAIN =
            Pattern.compile("^[a-z0-9\\-]+\\.data\\.go\\.kr$");

    /** 사용자 대면 호출이므로 타임아웃은 짧게 */
    private static final Duration TIMEOUT = Duration.ofSeconds(8);

    // 입력 크기 상한 — 대용량 payload 로 인한 메모리 소모(DoS) 방지
    private static final int MAX_SERVICE_KEY_LEN = 1000;
    private static final int MAX_ENDPOINT_URL_LEN = 2048;
    private static final int MAX_PARAM_COUNT = 30;

    /**
     * 공공 API 를 호출하고 원본 응답을 반환한다.
     */
    public Mono<InvokeResultDto> invoke(InvokeRequestDto request) {
        // 1) DB 접근이 없는 빠른 입력 검증
        String serviceKey = request.getServiceKey();
        if (serviceKey == null || serviceKey.isBlank()) {
            return Mono.just(InvokeResultDto.fail("serviceKey(인증키)가 필요합니다."));
        }
        if (serviceKey.length() > MAX_SERVICE_KEY_LEN) {
            return Mono.just(InvokeResultDto.fail("serviceKey가 너무 깁니다."));
        }
        if (serviceKey.contains("&") || serviceKey.contains("#") || serviceKey.contains("?")) {
            return Mono.just(InvokeResultDto.fail(
                    "serviceKey에 허용되지 않는 문자(&, #, ?)가 포함되어 있습니다."));
        }
        if (request.getEndpointUrl() != null
                && request.getEndpointUrl().length() > MAX_ENDPOINT_URL_LEN) {
            return Mono.just(InvokeResultDto.fail("endpointUrl이 너무 깁니다."));
        }
        if (request.getParams() != null && request.getParams().size() > MAX_PARAM_COUNT) {
            return Mono.just(InvokeResultDto.fail(
                    "요청 파라미터가 너무 많습니다. (최대 " + MAX_PARAM_COUNT + "개)"));
        }

        // 2) 대상 URL 결정 — JPA 조회는 blocking 이므로 boundedElastic 스레드로 분리
        return Mono.fromCallable(() -> resolveTargetUrl(request))
                .subscribeOn(Schedulers.boundedElastic())
                .flatMap(targetUrl -> doInvoke(targetUrl, request));
    }

    /** 검증된 대상 URL 로 실제 호출 (논블로킹) */
    private Mono<InvokeResultDto> doInvoke(String targetUrl, InvokeRequestDto request) {
        if (targetUrl == null || targetUrl.isBlank()) {
            return Mono.just(InvokeResultDto.fail(
                    "호출 대상 URL이 없습니다. operationSeq 또는 endpointUrl 중 하나는 필수입니다."));
        }

        // URL 파싱 + 스키마·호스트 검증 (SSRF 방지)
        URI parsed;
        try {
            parsed = new URI(targetUrl);
        } catch (URISyntaxException e) {
            return Mono.just(InvokeResultDto.fail("잘못된 URL 형식입니다."));
        }
        if (!"https".equalsIgnoreCase(parsed.getScheme())) {
            return Mono.just(InvokeResultDto.fail("HTTPS 프로토콜만 허용됩니다."));
        }
        final String host = parsed.getHost();
        if (host == null || !isAllowedHost(host)) {
            return Mono.just(InvokeResultDto.fail(
                    "허용되지 않은 호스트입니다 (공공데이터포털 계열 도메인만 호출할 수 있습니다)."));
        }

        // 호출 — 논블로킹
        final URI uri = buildUri(targetUrl, request);
        final long start = System.currentTimeMillis();
        return invokeWebClient.get()
                .uri(uri)
                .exchangeToMono(response ->
                        response.bodyToMono(String.class)
                                .defaultIfEmpty("")
                                .map(body -> InvokeResultDto.success(
                                        response.statusCode().value(),
                                        response.headers().contentType()
                                                .map(MediaType::toString).orElse(null),
                                        body,
                                        System.currentTimeMillis() - start,
                                        maskKey(uri.toString())
                                ))
                )
                .timeout(TIMEOUT)
                .doOnNext(r -> log.info("[Invoke] host={} status={} elapsed={}ms",
                        host, r.getHttpStatus(), r.getElapsedMs()))
                .onErrorResume(e -> {
                    // 예외 메시지에 URL(serviceKey 포함)이 담길 수 있어 반드시 마스킹
                    String safeMsg = maskKey(e.getMessage() != null ? e.getMessage() : "unknown error");
                    log.error("[Invoke] 호출 실패 - host={}, error={}", host, safeMsg);
                    return Mono.just(InvokeResultDto.fail("API 호출 실패: " + safeMsg));
                });
    }

    /** operationSeq 가 있으면 저장된 오퍼레이션 URL, 없으면 endpointUrl. 없으면 빈 문자열. */
    private String resolveTargetUrl(InvokeRequestDto request) {
        if (request.getOperationSeq() != null) {
            return operationRepository.findById(request.getOperationSeq())
                    .map(PublicApiOperation::getOperationUrl)
                    .orElse("");
        }
        String url = request.getEndpointUrl();
        return url == null ? "" : url;
    }

    private boolean isAllowedHost(String host) {
        String h = host.toLowerCase();
        return ALLOWED_HOSTS.contains(h) || DATA_GO_KR_SUBDOMAIN.matcher(h).matches();
    }

    /**
     * 최종 호출 URI 구성.
     * - serviceKey 는 data.go.kr 의 Encoding 인증키(이미 URL 인코딩됨)로 가정해 그대로 부착
     *   (호출 전 &, #, ? 문자는 거부하여 파라미터·URL 구조 인젝션을 차단한다)
     * - params 의 키/값은 UTF-8 로 URL 인코딩
     */
    private URI buildUri(String targetUrl, InvokeRequestDto request) {
        StringBuilder sb = new StringBuilder(targetUrl);
        sb.append(targetUrl.contains("?") ? "&" : "?");
        sb.append("serviceKey=").append(request.getServiceKey());

        if (request.getParams() != null) {
            request.getParams().forEach((key, value) -> {
                if (key == null || key.isBlank()) return;
                sb.append("&")
                        .append(URLEncoder.encode(key, StandardCharsets.UTF_8))
                        .append("=")
                        .append(URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8));
            });
        }
        return URI.create(sb.toString());
    }

    /** 로그·응답에 인증키 원문이 노출되지 않도록 마스킹 (URL·예외 메시지 공통) */
    private String maskKey(String text) {
        return text.replaceAll("(serviceKey=)[^&\\s]+", "$1***");
    }
}

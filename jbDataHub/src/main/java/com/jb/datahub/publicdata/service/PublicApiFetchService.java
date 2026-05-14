package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.PublicApiResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

/**
 * 외부 API 조회만 담당
 * - data.go.kr / odcloud.kr 호출
 * - DB 접근 없음
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublicApiFetchService {

    private final WebClient webClient;

    @Value("${publicdata.api.base-url}")
    private String baseUrl;

    @Value("${publicdata.api.fallback-base-url:}")
    private String fallbackBaseUrl;

    @Value("${publicdata.api.path}")
    private String apiPath;

    @Value("${publicdata.api.service-key}")
    private String serviceKey;

    private static final int PAGE_SIZE = 100;

    /**
     * 특정 페이지의 OpenAPI 목록을 외부 API에서 조회
     * 주 서버 실패 시 fallback 서버로 재시도
     *
     * @param page 1부터 시작
     * @return API 응답 DTO (null 가능)
     */
    public PublicApiResponseDto fetchPage(int page) {
        try {
            PublicApiResponseDto result = fetchFromBaseUrl(baseUrl, page);
            if (result != null) return result;
        } catch (Exception e) {
            log.warn("[Fetch] 주 서버 실패 - page={}, error={}", page, e.getMessage());
        }

        if (fallbackBaseUrl == null || fallbackBaseUrl.isBlank()) {
            log.error("[Fetch] fallback URL 미설정 - page={}", page);
            return null;
        }

        log.info("[Fetch] fallback 서버로 재시도 - page={}, url={}", page, fallbackBaseUrl);
        try {
            return fetchFromBaseUrl(fallbackBaseUrl, page);
        } catch (Exception e) {
            log.error("[Fetch] fallback 서버도 실패 - page={}, error={}", page, e.getMessage());
            return null;
        }
    }

    private PublicApiResponseDto fetchFromBaseUrl(String base, int page) {
        URI uri = UriComponentsBuilder
                .fromHttpUrl(base + apiPath)
                .queryParam("serviceKey", serviceKey)
                .queryParam("page", page)
                .queryParam("perPage", PAGE_SIZE)
                .build(true)   // 이중 인코딩 방지 (serviceKey에 +, = 포함)
                .toUri();

        log.debug("[Fetch] 요청 URI: {}", uri);

        return webClient.get()
                .uri(uri)
                .retrieve()
                .bodyToMono(PublicApiResponseDto.class)
                .block();
    }

    public int getPageSize() {
        return PAGE_SIZE;
    }
}

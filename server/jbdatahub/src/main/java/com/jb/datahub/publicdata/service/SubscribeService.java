package com.jb.datahub.publicdata.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubscribeService {

    @Value("${admin.portal.url:https://admin.jbdatahub.com}")
    private String adminPortalUrl;

    @Value("${admin.portal.internal-token:jb-internal-svc-token-2026}")
    private String internalToken;

    private final RestTemplate restTemplate = new RestTemplate();

    public Map<String, Object> requestSubscription(String listId, Map<String, Object> body, String user) {
        Map<String, Object> payload = new HashMap<>(body == null ? Map.of() : body);
        payload.put("list_id", listId);
        payload.put("requested_by", user);
        payload.putIfAbsent("usage_purpose", "jb-workspace 사용자 신청 — 통합 검색/분석 (" + user + ")");
        payload.putIfAbsent("purpose_code", "WEB");
        payload.putIfAbsent("daily_use_expect", 1000);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> resp = restTemplate.exchange(
                    adminPortalUrl + "/api/subscription/request",
                    org.springframework.http.HttpMethod.POST,
                    new org.springframework.http.HttpEntity<>(payload, internalHeaders()),
                    Map.class
            ).getBody();
            return resp != null ? resp : Map.of("ok", true);
        } catch (HttpClientErrorException e) {
            // 409 (이미 신청)는 그대로 전파
            if (e.getStatusCode() == HttpStatus.CONFLICT) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "이미 신청한 데이터셋입니다.");
            }
            log.error("admin-portal 신청 실패: {} {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new ResponseStatusException(
                    HttpStatus.valueOf(e.getStatusCode().value()),
                    "admin-portal 신청 실패: " + e.getResponseBodyAsString()
            );
        } catch (RestClientException e) {
            log.error("admin-portal 연결 실패", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "admin-portal 연결 실패: " + e.getMessage());
        }
    }

    private org.springframework.http.HttpHeaders internalHeaders() {
        org.springframework.http.HttpHeaders h = new org.springframework.http.HttpHeaders();
        h.set("X-Internal-Token", internalToken);
        h.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
        return h;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getUserSubscribedIds(String user) {
        try {
            Map<String, Object> resp = restTemplate.exchange(
                    adminPortalUrl + "/api/subscription/user-subscribed-ids?requested_by=" + user,
                    org.springframework.http.HttpMethod.GET,
                    new org.springframework.http.HttpEntity<>(internalHeaders()),
                    Map.class
            ).getBody();
            return resp != null ? resp : Map.of("items", java.util.List.of());
        } catch (Exception e) {
            log.warn("my-subscriptions 조회 실패: {}", e.getMessage());
            return Map.of("items", java.util.List.of());
        }
    }
}

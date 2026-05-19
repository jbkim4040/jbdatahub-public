package com.jb.datahub.publicdata.controller;

import com.jb.datahub.publicdata.service.SubscribeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/public-data")
@RequiredArgsConstructor
@Tag(name = "공공데이터 자동 신청 API")
public class SubscribeController {

    private final SubscribeService subscribeService;

    @PostMapping("/{listId}/subscribe")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "자동 신청 등록 (인증 사용자별)")
    public ResponseEntity<Map<String, Object>> subscribe(
            @PathVariable String listId,
            @RequestBody(required = false) Map<String, Object> body,
            Principal principal
    ) {
        String user = principal != null ? principal.getName() : "anonymous";
        try {
            return ResponseEntity.ok(subscribeService.requestSubscription(listId, body, user));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            java.util.Map<String,Object> err = new java.util.HashMap<>();
            err.put("error", e.getReason() != null ? e.getReason() : "error");
            err.put("status", e.getStatusCode().value());
            return ResponseEntity.status(e.getStatusCode()).body(err);
        }
    }

    @PostMapping("/{listId}/subscribe/manual")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "수동 신청 등록 — 사용자가 data.go.kr에서 직접 신청 후 jb-workspace에 마킹")
    public ResponseEntity<Map<String, Object>> markManual(
            @PathVariable String listId,
            Principal principal
    ) {
        String user = principal != null ? principal.getName() : "anonymous";
        try {
            return ResponseEntity.ok(subscribeService.markManual(listId, user));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            java.util.Map<String, Object> err = new java.util.HashMap<>();
            err.put("error", e.getReason() != null ? e.getReason() : "error");
            err.put("status", e.getStatusCode().value());
            return ResponseEntity.status(e.getStatusCode()).body(err);
        }
    }

    @GetMapping("/my-subscriptions")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "현재 사용자의 신청 목록 (활성 status)")
    public ResponseEntity<Map<String, Object>> mySubscriptions(Principal principal) {
        String user = principal != null ? principal.getName() : "anonymous";
        try {
            return ResponseEntity.ok(subscribeService.getUserSubscribedIds(user));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(java.util.Map.of("items", java.util.List.of()));
        }
    }
}

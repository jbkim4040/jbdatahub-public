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
        return ResponseEntity.ok(subscribeService.requestSubscription(listId, body, user));
    }

    @GetMapping("/my-subscriptions")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "현재 사용자의 신청 목록 (활성 status)")
    public ResponseEntity<Map<String, Object>> mySubscriptions(Principal principal) {
        String user = principal != null ? principal.getName() : "anonymous";
        return ResponseEntity.ok(subscribeService.getUserSubscribedIds(user));
    }
}

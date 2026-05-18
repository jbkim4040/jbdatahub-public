package com.jb.datahub.publicdata.controller;

import com.jb.datahub.publicdata.service.SubscribeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/public-data")
@RequiredArgsConstructor
@Tag(name = "공공데이터 자동 신청 API", description = "data.go.kr 자동 신청 트리거")
public class SubscribeController {

    private final SubscribeService subscribeService;

    @PostMapping("/{listId}/subscribe")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @Operation(summary = "자동 신청 등록", description = "list_id 기준 자동 신청 (백엔드 admin-portal API 위임)")
    public ResponseEntity<Map<String, Object>> subscribe(
            @PathVariable String listId,
            @RequestBody Map<String, Object> body
    ) {
        Map<String, Object> result = subscribeService.requestSubscription(listId, body);
        return ResponseEntity.ok(result);
    }
}

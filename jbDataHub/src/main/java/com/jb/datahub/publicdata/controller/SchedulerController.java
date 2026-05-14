package com.jb.datahub.publicdata.controller;

import com.jb.datahub.publicdata.dto.CollectScheduleConfigDto;
import com.jb.datahub.publicdata.entity.CollectScheduleConfig;
import com.jb.datahub.publicdata.service.SchedulerConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "관리자 API")
@SecurityRequirement(name = "bearerAuth")
public class SchedulerController {

    private final SchedulerConfigService schedulerConfigService;

    @GetMapping("/scheduler")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "자동 수집 스케줄 조회")
    public ResponseEntity<CollectScheduleConfigDto> getScheduler() {
        return ResponseEntity.ok(new CollectScheduleConfigDto(schedulerConfigService.getOrDefault()));
    }

    @PutMapping("/scheduler")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "자동 수집 스케줄 설정")
    public ResponseEntity<CollectScheduleConfigDto> updateScheduler(@RequestBody CollectScheduleConfigDto dto) {
        CollectScheduleConfig config = schedulerConfigService.update(dto);
        return ResponseEntity.ok(new CollectScheduleConfigDto(config));
    }
}

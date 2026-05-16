package com.jb.datahub;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class HealthController {

    private final JdbcTemplate jdbcTemplate;

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("status", "UP");
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            status.put("db", "UP");
        } catch (Exception e) {
            status.put("db", "DOWN");
            status.put("status", "DOWN");
            return ResponseEntity.status(503).body(status);
        }
        return ResponseEntity.ok(status);
    }
}

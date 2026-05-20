package com.jb.datahub.publicdata.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 신규/갱신된 dataset row 임베딩 자동 백필.
 *
 * 동작:
 *  - 매 시 30분: title_embedding IS NULL (신규) 또는 embedded_at < updated_at (제목 변경) 인
 *    row 최대 1000건 처리
 *  - embed_service /embed_batch 호출 (X-Internal-Token 포함)
 *  - UPDATE title_embedding + embedded_at
 *  - 토픽/유사도 재계산은 DB 서버 cron (run_kmeans.py + run_similar_top10.py) — 주 1회
 *
 * embedded_at 컬럼이 아직 없으면 (마이그레이션 전) NULL-only 모드로 degrade.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmbeddingBackfillScheduler {

    private final JdbcTemplate   jdbcTemplate;
    private final WebClient      webClient;
    private final SchedulerLock  schedulerLock;

    @Value("${embed.url:http://localhost:8001}")
    private String embedUrl;

    @Value("${embed.internalToken:}")
    private String embedInternalToken;

    private static final int BATCH_SIZE   = 32;
    private static final int CYCLE_LIMIT  = 1000;

    /** embedded_at 컬럼 존재 여부 — 시작 시 1회 감지 */
    private volatile boolean hasEmbeddedAt = false;

    @PostConstruct
    public void detectSchema() {
        try {
            Integer c = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns " +
                "WHERE table_name = 'public_api_list' AND column_name = 'embedded_at'",
                Integer.class);
            hasEmbeddedAt = (c != null && c > 0);
        } catch (Exception e) {
            hasEmbeddedAt = false;
        }
        log.info("[EmbeddingBackfill] embedded_at 컬럼 = {}", hasEmbeddedAt ? "있음 (stale 재임베딩 활성)" : "없음 (NULL-only 모드)");
    }

    @Scheduled(cron = "0 30 * * * *", zone = "Asia/Seoul")
    public void backfillEmbeddings() {
        // Blue/Green 오버랩 중 중복 실행 방지 (TTL 3000s < 3600s 주기)
        if (!schedulerLock.tryAcquire("embedding-backfill", 3000)) return;
        try {
            int aListDone = backfillTable("public_api_list", "list_id", "list_title");
            int aItemDone = backfillTable("public_data_item", "id", "title");
            log.info("[EmbeddingBackfill] cycle done: list={}, item={}", aListDone, aItemDone);
        } catch (Exception e) {
            log.error("[EmbeddingBackfill] cycle failed: {}", e.getMessage(), e);
        }
    }

    private int backfillTable(String table, String idCol, String textCol) {
        // 신규(IMBEDDING NULL) + (컬럼 있으면) stale(embedded_at < updated_at)
        String staleClause = hasEmbeddedAt
            ? " OR embedded_at IS NULL OR embedded_at < updated_at"
            : "";
        String selectSql =
            "SELECT " + idCol + " AS id, " + textCol + " AS text FROM " + table +
            " WHERE COALESCE(is_deleted,'N') = 'N' AND " + textCol + " IS NOT NULL " +
            "   AND (title_embedding IS NULL" + staleClause + ") " +
            "LIMIT ?";
        String updateSql = hasEmbeddedAt
            ? "UPDATE " + table + " SET title_embedding = CAST(? AS vector), embedded_at = now() WHERE " + idCol + " = ?"
            : "UPDATE " + table + " SET title_embedding = CAST(? AS vector) WHERE " + idCol + " = ?";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(selectSql, CYCLE_LIMIT);
        if (rows.isEmpty()) return 0;

        int done = 0;
        for (int from = 0; from < rows.size(); from += BATCH_SIZE) {
            int to = Math.min(from + BATCH_SIZE, rows.size());
            List<Map<String, Object>> chunk = rows.subList(from, to);
            List<String> texts = chunk.stream()
                .map(r -> String.valueOf(r.get("text")))
                .map(s -> s.length() > 500 ? s.substring(0, 500) : s)
                .collect(Collectors.toList());

            List<List<Double>> embeddings = embedBatch(texts);
            if (embeddings == null || embeddings.size() != chunk.size()) {
                log.warn("[EmbeddingBackfill] {} embed_service 응답 불일치 — 청크 스킵", table);
                continue;
            }

            for (int i = 0; i < chunk.size(); i++) {
                String vec = "[" + embeddings.get(i).stream()
                    .map(Object::toString).collect(Collectors.joining(",")) + "]";
                String id = String.valueOf(chunk.get(i).get("id"));
                try {
                    jdbcTemplate.update(updateSql, vec, id);
                    done++;
                } catch (Exception e) {
                    log.warn("[EmbeddingBackfill] {} UPDATE 실패 id={}: {}", table, id, e.getMessage());
                }
            }
        }
        return done;
    }

    @SuppressWarnings("unchecked")
    private List<List<Double>> embedBatch(List<String> texts) {
        try {
            Map<String, Object> resp = webClient.post()
                .uri(embedUrl + "/embed_batch")
                .header("X-Internal-Token", embedInternalToken == null ? "" : embedInternalToken)
                .bodyValue(Map.of("texts", texts))
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(60))
                .block();
            return (List<List<Double>>) resp.get("embeddings");
        } catch (Exception e) {
            log.error("[EmbeddingBackfill] embed_service error: {}", e.getMessage());
            return null;
        }
    }
}

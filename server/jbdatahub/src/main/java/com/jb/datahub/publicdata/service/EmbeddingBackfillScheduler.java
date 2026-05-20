package com.jb.datahub.publicdata.service;

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
 *  - 매 시 30분: public_api_list / public_data_item 에서 title_embedding IS NULL 인 row 최대 1000건 처리
 *  - embed_service /embed_batch 호출 (X-Internal-Token 포함)
 *  - UPDATE title_embedding
 *  - 토픽/유사도 재계산은 DB 서버 cron (run_kmeans.py + run_similar_top10.py) 담당 — 주 1회
 *
 * 실패 시 다음 시각에 재시도.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmbeddingBackfillScheduler {

    private final JdbcTemplate jdbcTemplate;
    private final WebClient    webClient;

    @Value("${embed.url:http://localhost:8001}")
    private String embedUrl;

    @Value("${embed.internalToken:}")
    private String embedInternalToken;

    private static final int BATCH_SIZE   = 32;   // embed_service /embed_batch 한 번 호출당
    private static final int CYCLE_LIMIT  = 1000; // 한 번 schedule 당 최대

    @Scheduled(cron = "0 30 * * * *", zone = "Asia/Seoul")
    public void backfillEmbeddings() {
        try {
            int aListDone  = backfillTable("public_api_list",
                "SELECT list_id AS id, list_title AS text FROM public_api_list " +
                "WHERE title_embedding IS NULL AND COALESCE(is_deleted,'N') = 'N' " +
                "AND list_title IS NOT NULL LIMIT ?",
                "UPDATE public_api_list SET title_embedding = CAST(? AS vector) WHERE list_id = ?");
            int aItemDone = backfillTable("public_data_item",
                "SELECT id, title AS text FROM public_data_item " +
                "WHERE title_embedding IS NULL AND COALESCE(is_deleted,'N') = 'N' " +
                "AND title IS NOT NULL LIMIT ?",
                "UPDATE public_data_item SET title_embedding = CAST(? AS vector) WHERE id = ?");
            log.info("[EmbeddingBackfill] cycle done: list={}, item={}", aListDone, aItemDone);
        } catch (Exception e) {
            log.error("[EmbeddingBackfill] cycle failed: {}", e.getMessage(), e);
        }
    }

    private int backfillTable(String table, String selectSql, String updateSql) {
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

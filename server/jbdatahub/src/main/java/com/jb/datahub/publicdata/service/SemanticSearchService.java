package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.PageResponseDto;
import com.jb.datahub.publicdata.dto.PublicApiListDto;
import com.jb.datahub.publicdata.dto.SimilarApiDto;
import com.jb.datahub.publicdata.dto.TopicDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SemanticSearchService {

    private final JdbcTemplate jdbcTemplate;
    private final WebClient    webClient;

    @Value("${embed.url:http://localhost:8001}")
    private String embedUrl;

    public PageResponseDto<PublicApiListDto> semanticSearch(String query, int page, int size) {
        String vec;
        try {
            vec = getEmbedding(query);
        } catch (Exception e) {
            log.warn("embed_service unavailable: {}", e.getMessage());
            return PageResponseDto.<PublicApiListDto>builder()
                .content(java.util.Collections.emptyList()).page(page).size(size)
                .totalElements(0L).totalPages(0).first(true).last(true).build();
        }
        int offset  = page * size;

        List<PublicApiListDto> items = jdbcTemplate.query(
            "SELECT list_id, list_title, api_type, data_format, title," +
            " org_nm, new_category_nm, is_charged, is_deleted, request_cnt, updated_at" +
            " FROM public_api_list WHERE title_embedding IS NOT NULL" +
            " ORDER BY title_embedding <=> CAST(? AS vector) LIMIT ? OFFSET ?",
            (rs, rn) -> PublicApiListDto.builder()
                .listId(rs.getString("list_id"))
                .listTitle(rs.getString("list_title"))
                .apiType(rs.getString("api_type"))
                .dataFormat(rs.getString("data_format"))
                .title(rs.getString("title"))
                .orgNm(rs.getString("org_nm"))
                .newCategoryNm(rs.getString("new_category_nm"))
                .isCharged(rs.getString("is_charged"))
                .isDeleted(rs.getString("is_deleted"))
                .requestCnt(rs.getObject("request_cnt", Integer.class))
                .updatedAt(rs.getDate("updated_at") != null
                    ? rs.getDate("updated_at").toLocalDate() : null)
                .build(),
            vec, size, offset
        );

        long total = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM public_api_list WHERE title_embedding IS NOT NULL",
            Long.class
        );

        int totalPages = (int) Math.ceil((double) total / size);
        return PageResponseDto.<PublicApiListDto>builder()
            .content(items).page(page).size(size)
            .totalElements(total).totalPages(totalPages)
            .first(page == 0).last(page >= totalPages - 1)
            .build();
    }

    public List<SimilarApiDto> getSimilar(String listId) {
        try {
            return jdbcTemplate.query(
            "SELECT s.similar_id, l.list_title, l.org_nm, l.new_category_nm, s.score" +
            " FROM api_similar s JOIN public_api_list l ON l.list_id = s.similar_id" +
            " WHERE s.list_id = ? ORDER BY s.score DESC LIMIT 10",
            (rs, rn) -> SimilarApiDto.builder()
                .listId(rs.getString("similar_id"))
                .listTitle(rs.getString("list_title"))
                .orgNm(rs.getString("org_nm"))
                .categoryNm(rs.getString("new_category_nm"))
                .score(rs.getDouble("score"))
                .build(),
                listId
            );
        } catch (Exception e) {
            log.warn("getSimilar fallback: {}", e.getMessage());
            return java.util.Collections.emptyList();
        }
    }

    /** 70만 건 초기 배치 임베딩 진행 상황. */
    public Map<String, Object> getEmbedProgress() {
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT COUNT(*) FILTER (WHERE title_embedding IS NOT NULL) AS done, " +
                "       COUNT(*) AS total, " +
                "       (SELECT COUNT(DISTINCT topic_id) FROM api_topic_label) AS topics, " +
                "       (SELECT COUNT(*) FROM api_similar) AS similar_pairs " +
                "FROM public_api_list"
            );
            long done = ((Number) row.get("done")).longValue();
            long total = ((Number) row.get("total")).longValue();
            double percent = total > 0 ? (100.0 * done / total) : 0.0;
            Map<String, Object> out = new java.util.HashMap<>();
            out.put("done", done);
            out.put("total", total);
            out.put("pending", total - done);
            out.put("percent", Math.round(percent * 100) / 100.0);
            out.put("topics", row.get("topics"));
            out.put("similarPairs", row.get("similar_pairs"));
            return out;
        } catch (Exception e) {
            log.warn("getEmbedProgress fallback: {}", e.getMessage());
            return java.util.Map.of("done", 0, "total", 0, "pending", 0, "percent", 0.0);
        }
    }

    public List<TopicDto> getTopics() {
        try {
            return jdbcTemplate.query(
            "SELECT l.topic_id, l.topic_keywords, COUNT(t.list_id) AS item_count" +
            " FROM api_topic_label l JOIN api_topic t ON t.topic_id = l.topic_id" +
            " GROUP BY l.topic_id, l.topic_keywords ORDER BY item_count DESC",
            (rs, rn) -> TopicDto.builder()
                .topicId(rs.getInt("topic_id"))
                .topicKeywords(rs.getString("topic_keywords"))
                .itemCount(rs.getLong("item_count"))
                .build()
            );
        } catch (Exception e) {
            log.warn("getTopics fallback (테이블 미생성): {}", e.getMessage());
            return java.util.Collections.emptyList();
        }
    }

    public PageResponseDto<PublicApiListDto> getListByTopic(int topicId, int page, int size) {
        int offset = page * size;

        List<PublicApiListDto> items = jdbcTemplate.query(
            "SELECT l.list_id, l.list_title, l.api_type, l.data_format, l.title," +
            " l.org_nm, l.new_category_nm, l.is_charged, l.is_deleted, l.request_cnt, l.updated_at" +
            " FROM public_api_list l JOIN api_topic t ON t.list_id = l.list_id" +
            " WHERE t.topic_id = ? ORDER BY l.request_cnt DESC NULLS LAST LIMIT ? OFFSET ?",
            (rs, rn) -> PublicApiListDto.builder()
                .listId(rs.getString("list_id"))
                .listTitle(rs.getString("list_title"))
                .apiType(rs.getString("api_type"))
                .dataFormat(rs.getString("data_format"))
                .title(rs.getString("title"))
                .orgNm(rs.getString("org_nm"))
                .newCategoryNm(rs.getString("new_category_nm"))
                .isCharged(rs.getString("is_charged"))
                .isDeleted(rs.getString("is_deleted"))
                .requestCnt(rs.getObject("request_cnt", Integer.class))
                .updatedAt(rs.getDate("updated_at") != null
                    ? rs.getDate("updated_at").toLocalDate() : null)
                .build(),
            topicId, size, offset
        );

        long total = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM api_topic WHERE topic_id = ?",
            Long.class, topicId
        );

        int totalPages = (int) Math.ceil((double) total / size);
        return PageResponseDto.<PublicApiListDto>builder()
            .content(items).page(page).size(size)
            .totalElements(total).totalPages(totalPages)
            .first(page == 0).last(page >= totalPages - 1)
            .build();
    }

    @SuppressWarnings("unchecked")
    private String getEmbedding(String query) {
        try {
            Map<String, Object> resp = webClient.get()
                .uri(embedUrl + "/embed?text={text}", query)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(3))
                .block();
            List<Double> emb = (List<Double>) resp.get("embedding");
            return "[" + emb.stream().map(Object::toString).collect(Collectors.joining(",")) + "]";
        } catch (Exception e) {
            log.error("Embed service error: {}", e.getMessage());
            throw new RuntimeException("임베딩 서비스를 사용할 수 없습니다.");
        }
    }
}

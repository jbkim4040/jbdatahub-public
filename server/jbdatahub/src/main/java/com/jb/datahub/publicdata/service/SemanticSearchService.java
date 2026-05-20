package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.PageResponseDto;
import com.jb.datahub.publicdata.dto.PublicDataItemResponseDto;
import com.jb.datahub.publicdata.entity.PublicDataItem;
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
    private final com.jb.datahub.publicdata.repository.PublicDataItemRepository dataItemRepository;

    @Value("${embed.url:http://localhost:8001}")
    private String embedUrl;

    @Value("${embed.internalToken:}")
    private String embedInternalToken;

    /**
     * 하이브리드 검색 — 키워드 매칭(pg_trgm ILIKE) 우선, 의미 매칭(임베딩) 후속.
     * embed_service 실패 시 키워드 결과만 반환 (안전 fallback).
     */
    public PageResponseDto<PublicApiListDto> hybridSearch(String query, int page, int size) {
        // 1) 키워드 매칭 — list_title/title/keywords ILIKE
        List<PublicApiListDto> keyword = jdbcTemplate.query(
            "SELECT list_id, api_id, list_title, api_type, data_format, title," +
            " org_nm, new_category_nm, is_charged, is_deleted, request_cnt, updated_at" +
            " FROM public_api_list" +
            " WHERE COALESCE(is_deleted,'N') = 'N'" +
            "   AND (list_title ILIKE ('%' || ? || '%')" +
            "        OR title      ILIKE ('%' || ? || '%')" +
            "        OR keywords   ILIKE ('%' || ? || '%'))" +
            " ORDER BY request_cnt DESC NULLS LAST LIMIT 100",
            (rs, rn) -> mapRow(rs),
            query, query, query
        );

        // 2) 의미 매칭 — keyword 결과 제외, 임베딩 cosine 거리 순
        List<PublicApiListDto> semantic = java.util.Collections.emptyList();
        if (keyword.size() < 100) {
            try {
                String vec = getEmbedding(query);
                String excludeSql = keyword.isEmpty() ? "" :
                    " AND list_id NOT IN (" +
                    keyword.stream().map(d -> "?").collect(Collectors.joining(",")) + ")";
                Object[] args = new Object[keyword.size() + 1];
                int i = 0;
                for (PublicApiListDto d : keyword) args[i++] = d.getListId();
                args[i] = vec;
                semantic = jdbcTemplate.query(
                    "SELECT list_id, api_id, list_title, api_type, data_format, title," +
                    " org_nm, new_category_nm, is_charged, is_deleted, request_cnt, updated_at" +
                    " FROM public_api_list" +
                    " WHERE title_embedding IS NOT NULL" +
                    "   AND COALESCE(is_deleted,'N') = 'N'" +
                    excludeSql +
                    " ORDER BY title_embedding <=> CAST(? AS vector) LIMIT 50",
                    (rs, rn) -> mapRow(rs),
                    args
                );
            } catch (Exception e) {
                log.warn("hybridSearch semantic 단계 실패 (키워드만 반환): {}", e.getMessage());
            }
        }

        // 3) 병합 + 페이징 (메모리)
        List<PublicApiListDto> combined = new java.util.ArrayList<>(keyword);
        combined.addAll(semantic);
        long total = combined.size();
        int offset = page * size;
        int toIdx = Math.min(offset + size, combined.size());
        List<PublicApiListDto> pageItems = offset >= combined.size()
            ? java.util.Collections.emptyList()
            : combined.subList(offset, toIdx);
        int totalPages = (int) Math.ceil((double) total / size);
        return PageResponseDto.<PublicApiListDto>builder()
            .content(pageItems).page(page).size(size)
            .totalElements(total).totalPages(totalPages)
            .first(page == 0).last(page >= totalPages - 1)
            .build();
    }

    /**
     * DataItem (public_data_item) 하이브리드 검색 — 키워드 우선 + 의미 후속.
     * source_type 필터링 가능. 임베딩이 NULL인 row가 많을 수 있어 키워드만으로도 동작.
     */
    public PageResponseDto<PublicDataItemResponseDto> hybridDataItemSearch(
            String sourceType, java.util.List<String> extList, String query, int page, int size) {
        boolean hasType = sourceType != null && !sourceType.isBlank();
        boolean hasExt  = extList != null && !extList.isEmpty();
        StringBuilder typeFilter = new StringBuilder();
        java.util.List<Object> baseArgs = new java.util.ArrayList<>();
        if (hasType) {
            typeFilter.append(" AND source_type = ? ");
        }
        if (hasExt) {
            typeFilter.append(" AND LOWER(ext) IN (")
                .append(extList.stream().map(x -> "?").collect(Collectors.joining(",")))
                .append(") ");
        }

        // 1) 키워드 매칭 (title/list_title/keywords)
        String keywordSql =
            "SELECT id FROM public_data_item " +
            "WHERE COALESCE(is_deleted,'N') = 'N' " +
            typeFilter.toString() +
            "  AND (title ILIKE ('%' || ? || '%')" +
            "       OR list_title ILIKE ('%' || ? || '%')" +
            "       OR keywords   ILIKE ('%' || ? || '%')) " +
            "ORDER BY COALESCE(download_cnt, view_cnt, req_cnt) DESC NULLS LAST LIMIT 100";
        java.util.List<Object> kwArgs = new java.util.ArrayList<>();
        if (hasType) kwArgs.add(sourceType);
        if (hasExt)  for (String ex : extList) kwArgs.add(ex.toLowerCase());
        kwArgs.add(query); kwArgs.add(query); kwArgs.add(query);
        java.util.List<String> keywordIds = jdbcTemplate.query(
            keywordSql, (rs, rn) -> rs.getString("id"), kwArgs.toArray());

        // 2) 의미 매칭 (keyword 제외)
        java.util.List<String> semanticIds = java.util.Collections.emptyList();
        if (keywordIds.size() < 100) {
            try {
                String vec = getEmbedding(query);
                StringBuilder excludeSql = new StringBuilder();
                java.util.List<Object> semArgs = new java.util.ArrayList<>();
                if (hasType) semArgs.add(sourceType);
                if (hasExt)  for (String ex : extList) semArgs.add(ex.toLowerCase());
                if (!keywordIds.isEmpty()) {
                    excludeSql.append(" AND id NOT IN (")
                        .append(keywordIds.stream().map(x -> "?").collect(Collectors.joining(",")))
                        .append(") ");
                    semArgs.addAll(keywordIds);
                }
                semArgs.add(vec);
                String semSql =
                    "SELECT id FROM public_data_item " +
                    "WHERE title_embedding IS NOT NULL " +
                    "  AND COALESCE(is_deleted,'N') = 'N' " +
                    typeFilter.toString() +
                    excludeSql +
                    "ORDER BY title_embedding <=> CAST(? AS vector) LIMIT 50";
                semanticIds = jdbcTemplate.query(
                    semSql, (rs, rn) -> rs.getString("id"), semArgs.toArray());
            } catch (Exception e) {
                log.warn("hybridDataItemSearch semantic 단계 실패 (키워드만): {}", e.getMessage());
            }
        }

        // 3) ID 순서 보존 + entity fetch (단일 IN 쿼리)
        java.util.List<String> orderedIds = new java.util.ArrayList<>(keywordIds);
        orderedIds.addAll(semanticIds);
        long total = orderedIds.size();
        int offset = page * size;
        if (offset >= orderedIds.size()) {
            return PageResponseDto.<PublicDataItemResponseDto>builder()
                .content(java.util.Collections.emptyList()).page(page).size(size)
                .totalElements(total).totalPages((int) Math.ceil((double) total / size))
                .first(page == 0).last(true).build();
        }
        java.util.List<String> pageIds = orderedIds.subList(
            offset, Math.min(offset + size, orderedIds.size()));

        // entity 조회 — JPA Repository 통해 (id 순서 보존)
        java.util.List<PublicDataItem> entities = dataItemRepository.findAllById(pageIds);
        java.util.Map<String, PublicDataItem> byId = new java.util.HashMap<>();
        for (PublicDataItem e : entities) byId.put(e.getId(), e);
        java.util.List<PublicDataItemResponseDto> content = new java.util.ArrayList<>();
        for (String id : pageIds) {
            PublicDataItem e = byId.get(id);
            if (e != null) content.add(new PublicDataItemResponseDto(e));
        }
        int totalPages = (int) Math.ceil((double) total / size);
        return PageResponseDto.<PublicDataItemResponseDto>builder()
            .content(content).page(page).size(size)
            .totalElements(total).totalPages(totalPages)
            .first(page == 0).last(page >= totalPages - 1).build();
    }

    private PublicApiListDto mapRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        return PublicApiListDto.builder()
            .listId(rs.getString("list_id"))
            .apiId(rs.getString("api_id"))
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
            .build();
    }

    /**
     * 키워드 없는 단순 ext/type 필터 조회 — 정렬 sortBy 적용.
     */
    public PageResponseDto<PublicDataItemResponseDto> listDataItems(
            String sourceType, java.util.List<String> extList,
            int page, int size, String sortBy, String sortDir) {
        boolean hasType = sourceType != null && !sourceType.isBlank();
        boolean hasExt  = extList != null && !extList.isEmpty();
        StringBuilder where = new StringBuilder("COALESCE(is_deleted,'N') = 'N'");
        java.util.List<Object> args = new java.util.ArrayList<>();
        if (hasType) { where.append(" AND source_type = ?"); args.add(sourceType); }
        if (hasExt) {
            where.append(" AND LOWER(ext) IN (")
                .append(extList.stream().map(x -> "?").collect(Collectors.joining(",")))
                .append(")");
            for (String ex : extList) args.add(ex.toLowerCase());
        }
        String order;
        String sortDirSql = "desc".equalsIgnoreCase(sortDir) ? "DESC" : ("asc".equalsIgnoreCase(sortDir) ? "ASC" : "DESC");
        if ("title".equalsIgnoreCase(sortBy))            order = "title " + sortDirSql;
        else if ("orgNm".equalsIgnoreCase(sortBy))       order = "org_nm " + sortDirSql;
        else if ("viewCnt".equalsIgnoreCase(sortBy))     order = "view_cnt " + sortDirSql + " NULLS LAST";
        else if ("downloadCnt".equalsIgnoreCase(sortBy)) order = "download_cnt " + sortDirSql + " NULLS LAST";
        else                                             order = "updated_at " + sortDirSql + " NULLS LAST";

        long total = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM public_data_item WHERE " + where, Long.class, args.toArray());
        int offset = page * size;
        java.util.List<Object> qArgs = new java.util.ArrayList<>(args);
        qArgs.add(size); qArgs.add(offset);
        java.util.List<String> ids = jdbcTemplate.query(
            "SELECT id FROM public_data_item WHERE " + where + " ORDER BY " + order + " LIMIT ? OFFSET ?",
            (rs, rn) -> rs.getString("id"), qArgs.toArray());
        java.util.List<PublicDataItem> entities = dataItemRepository.findAllById(ids);
        java.util.Map<String, PublicDataItem> byId = new java.util.HashMap<>();
        for (PublicDataItem e : entities) byId.put(e.getId(), e);
        java.util.List<PublicDataItemResponseDto> content = new java.util.ArrayList<>();
        for (String id : ids) {
            PublicDataItem e = byId.get(id);
            if (e != null) content.add(new PublicDataItemResponseDto(e));
        }
        int totalPages = (int) Math.ceil((double) total / size);
        return PageResponseDto.<PublicDataItemResponseDto>builder()
            .content(content).page(page).size(size)
            .totalElements(total).totalPages(totalPages)
            .first(page == 0).last(page >= totalPages - 1).build();
    }

    /**
     * DataItem 의미 유사도 — 같은 ext 그룹 내에서 cosine 거리 상위 10개 반환.
     * 임베딩 없으면 빈 리스트 fallback.
     */
    public java.util.List<PublicDataItemResponseDto> getSimilarDataItem(String id) {
        try {
            java.util.List<String> ids = jdbcTemplate.query(
                "SELECT id FROM public_data_item " +
                "WHERE title_embedding IS NOT NULL " +
                "  AND id <> ? " +
                "  AND COALESCE(is_deleted,'N') = 'N' " +
                "ORDER BY title_embedding <=> (SELECT title_embedding FROM public_data_item WHERE id = ?) " +
                "LIMIT 10",
                (rs, rn) -> rs.getString("id"), id, id);
            if (ids.isEmpty()) return java.util.Collections.emptyList();
            java.util.List<PublicDataItem> entities = dataItemRepository.findAllById(ids);
            java.util.Map<String, PublicDataItem> byId = new java.util.HashMap<>();
            for (PublicDataItem e : entities) byId.put(e.getId(), e);
            java.util.List<PublicDataItemResponseDto> out = new java.util.ArrayList<>();
            for (String x : ids) {
                PublicDataItem e = byId.get(x);
                if (e != null) out.add(new PublicDataItemResponseDto(e));
            }
            return out;
        } catch (Exception e) {
            log.warn("getSimilarDataItem fallback: {}", e.getMessage());
            return java.util.Collections.emptyList();
        }
    }

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
            "SELECT list_id, api_id, list_title, api_type, data_format, title," +
            " org_nm, new_category_nm, is_charged, is_deleted, request_cnt, updated_at" +
            " FROM public_api_list WHERE title_embedding IS NOT NULL" +
            " ORDER BY title_embedding <=> CAST(? AS vector) LIMIT ? OFFSET ?",
            (rs, rn) -> PublicApiListDto.builder()
                .listId(rs.getString("list_id"))
                .apiId(rs.getString("api_id"))
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
            "SELECT l.list_id, l.api_id, l.list_title, l.api_type, l.data_format, l.title," +
            " l.org_nm, l.new_category_nm, l.is_charged, l.is_deleted, l.request_cnt, l.updated_at" +
            " FROM public_api_list l JOIN api_topic t ON t.list_id = l.list_id" +
            " WHERE t.topic_id = ? ORDER BY l.request_cnt DESC NULLS LAST LIMIT ? OFFSET ?",
            (rs, rn) -> PublicApiListDto.builder()
                .listId(rs.getString("list_id"))
                .apiId(rs.getString("api_id"))
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
        // 길이 제한 — embed_service OOM/DoS 차단 (C2)
        if (query == null) query = "";
        if (query.length() > 200) query = query.substring(0, 200);
        try {
            Map<String, Object> resp = webClient.post()
                .uri(embedUrl + "/embed")
                .header("X-Internal-Token", embedInternalToken == null ? "" : embedInternalToken)
                .bodyValue(Map.of("text", query))
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(5))
                .block();
            List<Double> emb = (List<Double>) resp.get("embedding");
            return "[" + emb.stream().map(Object::toString).collect(Collectors.joining(",")) + "]";
        } catch (Exception e) {
            log.error("Embed service error: {}", e.getMessage());
            throw new RuntimeException("임베딩 서비스를 사용할 수 없습니다.");
        }
    }
}

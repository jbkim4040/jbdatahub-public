package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.RelatedDatasetDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RelatedDatasetService {

    private final JdbcTemplate jdbcTemplate;

    private static final String SQL = """
        SELECT list_id, list_title, title, org_nm, new_category_nm, request_cnt,
               GREATEST(
                 similarity(COALESCE(list_title,''), ?),
                 similarity(COALESCE(title,''),      ?) * 0.95,
                 similarity(COALESCE(keywords,''),   ?) * 0.85,
                 similarity(COALESCE(description,''),?) * 0.55
               ) AS score
        FROM public_api_list
        WHERE COALESCE(is_deleted,'N') = 'N'
          AND (
                list_title ILIKE ('%%' || ? || '%%')
             OR title      ILIKE ('%%' || ? || '%%')
             OR keywords   ILIKE ('%%' || ? || '%%')
             OR description ILIKE ('%%' || ? || '%%')
             OR similarity(COALESCE(list_title,''), ?) > 0.15
             OR similarity(COALESCE(title,''),      ?) > 0.15
          )
        ORDER BY score DESC, request_cnt DESC NULLS LAST
        LIMIT ?
        """;

    // TODO(ops): list_title/title/keywords 컬럼에 pg_trgm GIN 인덱스 필요
    //   CREATE INDEX idx_pal_list_title_trgm ON public_api_list USING gin (list_title gin_trgm_ops);
    // 결과 캐시(2분)는 임시 완충 — 인덱스 생성 후에도 유지 권장
    @Cacheable(value = "related", key = "#q + '_' + #limit")
    public List<RelatedDatasetDto> related(String q, int limit) {
        return jdbcTemplate.query(
            SQL,
            (rs, rn) -> RelatedDatasetDto.builder()
                .listId(rs.getString("list_id"))
                .listTitle(rs.getString("list_title"))
                .title(rs.getString("title"))
                .orgNm(rs.getString("org_nm"))
                .categoryNm(rs.getString("new_category_nm"))
                .requestCnt(rs.getObject("request_cnt", Integer.class))
                .score(rs.getDouble("score"))
                .build(),
            q, q, q, q, q, q, q, q, q, q, limit
        );
    }
}

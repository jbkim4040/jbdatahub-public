package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.PublicDataItemDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PublicDataSaveService {

    private final JdbcTemplate jdbcTemplate;

    private static final String UPSERT_ITEM = """
        INSERT INTO public_data_item (
            id, source_type, list_id, list_title, list_type, title,
            org_cd, org_nm, dept_nm, description, keywords,
            new_category_cd, new_category_nm, category_nm,
            created_at, updated_at,
            download_cnt, view_cnt, req_cnt, register_status, is_deleted,
            ext, data_type, meta_url, page_url,
            is_charged, is_core_data, is_std_data,
            ownership_grounds, providing_scope, share_scope_nm, update_cycle
        ) VALUES (
            ?,?,?,?,?,?, ?,?,?,?,?, ?,?,?, ?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?, ?,?,?,?
        )
        ON CONFLICT (id) DO UPDATE SET
            source_type = EXCLUDED.source_type,
            list_id = EXCLUDED.list_id, list_title = EXCLUDED.list_title,
            list_type = EXCLUDED.list_type, title = EXCLUDED.title,
            org_cd = EXCLUDED.org_cd, org_nm = EXCLUDED.org_nm,
            dept_nm = EXCLUDED.dept_nm, description = EXCLUDED.description,
            keywords = EXCLUDED.keywords, new_category_cd = EXCLUDED.new_category_cd,
            new_category_nm = EXCLUDED.new_category_nm, category_nm = EXCLUDED.category_nm,
            created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at,
            download_cnt = EXCLUDED.download_cnt, view_cnt = EXCLUDED.view_cnt,
            req_cnt = EXCLUDED.req_cnt, register_status = EXCLUDED.register_status,
            is_deleted = EXCLUDED.is_deleted, ext = EXCLUDED.ext,
            data_type = EXCLUDED.data_type, meta_url = EXCLUDED.meta_url,
            page_url = EXCLUDED.page_url, is_charged = EXCLUDED.is_charged,
            is_core_data = EXCLUDED.is_core_data, is_std_data = EXCLUDED.is_std_data,
            ownership_grounds = EXCLUDED.ownership_grounds,
            providing_scope = EXCLUDED.providing_scope,
            share_scope_nm = EXCLUDED.share_scope_nm,
            update_cycle = EXCLUDED.update_cycle
        """;

    @Transactional
    public int saveAll(List<PublicDataItemDto> items, String sourceType) {
        if (items == null || items.isEmpty()) return 0;
        long start = System.currentTimeMillis();

        List<PublicDataItemDto> valid = items.stream()
                .filter(dto -> dto.getId() != null)
                .toList();

        jdbcTemplate.batchUpdate(UPSERT_ITEM, valid, valid.size(), (ps, dto) -> {
            ps.setString(1,  dto.getId());
            ps.setString(2,  sourceType);
            ps.setString(3,  dto.getListId());
            ps.setString(4,  truncate(dto.getListTitle(), 300));
            ps.setString(5,  dto.getListType());
            ps.setString(6,  truncate(dto.getTitle(), 300));
            ps.setString(7,  dto.getOrgCd());
            ps.setString(8,  truncate(dto.getOrgNm(), 200));
            ps.setString(9,  truncate(dto.getDeptNm(), 200));
            ps.setString(10, dto.getDesc());
            ps.setString(11, truncate(dto.getKeywords(), 500));
            ps.setString(12, dto.getNewCategoryCd());
            ps.setString(13, truncate(dto.getNewCategoryNm(), 100));
            ps.setString(14, truncate(dto.getCategoryNm(), 200));
            ps.setObject(15, toSqlDate(dto.getCreatedAt()));
            ps.setObject(16, toSqlDate(dto.getUpdatedAt()));
            ps.setObject(17, dto.getDownloadCnt());
            ps.setObject(18, dto.getViewCnt());
            ps.setObject(19, dto.getReqCnt());
            ps.setString(20, truncate(dto.getRegisterStatus(), 50));
            ps.setString(21, dto.getIsDeleted());
            ps.setString(22, truncate(dto.getExt(), 50));
            ps.setString(23, truncate(dto.getDataType(), 50));
            ps.setString(24, truncate(dto.getMetaUrl(), 500));
            ps.setString(25, truncate(dto.getPageUrl(), 500));
            ps.setString(26, dto.getIsCharged());
            ps.setString(27, dto.getIsCoreData());
            ps.setString(28, dto.getIsStdData());
            ps.setString(29, dto.getOwnershipGrounds());
            ps.setString(30, dto.getProvidingScope());
            ps.setString(31, truncate(dto.getShareScopeNm(), 100));
            ps.setString(32, truncate(dto.getUpdateCycle(), 50));
        });

        long elapsed = System.currentTimeMillis() - start;
        log.info("[SavePerf] {} {} items upserted in {}ms", sourceType, valid.size(), elapsed);
        return valid.size();
    }

    private Date toSqlDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            String s = dateStr.trim();
            if (s.length() > 10) s = s.substring(0, 10);
            LocalDate d = LocalDate.parse(s, DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            return Date.valueOf(d);
        } catch (DateTimeParseException | StringIndexOutOfBoundsException e) {
            return null;
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }
}

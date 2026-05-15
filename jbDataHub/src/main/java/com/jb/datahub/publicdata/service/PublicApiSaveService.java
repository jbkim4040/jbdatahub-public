package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.PublicApiItemDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PublicApiSaveService {

    private final JdbcTemplate jdbcTemplate;

    private static final String UPSERT_LIST = """
        INSERT INTO public_api_list (
            list_id, list_title, list_type, api_id, api_type, data_format,
            title, title_en, org_cd, org_nm, dept_nm, category_nm,
            new_category_cd, new_category_nm, upper_category_cd,
            share_scope_cd, share_scope_nm,
            guide_url, end_point_url, soap_url, link_url, meta_url,
            description, is_charged, is_copyrighted, is_core_data, core_data_nm,
            is_std_data, is_list_deleted, is_deleted,
            is_confirmed_for_dev, is_confirmed_for_dev_nm,
            is_confirmed_for_prod, is_confirmed_for_prod_nm,
            ownership_grounds, is_third_party_copyrighted, use_prmisn_ennc,
            keywords, request_cnt, use_scope_resn, created_at, updated_at
        ) VALUES (
            ?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?, ?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?, ?,?, ?,?, ?,?,?, ?,?,?,?,?
        )
        ON CONFLICT (list_id) DO UPDATE SET
            list_title = EXCLUDED.list_title, list_type = EXCLUDED.list_type,
            api_id = EXCLUDED.api_id, api_type = EXCLUDED.api_type,
            data_format = EXCLUDED.data_format, title = EXCLUDED.title,
            title_en = EXCLUDED.title_en, org_cd = EXCLUDED.org_cd,
            org_nm = EXCLUDED.org_nm, dept_nm = EXCLUDED.dept_nm,
            category_nm = EXCLUDED.category_nm, new_category_cd = EXCLUDED.new_category_cd,
            new_category_nm = EXCLUDED.new_category_nm, upper_category_cd = EXCLUDED.upper_category_cd,
            share_scope_cd = EXCLUDED.share_scope_cd, share_scope_nm = EXCLUDED.share_scope_nm,
            guide_url = EXCLUDED.guide_url, end_point_url = EXCLUDED.end_point_url,
            soap_url = EXCLUDED.soap_url, link_url = EXCLUDED.link_url,
            meta_url = EXCLUDED.meta_url, description = EXCLUDED.description,
            is_charged = EXCLUDED.is_charged, is_copyrighted = EXCLUDED.is_copyrighted,
            is_core_data = EXCLUDED.is_core_data, core_data_nm = EXCLUDED.core_data_nm,
            is_std_data = EXCLUDED.is_std_data, is_list_deleted = EXCLUDED.is_list_deleted,
            is_deleted = EXCLUDED.is_deleted,
            is_confirmed_for_dev = EXCLUDED.is_confirmed_for_dev,
            is_confirmed_for_dev_nm = EXCLUDED.is_confirmed_for_dev_nm,
            is_confirmed_for_prod = EXCLUDED.is_confirmed_for_prod,
            is_confirmed_for_prod_nm = EXCLUDED.is_confirmed_for_prod_nm,
            ownership_grounds = EXCLUDED.ownership_grounds,
            is_third_party_copyrighted = EXCLUDED.is_third_party_copyrighted,
            use_prmisn_ennc = EXCLUDED.use_prmisn_ennc,
            keywords = EXCLUDED.keywords, request_cnt = EXCLUDED.request_cnt,
            use_scope_resn = EXCLUDED.use_scope_resn,
            created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at
        """;

    private static final String UPSERT_OP = """
        INSERT INTO public_api_operation (
            operation_seq, list_id, operation_nm, operation_url, register_status,
            request_param_nm, request_param_nm_en, response_param_nm, response_param_nm_en
        ) VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT (operation_seq) DO UPDATE SET
            list_id = EXCLUDED.list_id,
            operation_nm = EXCLUDED.operation_nm,
            operation_url = EXCLUDED.operation_url,
            register_status = EXCLUDED.register_status,
            request_param_nm = EXCLUDED.request_param_nm,
            request_param_nm_en = EXCLUDED.request_param_nm_en,
            response_param_nm = EXCLUDED.response_param_nm,
            response_param_nm_en = EXCLUDED.response_param_nm_en
        """;

    @CacheEvict(value = "stats", allEntries = true)
    @Transactional
    public int saveAll(List<PublicApiItemDto> items) {
        if (items == null || items.isEmpty()) return 0;
        long start = System.currentTimeMillis();

        // 동일 listId 중복 제거 (LinkedHashMap: 마지막 값 우선)
        Map<String, PublicApiItemDto> listMap = new LinkedHashMap<>();
        for (PublicApiItemDto dto : items) {
            if (dto.getListId() != null) listMap.put(dto.getListId(), dto);
        }

        // List UPSERT 배치
        List<PublicApiItemDto> uniqueLists = new ArrayList<>(listMap.values());
        jdbcTemplate.batchUpdate(UPSERT_LIST, uniqueLists, uniqueLists.size(), (ps, dto) -> {
            ps.setString(1,  dto.getListId());
            ps.setString(2,  truncate(dto.getListTitle(), 300));
            ps.setString(3,  dto.getListType());
            ps.setString(4,  dto.getId());
            ps.setString(5,  dto.getApiType());
            ps.setString(6,  dto.getDataFormat());
            ps.setString(7,  truncate(dto.getTitle(), 300));
            ps.setString(8,  truncate(dto.getTitleEn(), 300));
            ps.setString(9,  dto.getOrgCd());
            ps.setString(10, truncate(dto.getOrgNm(), 200));
            ps.setString(11, truncate(dto.getDeptNm(), 200));
            ps.setString(12, truncate(dto.getCategoryNm(), 200));
            ps.setString(13, dto.getNewCategoryCd());
            ps.setString(14, truncate(dto.getNewCategoryNm(), 100));
            ps.setString(15, truncate(dto.getUpperCategoryCd(), 100));
            ps.setString(16, dto.getShareScopeCd());
            ps.setString(17, truncate(dto.getShareScopeNm(), 100));
            ps.setString(18, truncate(dto.getGuideUrl(), 500));
            ps.setString(19, truncate(dto.getEndPointUrl(), 500));
            ps.setString(20, truncate(dto.getSoapUrl(), 500));
            ps.setString(21, truncate(dto.getLinkUrl(), 500));
            ps.setString(22, truncate(dto.getMetaUrl(), 500));
            ps.setString(23, dto.getDesc());
            ps.setString(24, dto.getIsCharged());
            ps.setString(25, dto.getIsCopyrighted());
            ps.setString(26, dto.getIsCoreData());
            ps.setString(27, truncate(dto.getCoreDataNm(), 500));
            ps.setString(28, dto.getIsStdData());
            ps.setString(29, dto.getIsListDeleted());
            ps.setString(30, dto.getIsDeleted());
            ps.setString(31, dto.getIsConfirmedForDev());
            ps.setString(32, dto.getIsConfirmedForDevNm());
            ps.setString(33, dto.getIsConfirmedForProd());
            ps.setString(34, dto.getIsConfirmedForProdNm());
            ps.setString(35, dto.getOwnershipGrounds());
            ps.setString(36, truncate(dto.getIsThirdPartyCopyrighted(), 50));
            ps.setString(37, truncate(dto.getUsePrmisnEnnc(), 50));
            ps.setString(38, truncate(dto.getKeywords(), 500));
            ps.setObject(39, dto.getRequestCnt());
            ps.setString(40, dto.getUseScopeResn());
            ps.setObject(41, toSqlDate(dto.getCreatedAt()));
            ps.setObject(42, toSqlDate(dto.getUpdatedAt()));
        });

        // Operation UPSERT 배치
        List<PublicApiItemDto> ops = items.stream()
                .filter(dto -> dto.getOperationSeq() != null && !dto.getOperationSeq().isBlank())
                .collect(Collectors.toList());

        if (!ops.isEmpty()) {
            jdbcTemplate.batchUpdate(UPSERT_OP, ops, ops.size(), (ps, dto) -> {
                ps.setLong(1,   Long.parseLong(dto.getOperationSeq()));
                ps.setString(2, dto.getListId());
                ps.setString(3, truncate(dto.getOperationNm(), 300));
                ps.setString(4, truncate(dto.getOperationUrl(), 500));
                ps.setString(5, truncate(dto.getRegisterStatus(), 50));
                ps.setString(6, dto.getRequestParamNm());
                ps.setString(7, dto.getRequestParamNmEn());
                ps.setString(8, dto.getResponseParamNm());
                ps.setString(9, dto.getResponseParamNmEn());
            });
        }

        long elapsed = System.currentTimeMillis() - start;
        log.info("[SavePerf] {} items → list {} (upsert) + op {} (upsert) in {}ms",
                items.size(), uniqueLists.size(), ops.size(), elapsed);

        return uniqueLists.size();
    }

    private Date toSqlDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            LocalDate d = LocalDate.parse(dateStr.trim(), DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            return Date.valueOf(d);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }
}

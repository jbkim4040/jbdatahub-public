package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.entity.PublicApiOperation;
import com.jb.datahub.publicdata.repository.PublicApiOperationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DdlGeneratorService {

    private final PublicApiOperationRepository operationRepository;
    private final JdbcTemplate jdbcTemplate;

    private static final Set<String> SKIP_EN = Set.of(
            "resultcode", "resultmsg", "numofrows", "pageno", "totalcount", "rnum"
    );

    private static final Set<String> SKIP_KR = Set.of(
            "결과코드", "결과메시지", "결과메세지", "한페이지 결과 수", "한 페이지 결과 수",
            "페이지 번호", "전체 결과 수", "결과값 나열 순서"
    );

    /** 단일 operation 에 대한 DDL 생성 */
    public String generate(PublicApiOperation op) {
        List<String> cols = extractColumns(op);
        if (cols.isEmpty()) return null;

        String tableName = buildTableName(op);
        StringBuilder sb = new StringBuilder();
        sb.append("-- ").append(op.getOperationNm())
          .append(" (operation_seq: ").append(op.getOperationSeq()).append(")\n");
        sb.append("CREATE TABLE IF NOT EXISTS ").append(tableName).append(" (\n");
        sb.append("    id           BIGSERIAL PRIMARY KEY,\n");
        sb.append("    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()");
        for (String col : cols) {
            sb.append(",\n    ").append(col).append(" TEXT");
        }
        sb.append("\n);");
        return sb.toString();
    }

    /** 모든 operation 의 DDL 을 생성하여 DB 에 저장 (비동기) */
    @Async
    @Transactional
    public void generateAndSaveAll() {
        log.info("[DDL] 전체 DDL 생성 시작");
        List<PublicApiOperation> all = operationRepository.findAll();
        int updated = 0;
        int skipped = 0;

        for (PublicApiOperation op : all) {
            try {
                String ddl = generate(op);
                jdbcTemplate.update(
                        "UPDATE public_api_operation SET generated_ddl = ? WHERE operation_seq = ?",
                        ddl, op.getOperationSeq());
                if (ddl != null) updated++; else skipped++;
            } catch (Exception e) {
                log.warn("[DDL] seq={} 오류: {}", op.getOperationSeq(), e.getMessage());
            }
        }
        log.info("[DDL] 완료 — 생성={} 스킵(파라미터없음)={}", updated, skipped);
    }

    // ─── private helpers ──────────────────────────────────────

    private String buildTableName(PublicApiOperation op) {
        String listId = op.getPublicApiList().getListId().replaceAll("[^a-zA-Z0-9]", "_");
        return "api_" + listId + "_" + op.getOperationSeq();
    }

    private List<String> extractColumns(PublicApiOperation op) {
        String en = op.getResponseParamNmEn();
        if (en != null && !en.isBlank()) {
            List<String> cols = parseEnglish(en);
            if (!cols.isEmpty()) return cols;
        }
        String kr = op.getResponseParamNm();
        if (kr != null && !kr.isBlank()) {
            return parseKorean(kr);
        }
        return List.of();
    }

    private List<String> parseEnglish(String raw) {
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .filter(s -> !SKIP_EN.contains(s.toLowerCase()))
                .map(this::camelToSnake)
                .distinct()
                .collect(Collectors.toList());
    }

    private List<String> parseKorean(String raw) {
        return Arrays.stream(raw.split(","))
                .map(s -> s.trim().replaceAll("^\"|\"$", "").trim())
                .filter(s -> !s.isBlank())
                .filter(s -> !SKIP_KR.contains(s))
                .map(this::koreanToIdentifier)
                .distinct()
                .collect(Collectors.toList());
    }

    private String camelToSnake(String s) {
        String snake = s.replaceAll("([A-Z])", "_$1").toLowerCase()
                .replaceAll("^_", "")
                .replaceAll("[^a-z0-9_]", "_")
                .replaceAll("_+", "_")
                .replaceAll("_$", "");
        return snake.isEmpty() ? "col_" + s.hashCode() : snake;
    }

    private String koreanToIdentifier(String s) {
        String id = s.replaceAll("[^가-힣a-zA-Z0-9]", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_|_$", "");
        if (id.isEmpty()) return null;
        // C6 fix: 이중 안전망 — regex로 안전 문자만 통과시켰지만 quote-doubling으로 인젝션 완전 차단
        String escaped = id.replace("\"", "\"\"");
        return "\"" + escaped + "\"";
    }
}

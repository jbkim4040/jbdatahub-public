-- =============================================================
-- 공공데이터포털 OpenAPI 목록 테이블 DDL (PostgreSQL / Supabase)
-- =============================================================

-- ─────────────────────────────────────────
-- 1. public_api_list  (서비스/목록 단위)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public_api_list (
    list_id                  VARCHAR(20)   NOT NULL,          -- 목록 기본키
    list_title               VARCHAR(300),                     -- 목록명
    list_type                VARCHAR(20),                      -- 공공데이터 유형 코드
    api_id                   VARCHAR(200),                     -- API 기본키 (UDDI)
    api_type                 VARCHAR(20),                      -- 공공데이터 유형 (REST/SOAP)
    data_format              VARCHAR(50),                      -- 데이터 유형 (XML/JSON 등)
    title                    VARCHAR(300),                     -- 서비스명
    title_en                 VARCHAR(300),                     -- 서비스 영문명
    org_cd                   VARCHAR(20),                      -- 제공기관코드
    org_nm                   VARCHAR(200),                     -- 제공기관명
    dept_nm                  VARCHAR(200),                     -- 관리부서명
    category_nm              VARCHAR(200),                     -- BRM 코드명
    new_category_cd          VARCHAR(20),                      -- 신규 분류체계 코드
    new_category_nm          VARCHAR(100),                     -- 신규 분류체계명
    upper_category_cd        VARCHAR(100),                     -- BRM 상위 코드
    share_scope_cd           VARCHAR(20),                      -- 공유 범위 코드
    share_scope_nm           VARCHAR(100),                     -- 공유 범위
    guide_url                VARCHAR(500),                     -- 서비스 안내 URL
    end_point_url            VARCHAR(500),                     -- end point url
    soap_url                 VARCHAR(500),                     -- soap url
    link_url                 VARCHAR(500),                     -- link url
    meta_url                 VARCHAR(500),                     -- 메타데이터 url
    description              TEXT,                             -- 목록설명 (desc → reserved word 회피)
    is_charged               VARCHAR(20),                      -- 비용 부과 유무
    is_copyrighted           VARCHAR(5),                       -- 저작권 여부
    is_core_data             VARCHAR(5),                       -- 국가중점여부
    core_data_nm             VARCHAR(500),                     -- 국가중점명
    is_std_data              VARCHAR(5),                       -- 표준데이터 여부
    is_list_deleted          VARCHAR(5),                       -- 목록 폐기 여부
    is_deleted               VARCHAR(5),                       -- API서비스 폐기 여부
    is_confirmed_for_dev     VARCHAR(5),                       -- 테스트 단계 자동 승인 여부 코드
    is_confirmed_for_dev_nm  VARCHAR(20),                      -- 테스트 단계 자동 승인 여부명
    is_confirmed_for_prod    VARCHAR(5),                       -- 운영단계 자동 승인 여부 코드
    is_confirmed_for_prod_nm VARCHAR(20),                      -- 운영단계 자동 승인 여부명
    ownership_grounds        TEXT,                             -- 데이터 보유근거
    is_third_party_copyrighted VARCHAR(50),                   -- 제3자권리포함유무
    use_prmisn_ennc          VARCHAR(50),                      -- 권리이용허가유무
    keywords                 VARCHAR(500),                     -- 키워드
    request_cnt              INTEGER,                          -- 활용수
    use_scope_resn           TEXT,                             -- 공유 범위 근거
    created_at               DATE,                             -- 등록일
    updated_at               DATE,                             -- 수정일

    CONSTRAINT pk_public_api_list PRIMARY KEY (list_id)
);

COMMENT ON TABLE  public_api_list IS '공공데이터포털 OpenAPI 서비스 목록';
COMMENT ON COLUMN public_api_list.list_id   IS '목록 기본키';
COMMENT ON COLUMN public_api_list.api_id    IS 'API 기본키 (UDDI)';
COMMENT ON COLUMN public_api_list.api_type  IS '공공데이터 유형 (REST/SOAP)';
COMMENT ON COLUMN public_api_list.description IS '목록설명 (원래 컬럼명: desc)';


-- ─────────────────────────────────────────
-- 2. public_api_operation  (오퍼레이션 단위)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public_api_operation (
    operation_seq        BIGINT        NOT NULL,               -- 오퍼레이션 일련 번호 (PK)
    list_id              VARCHAR(20)   NOT NULL,               -- 상위 목록 FK
    operation_nm         VARCHAR(300),                         -- 오퍼레이션명
    operation_url        VARCHAR(500),                         -- 오퍼레이션 URL
    register_status      VARCHAR(50),                          -- 상태명
    request_param_nm     TEXT,                                 -- 요청변수명 (한글)
    request_param_nm_en  TEXT,                                 -- 요청변수 영문명
    response_param_nm    TEXT,                                 -- 응답변수명 (한글)
    response_param_nm_en TEXT,                                 -- 응답변수 영문명

    CONSTRAINT pk_public_api_operation PRIMARY KEY (operation_seq),
    CONSTRAINT fk_operation_list FOREIGN KEY (list_id)
        REFERENCES public_api_list (list_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

COMMENT ON TABLE  public_api_operation IS '공공데이터포털 OpenAPI 오퍼레이션';
COMMENT ON COLUMN public_api_operation.operation_seq IS '오퍼레이션 일련 번호 (PK)';
COMMENT ON COLUMN public_api_operation.list_id       IS '상위 목록 ID (FK → public_api_list)';


-- ─────────────────────────────────────────
-- 3. 인덱스
-- ─────────────────────────────────────────
-- public_api_list
CREATE INDEX IF NOT EXISTS idx_pal_org_cd          ON public_api_list (org_cd);
CREATE INDEX IF NOT EXISTS idx_pal_api_type        ON public_api_list (api_type);
CREATE INDEX IF NOT EXISTS idx_pal_new_category_cd ON public_api_list (new_category_cd);
CREATE INDEX IF NOT EXISTS idx_pal_is_deleted      ON public_api_list (is_deleted);
CREATE INDEX IF NOT EXISTS idx_pal_updated_at      ON public_api_list (updated_at);

-- public_api_operation
CREATE INDEX IF NOT EXISTS idx_pao_list_id         ON public_api_operation (list_id);


-- ─────────────────────────────────────────
-- 4. token_blacklist  (로그아웃 토큰 무효화)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_blacklist (
    token_hash  TEXT        NOT NULL PRIMARY KEY,   -- Access Token SHA-256
    expires_at  TIMESTAMPTZ NOT NULL,               -- 원 토큰 만료 시각 (이후 자동 정리)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist (expires_at);

COMMENT ON TABLE token_blacklist IS 'JWT Access Token 블랙리스트 — 로그아웃 시 즉시 무효화';


-- ─────────────────────────────────────────
-- 5. scheduler_lock  (Blue/Green 중복 실행 방지)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduler_lock (
    lock_name    TEXT        NOT NULL PRIMARY KEY,  -- 스케줄러 고유 이름
    locked_until TIMESTAMPTZ NOT NULL,              -- 락 만료 시각
    locked_by    TEXT        NOT NULL               -- 인스턴스 ID (UUID 앞 8자리)
);

COMMENT ON TABLE scheduler_lock IS 'Blue/Green 배포 오버랩 구간 스케줄러 중복 실행 방지 락';

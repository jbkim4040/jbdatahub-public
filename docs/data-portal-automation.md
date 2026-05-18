# 공공데이터포털 (data.go.kr) API 사용신청 자동화

## 개요

12,055개 공공데이터 API 사용신청을 Admin Portal에서 자동화.

## 흐름

```
1. 사용자가 한 번 data.go.kr 로그인 (브라우저)
   ↓
2. F12 → cookie 복사 → Admin Portal "세션 등록"
   ↓
3. 신청하고 싶은 API 선택 → "신청" 버튼
   ↓
4. 백엔드 백그라운드 worker가 자동 제출
   ↓
5. data.go.kr이 승인/거절 → 매일 polling
   ↓
6. 승인 시 API 키 자동 추출 → DB 저장
```

## 세션 등록 절차 (사용자)

1. https://www.data.go.kr 접속
2. 우상단 "로그인" → 카카오/네이버로 로그인 (또는 일반 ID/PW)
3. 로그인 성공 후 F12 (개발자 도구) 열기
4. 탭: **Application** → 좌측 **Cookies** → `https://www.data.go.kr`
5. 표에서 **Name, Value** 칸들 복사 (특히 JSESSIONID, SCOUTER, OZSESSION 등)
6. 형식: `Name1=Value1; Name2=Value2; ...`
7. Admin Portal → 공공API 신청 → "세션 등록" → 붙여넣기 → 저장

세션 유효 기간: 보통 24시간 ~ 7일. 만료 시 재등록 (사이트 위에 알림)

## API

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/subscription/session` | 세션 cookie 저장 |
| GET  | `/api/subscription/session/status` | 세션 상태 |
| POST | `/api/subscription/request` | 신청 추가 (백그라운드 자동 제출) |
| GET  | `/api/subscription/list` | 신청 목록 (필터: status) |
| GET  | `/api/subscription/status/{id}` | 신청 상세 |
| POST | `/api/subscription/refresh-status` | 승인 여부 재조회 |

## DB 테이블

- `api_subscriptions`: 신청 추적 (status, api_key, raw_request, raw_response)
- `data_portal_session`: 세션 cookie (label 단위, 30일 만료)

## 한계 / 향후 작업

### Phase 1+2 완료
- ✅ DB 스키마
- ✅ Backend API (cookie 저장, 신청 큐, 상태 조회)
- ✅ Frontend UI (세션 등록 + 신청 목록)
- ✅ 자동 제출 PoC (httpx 기반 세션 검증)

### Phase 3 (다음)
- data.go.kr 신청 폼 selector 정확 분석
- POST 데이터 구조 + CSRF 토큰 추출
- 사용목적/활용분야 자동 작성

### Phase 4
- 매일 cron으로 SUBMITTED → APPROVED 변환 감지
- 승인 시 API 키 페이지 크롤링 → DB

### Phase 5
- 거절/만료 알림 (Slack/Email)
- 대량 신청 시 rate limiting (10건/분)
- 사용자 행동 모방 (랜덤 delay)

## 위험 관리

- **rate limit**: 분당 10건 이하
- **세션 공유**: 한 명만 사용 권장 (계정 lock 위험)
- **사이트 변경**: DOM/API 변경 시 selector 깨짐 → 알림 + 수동 복구
- **약관**: data.go.kr 이용약관 미위반 (자동화 자체는 명시 금지 없음)

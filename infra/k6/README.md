# k6 부하 테스트 — Prometheus + Grafana 통합

## 흐름
```
GitHub Actions (load-test.yml)
  └─ k6 run --out experimental-prometheus-rw=http://localhost:19091/api/v1/write
      └─ SSH 터널 (ssh -L 19091:localhost:19091 ubuntu@CI)
          └─ CI 서버 Prometheus (--web.enable-remote-write-receiver)
              └─ Grafana 대시보드 "k6 Load Test — jbDataHub"
```

## 시나리오 (infra/k6/*.js)
| 파일 | 부하 | 임계값 | 용도 |
|---|---|---|---|
| smoke.js | 30s · 5 VU | p95<800ms | PR 머지 전 sanity |
| baseline.js | 5m · 20 VU | p95<500ms · err<1% | nightly 02:00 KST |
| stress.js | 9m · 0→200 VU | p95<3000ms | 한계 측정 |
| spike.js | 2m · 0→500 VU | p95<5000ms · err<20% | 회복 테스트 |

## 실행 방법
**수동 (Actions UI)**: Actions → "Load Test (k6)" → Run workflow → 시나리오 선택
**자동 (nightly)**: cron `0 17 * * *` (02:00 KST) baseline 실행

## Grafana 대시보드
- URL: https://grafana.jbdatahub.com → "k6 Load Test — jbDataHub"
- 패널: 총 요청수 / RPS / 에러율 / VU / p95·p99 / 엔드포인트별 응답시간 / 체크 성공률
- testid 변수로 각 실행 구분 (예: `baseline-20260519-021500`)

## GitHub Secrets 등록 (필수)
Prometheus 송출을 위한 SSH 키를 등록해야 합니다. 미등록 시 k6는 실행되지만 Grafana로 메트릭이 가지 않습니다.

```
Settings → Secrets and variables → Actions → New repository secret
Name:  CI_SSH_PRIVATE_KEY
Value: ~/Downloads/jb-manager.key 의 전체 내용 (-----BEGIN ... -----END)
```

## Prometheus 설정 (CI 서버)
- 컨테이너: `prometheus` (127.0.0.1:19091 → 9090)
- remote-write receiver: `--web.enable-remote-write-receiver`
- TSDB retention: 15일
- 데이터: named volume `monitoring_prometheus-data`

## 트러블슈팅
- **k6 메트릭 안 보임**: GitHub Secrets `CI_SSH_PRIVATE_KEY` 등록 확인 + workflow 로그에서 "tunnel_up=true" 확인
- **터널 실패**: CI 서버 22 포트 / jb-manager.key 권한 / known_hosts
- **Prometheus 다운**: `ssh ubuntu@168.107.20.90 'docker ps | grep prometheus'`
- **대시보드 없음**: `/home/ubuntu/monitoring/grafana/dashboards/` 마운트 확인

# 모니터링 스택

Prometheus + Alertmanager + Grafana 를 docker-compose 로 구동.
백엔드(`/actuator/prometheus`) 메트릭을 스크랩하여 알림 규칙 평가 → Alertmanager 로 라우팅,
Grafana 에서 시각화.

## 구성

| 파일 | 역할 |
|---|---|
| `prometheus.yml` | 스크랩 / 룰 / Alertmanager 연결. 타겟의 `ACTIVE_COLOR` 자리는 Jenkins 가 sed 로 치환 |
| `alert.rules.yml` | 알림 규칙 (BackendDown / 5xx / p95 / Heap / Hikari …) |
| `alertmanager.yml` | 라우트 / 수신자 (현재 webhook 미설정, 자리만 마련) |
| `grafana/provisioning/datasources/` | Prometheus 데이터소스 자동 등록 |
| `grafana/provisioning/dashboards/` | 대시보드 프로바이더 정의 |
| `grafana/dashboards/jbdatahub-overview.json` | HTTP / JVM / DB / Cache 단일 대시보드 |
| `docker-compose.monitoring.yml` | 스택 정의 |

## 최초 기동 (서버에서 1회)

```bash
cd /home/ubuntu/jb-workspace/monitoring
# 활성 색상 결정 (없으면 green 기본)
ACTIVE=$(cat /var/jenkins_home/bg-state.txt 2>/dev/null || echo green)
sed "s/ACTIVE_COLOR/jbdatahub-${ACTIVE}/" prometheus.yml > /tmp/prometheus.rendered.yml
cp /tmp/prometheus.rendered.yml prometheus.yml.runtime  # 참고용

# 기존 prometheus/grafana 가 떠 있다면 정리
docker stop prometheus grafana 2>/dev/null || true
docker rm   prometheus grafana 2>/dev/null || true

# 스택 기동
GRAFANA_ADMIN_PASSWORD='changeme' docker compose -f docker-compose.monitoring.yml up -d
```

## Jenkins 배포 흐름과의 통합

`Jenkinsfile` 의 Blue/Green 단계에서 다음을 수행:

1. 새 색상 결정 후 `monitoring/prometheus.yml` 의 `ACTIVE_COLOR` 를 sed 로 치환
2. `docker cp` 로 prometheus 컨테이너 안의 `/etc/prometheus/prometheus.yml` 교체
3. `POST /-/reload` 로 reload (재시작 X)

## Grafana 접속

- URL: `http://158.180.65.135:3001`
- 초기 계정: `admin / changeme` (환경변수 `GRAFANA_ADMIN_PASSWORD` 로 변경)
- 대시보드: `jbDataHub → jbDataHub — Overview` 자동 등록

## 알림 채널 추가

`alertmanager.yml` 의 `webhook_configs` 또는 `slack_configs` 에 실제 endpoint 추가 후:

```bash
docker exec alertmanager wget -q -O - --post-data "" http://localhost:9093/-/reload
```

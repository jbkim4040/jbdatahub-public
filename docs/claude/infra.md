## 인프라 접속

### 서버 목록
| 서버 | IP | SSH 키 | 용도 |
|------|-----|--------|------|
| 인프라 서버 | `168.107.20.90` | `~/Downloads/jb-manager.key` | Jenkins, Nginx-ssl, Grafana, Prometheus, Loki |
| 앱 서버 | `140.245.74.59` | `~/Downloads/jb-service.key` | jbdatahub-blue/green, jbdatahubui, nginx |
| DB 서버 | `152.69.232.44` | `~/Downloads/jbdbkey.key` | PostgreSQL (hostname: jb-db) |
| 임베드 서비스 | `10.0.0.188:8001` (내부망) | 인프라 서버 경유 | 벡터 임베딩 서비스 |

### SSH 접속
```bash
# 인프라 서버 (Jenkins, 모니터링)
ssh -i ~/Downloads/jb-manager.key ubuntu@168.107.20.90

# 앱 서버 (실제 서비스 컨테이너)
ssh -i ~/Downloads/jb-service.key ubuntu@140.245.74.59

# DB 서버
ssh -i ~/Downloads/jbdbkey.key ubuntu@152.69.232.44

# 임베드 서비스 (내부망 — 인프라 서버에서만 접근)
# ssh 후: curl http://10.0.0.188:8001/health
```

> ⚠️ `jb-datahub-db-server.key`, `jbdatahubdbserver.key` 는 권한(0644)이 열려있어 SSH 거부됨 — 사용 전 `chmod 600` 필요

### 메인 서버 컨테이너 구성
| 컨테이너 | 포트 | 설명 |
|----------|------|------|
| `jenkins` | `127.0.0.1:19090→8080` | CI/CD |
| `prometheus` | `127.0.0.1:19091→9090` | 메트릭 수집 |
| `grafana` | `127.0.0.1:13000→3000` | 모니터링 대시보드 |
| `nginx-ssl` | 443 | 리버스 프록시 |
| `admin-portal-blue` | `172.17.0.1:18080` | 관리 포털 |
| `loki` | `0.0.0.0:3100` | 로그 수집 |

### Jenkins 빌드 트리거
```bash
ssh -i ~/Downloads/jb-manager.key ubuntu@168.107.20.90 "
  CRUMB=\$(curl -s -c /tmp/jc -u 'jb-datahub-admin:@jbdatahubadminjenkins' \
    'http://127.0.0.1:19090/crumbIssuer/api/json' | python3 -c \"import sys,json; print(json.load(sys.stdin)['crumb'])\")
  curl -s -o /dev/null -w '%{http_code}' -X POST \
    -b /tmp/jc -u 'jb-datahub-admin:@jbdatahubadminjenkins' \
    -H \"Jenkins-Crumb: \$CRUMB\" -d 'json={}' \
    'http://127.0.0.1:19090/job/jb-workspace/build'
"
# 201 반환 시 성공
```

- DB: Supabase PostgreSQL → `DB_URL=jdbc:postgresql://152.69.232.44:5432/jbdatahub`

### 서버 정보 변경 후 접속 테스트 절차
서버 IP·키·포트 등 인프라 정보를 변경한 경우 반드시 아래 순서로 검증한다.

```bash
# 1. 인프라 서버 SSH
ssh -i ~/Downloads/jb-manager.key -o ConnectTimeout=5 ubuntu@168.107.20.90 "echo ok"

# 2. 앱 서버 SSH
ssh -i ~/Downloads/jb-service.key -o ConnectTimeout=5 ubuntu@140.245.74.59 "echo ok"

# 3. DB 서버 SSH
ssh -i ~/Downloads/jbdbkey.key -o ConnectTimeout=5 ubuntu@152.69.232.44 "echo ok"

# 4. Jenkins 응답 확인 (인프라 서버 경유)
ssh -i ~/Downloads/jb-manager.key ubuntu@168.107.20.90 \
  "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:19090/login"

# 5. 앱 헬스체크 (앱 서버 경유)
ssh -i ~/Downloads/jb-service.key ubuntu@140.245.74.59 \
  "curl -sk https://localhost/api/health"

# 6. 임베드 서비스 확인 (인프라 서버 경유)
ssh -i ~/Downloads/jb-manager.key ubuntu@168.107.20.90 \
  "curl -s -o /dev/null -w '%{http_code}' http://10.0.0.188:8001/health"

# 7. 앱 컨테이너 상태 확인
ssh -i ~/Downloads/jb-service.key ubuntu@140.245.74.59 "docker ps | grep jbdatahub"
```

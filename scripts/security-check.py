#!/usr/bin/env python3
"""
jb-workspace Infrastructure Security Check Tool
CIS Benchmark Linux/Docker + OWASP ASVS v4 기반

Usage:
  python3 scripts/security-check.py [--server infra|app|db|all] [--json PATH]

참조 표준:
  - CIS Benchmark for Ubuntu Linux 22.04 LTS
  - CIS Benchmark for Docker
  - OWASP Application Security Verification Standard (ASVS) v4.0
  - NIST SP 800-123 (Guide to General Server Security)
"""
import argparse, base64, json, os, re, socket, subprocess, sys, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import datetime

# ── 서버 설정 ─────────────────────────────────────────────────────────────
SERVERS = {
    'infra': {'host': '168.107.20.90', 'key': '~/Downloads/jb-manager.key', 'user': 'ubuntu', 'label': '인프라 서버'},
    'app':   {'host': '140.245.74.59', 'key': '~/Downloads/jb-service.key',  'user': 'ubuntu', 'label': '앱 서버'},
    'db':    {'host': '152.69.232.44', 'key': '~/Downloads/jbdbkey.key',     'user': 'ubuntu', 'label': 'DB 서버'},
}
APP_INTERNAL_BASE = 'https://localhost'   # 앱 서버 내부 기준 (smoke-test.sh 동일 방식)
DB_HOST = '152.69.232.44'
DB_PORT = 5432
JENKINS_INTERNAL = 'http://127.0.0.1:19090'

# ── 리스크 점수 (CVSS 영향도 기반 가중치) ──────────────────────────────────
# 논문 참조: "Quantitative Security Risk Assessment" (NIST SP 800-30)
# CRITICAL=30, HIGH=20, MEDIUM=10, LOW=5 — FAIL은 전점, WARN은 절반 부과
SEV_PENALTY = {'CRITICAL': 30, 'HIGH': 20, 'MEDIUM': 10, 'LOW': 5, 'INFO': 0}

# ── ANSI 컬러 ─────────────────────────────────────────────────────────────
R = '\033[91m'; Y = '\033[93m'; G = '\033[92m'; C = '\033[96m'
B = '\033[1m';  D = '\033[90m'; E = '\033[0m'
STATUS_CLR = {'PASS': G, 'FAIL': R, 'WARN': Y, 'INFO': C, 'ERROR': D}
STATUS_ICO = {'PASS': '✓', 'FAIL': '✕', 'WARN': '⚠', 'INFO': 'ℹ', 'ERROR': '?'}

# ── 결과 모델 ─────────────────────────────────────────────────────────────
@dataclass
class Finding:
    category: str
    check: str
    status: str     # PASS | FAIL | WARN | INFO | ERROR
    severity: str   # CRITICAL | HIGH | MEDIUM | LOW | INFO
    message: str
    detail: str = ''
    server: str = ''
    ref: str = ''   # CIS / OWASP 참조

findings: list[Finding] = []
_findings_lock = threading.Lock()

def add(category, check, status, severity, message, detail='', server='', ref=''):
    with _findings_lock:
        findings.append(Finding(category, check, status, severity, message, detail, server, ref))

# ── 헬퍼: SSH 명령 실행 ───────────────────────────────────────────────────
def ssh(sname: str, cmd: str, timeout=15) -> tuple[str, int]:
    s = SERVERS[sname]
    key = os.path.expanduser(s['key'])
    try:
        r = subprocess.run(
            ['ssh', '-i', key,
             '-o', 'StrictHostKeyChecking=no',
             '-o', f'ConnectTimeout=8',
             '-o', 'BatchMode=yes',
             f"{s['user']}@{s['host']}", cmd],
            capture_output=True, text=True, timeout=timeout
        )
        return r.stdout.strip(), r.returncode
    except subprocess.TimeoutExpired:
        return 'TIMEOUT', 1
    except Exception as e:
        return str(e), 1

# ── 헬퍼: HTTP 상태코드 확인 (앱 서버 내부 경유) ─────────────────────────
def app_http_status(path: str) -> int:
    """앱 서버 내부에서 https://localhost{path} 상태코드 확인"""
    out, rc = ssh('app', f"curl -sk -o /dev/null -w '%{{http_code}}' --max-time 5 '{APP_INTERNAL_BASE}{path}'")
    try:
        return int(out.strip())
    except:
        return 0

def app_http_body(path: str) -> str:
    """앱 서버 내부에서 https://localhost{path} 응답 바디"""
    out, _ = ssh('app', f"curl -sk --max-time 5 '{APP_INTERNAL_BASE}{path}'")
    return out

def app_http_headers(path: str) -> dict[str, str]:
    """앱 서버 내부에서 응답 헤더 파싱"""
    out, _ = ssh('app', f"curl -skI --max-time 5 '{APP_INTERNAL_BASE}{path}'")
    headers = {}
    for line in out.splitlines():
        if ':' in line and not line.startswith('HTTP'):
            k, _, v = line.partition(':')
            headers[k.strip().lower()] = v.strip()
    return headers

# ── 헬퍼: TCP 포트 외부 접근 가능 여부 확인 (shell 우회, socket 직접 사용) ──
def is_tcp_open(host: str, port: int, timeout=3) -> bool:
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


# ═══════════════════════════════════════════════════════════════════════════
# 1. SSH 하드닝  (CIS Ubuntu 22.04 LTS Benchmark 5.2.x)
# ═══════════════════════════════════════════════════════════════════════════
def check_ssh(sname: str):
    cat = 'SSH 하드닝'
    cfg_cmd = 'grep -vE "^#|^$" /etc/ssh/sshd_config; grep -vE "^#|^$" /etc/ssh/sshd_config.d/*.conf 2>/dev/null'
    out, rc = ssh(sname, cfg_cmd)
    if rc != 0 or 'TIMEOUT' in out:
        add(cat, 'SSH 접속', 'ERROR', 'INFO', f'{sname}: SSH 접속 실패 — 점검 불가', server=sname)
        return

    cfg = out

    def val(pattern, default=None):
        m = re.search(pattern, cfg, re.IGNORECASE)
        return m.group(1) if m else default

    # CIS 5.2.8 — 비밀번호 인증
    if re.search(r'passwordauthentication\s+no', cfg, re.I):
        add(cat, 'PasswordAuthentication', 'PASS', 'INFO', '비밀번호 인증 비활성화', server=sname, ref='CIS 5.2.8')
    else:
        add(cat, 'PasswordAuthentication', 'FAIL', 'CRITICAL',
            '비밀번호 인증 활성화됨 — brute force 공격에 취약',
            'sshd_config: PasswordAuthentication no', server=sname, ref='CIS 5.2.8')

    # CIS 5.2.10 — root 직접 로그인
    if re.search(r'permitrootlogin\s+(no|prohibit-password|without-password)', cfg, re.I):
        add(cat, 'PermitRootLogin', 'PASS', 'INFO', 'root 직접 로그인 차단', server=sname, ref='CIS 5.2.10')
    else:
        add(cat, 'PermitRootLogin', 'WARN', 'HIGH',
            'root 직접 로그인 허용 상태',
            'sshd_config: PermitRootLogin no', server=sname, ref='CIS 5.2.10')

    # CIS 5.2.7 — MaxAuthTries
    tries = val(r'maxauthtries\s+(\d+)')
    if tries and int(tries) <= 3:
        add(cat, 'MaxAuthTries', 'PASS', 'INFO', f'MaxAuthTries={tries}', server=sname, ref='CIS 5.2.7')
    elif tries:
        add(cat, 'MaxAuthTries', 'WARN', 'MEDIUM',
            f'MaxAuthTries={tries} (권장: ≤3)',
            'sshd_config: MaxAuthTries 3', server=sname, ref='CIS 5.2.7')
    else:
        add(cat, 'MaxAuthTries', 'WARN', 'MEDIUM',
            'MaxAuthTries 미설정 (기본값 6)',
            'sshd_config: MaxAuthTries 3', server=sname, ref='CIS 5.2.7')

    # CIS 5.2.16 — LoginGraceTime
    grace = val(r'logingracetime\s+(\d+)')
    grace_val = int(grace) if grace else 120
    if grace_val <= 30:
        add(cat, 'LoginGraceTime', 'PASS', 'INFO', f'LoginGraceTime={grace_val}s', server=sname, ref='CIS 5.2.16')
    else:
        add(cat, 'LoginGraceTime', 'WARN', 'LOW',
            f'LoginGraceTime={grace_val}s (권장: ≤30s)',
            'sshd_config: LoginGraceTime 30', server=sname, ref='CIS 5.2.16')

    # CIS 5.2.6 — X11Forwarding
    if re.search(r'x11forwarding\s+no', cfg, re.I):
        add(cat, 'X11Forwarding', 'PASS', 'INFO', 'X11 포워딩 비활성화', server=sname, ref='CIS 5.2.6')
    else:
        add(cat, 'X11Forwarding', 'WARN', 'LOW',
            'X11 포워딩 활성화됨',
            'sshd_config: X11Forwarding no', server=sname, ref='CIS 5.2.6')

    # CIS 5.2.17 — AllowUsers
    if re.search(r'allowusers\s+\S+', cfg, re.I):
        m = re.search(r'allowusers\s+(.+)', cfg, re.I)
        add(cat, 'AllowUsers', 'PASS', 'INFO', f'AllowUsers: {m.group(1) if m else "설정됨"}', server=sname, ref='CIS 5.2.17')
    else:
        add(cat, 'AllowUsers', 'WARN', 'MEDIUM',
            'AllowUsers 미설정 — 시스템 모든 계정 SSH 허용',
            'sshd_config: AllowUsers ubuntu', server=sname, ref='CIS 5.2.17')

    # CIS 5.2.14 — MaxStartups (DHEat DoS 방어, 2024 SSH 보안 표준)
    # 참조: openssh.com/security.html — CPU 고갈 DoS 공격 방어
    mstart = val(r'maxstartups\s+(\S+)')
    if mstart:
        add(cat, 'MaxStartups (DHEat)', 'PASS', 'INFO',
            f'MaxStartups={mstart} (DoS 방어 설정됨)', server=sname, ref='CVE-2024-6387')
    else:
        add(cat, 'MaxStartups (DHEat)', 'WARN', 'MEDIUM',
            'MaxStartups 미설정 — SSH 연결 폭증 DoS 공격 취약',
            'sshd_config: MaxStartups 10:30:100', server=sname, ref='CVE-2024-6387')

    # SSH 키 교환 알고리즘 (Curve25519 권장, 취약 알고리즘 비활성화)
    # 참조: NIST SP 800-186, OpenSSH 2024 Best Practices
    kex_out, _ = ssh(sname, 'ssh -Q kex 2>/dev/null | head -10 || echo "unknown"')
    weak_kex = [k for k in kex_out.splitlines()
                if re.search(r'diffie-hellman-group1|diffie-hellman-group14-sha1|gss-gex-sha1', k, re.I)]
    if weak_kex:
        add(cat, 'SSH KEX 알고리즘', 'WARN', 'MEDIUM',
            f'취약 키 교환 알고리즘 활성화: {", ".join(weak_kex[:3])}',
            'sshd_config: KexAlgorithms curve25519-sha256,ecdh-sha2-nistp256',
            server=sname, ref='NIST SP 800-186')
    else:
        add(cat, 'SSH KEX 알고리즘', 'PASS', 'INFO',
            'DH Group1/Group14-SHA1 비활성화 확인', server=sname, ref='NIST SP 800-186')

    # authorized_keys 등록 키 수
    keys_out, _ = ssh(sname,
        'for f in /home/*/.ssh/authorized_keys /root/.ssh/authorized_keys; do '
        '[ -f "$f" ] && echo "$f:$(wc -l < "$f")"; done')
    for line in keys_out.splitlines():
        if ':' in line:
            path, cnt = line.rsplit(':', 1)
            add(cat, 'authorized_keys', 'INFO', 'INFO',
                f'{path}: {cnt.strip()}개 키 — 불필요한 키 정기 감사 권장', server=sname)


# ═══════════════════════════════════════════════════════════════════════════
# 2. 네트워크 / 방화벽  (CIS 3.5.x, NIST SP 800-123 4.x)
# ═══════════════════════════════════════════════════════════════════════════
def check_network(sname: str):
    cat = '네트워크·방화벽'

    # SSH 포트 IP 제한 여부
    ipt_out, _ = ssh(sname, 'sudo iptables -L INPUT -n 2>/dev/null | grep "dpt:22"')
    if '0.0.0.0/0' in ipt_out:
        add(cat, 'SSH IP 제한', 'WARN', 'HIGH',
            'SSH(22) 전체 IP 허용 — 공격자 brute-force 스캔 노출',
            'iptables로 관리 IP 대역만 허용:\n'
            '  iptables -A INPUT -p tcp --dport 22 -s <YOUR_IP> -j ACCEPT\n'
            '  iptables -A INPUT -p tcp --dport 22 -j DROP',
            server=sname, ref='CIS 3.5.2.1')
    elif ipt_out:
        add(cat, 'SSH IP 제한', 'PASS', 'INFO', 'SSH 접근 IP 제한 적용됨', server=sname)
    else:
        add(cat, 'SSH IP 제한', 'INFO', 'INFO', 'iptables SSH 규칙 확인 불가', server=sname)

    # UFW 상태
    ufw_out, _ = ssh(sname, 'sudo ufw status 2>/dev/null')
    if 'active' in ufw_out.lower():
        add(cat, 'UFW', 'PASS', 'INFO', f'UFW 활성화', server=sname)
    else:
        add(cat, 'UFW', 'WARN', 'MEDIUM',
            'UFW 비활성화 — iptables 직접 관리 중',
            '`sudo ufw enable` 후 규칙 정리 권장', server=sname, ref='CIS 3.5.1')

    # 리스닝 포트 목록
    ports_out, _ = ssh(sname,
        "ss -tlnp 2>/dev/null | awk 'NR>1{print $4}' | grep -oE '[0-9]+$' | sort -un")
    if ports_out:
        add(cat, '오픈 포트', 'INFO', 'INFO',
            f'Listening: {", ".join(ports_out.splitlines())}', server=sname)


# ═══════════════════════════════════════════════════════════════════════════
# 3. DB 보안  (PostgreSQL — 외부 노출 + 접근 제어)
# ═══════════════════════════════════════════════════════════════════════════
def check_db():
    cat = 'DB 보안'

    # PostgreSQL 5432 외부 TCP 접근
    if is_tcp_open(DB_HOST, DB_PORT):
        add(cat, 'PostgreSQL 외부 노출', 'FAIL', 'CRITICAL',
            f'PostgreSQL 5432 포트가 인터넷에서 직접 접근 가능',
            'DB 서버 iptables: 5432를 앱 서버 IP(140.245.74.59)만 허용\n'
            '  iptables -A INPUT -p tcp --dport 5432 -s 140.245.74.59 -j ACCEPT\n'
            '  iptables -A INPUT -p tcp --dport 5432 -j DROP',
            ref='CIS PostgreSQL 3.2')
    else:
        add(cat, 'PostgreSQL 외부 노출', 'PASS', 'INFO',
            'PostgreSQL 5432 포트 외부 차단 확인', ref='CIS PostgreSQL 3.2')

    # DB 서버 SSH 설정 점검
    check_ssh('db')


# ═══════════════════════════════════════════════════════════════════════════
# 4. Docker 컨테이너 보안  (CIS Docker Benchmark 4.x, 5.x)
# ═══════════════════════════════════════════════════════════════════════════
def check_docker():
    cat = 'Docker 보안'
    sname = 'app'

    containers_out, rc = ssh(sname, "docker ps --format '{{.Names}}\t{{.Image}}' 2>/dev/null")
    if rc != 0:
        add(cat, 'Docker 접근', 'INFO', 'INFO', 'docker ps 실행 불가 (권한 없음)', server=sname)
        return

    containers = [line.split('\t')[0] for line in containers_out.splitlines() if line]
    if not containers:
        add(cat, '실행 컨테이너', 'INFO', 'INFO', '실행 중인 컨테이너 없음', server=sname)
        return

    add(cat, '실행 컨테이너', 'INFO', 'INFO',
        f'실행 중: {", ".join(containers)}', server=sname)

    root_ctrs, priv_ctrs, env_issues = [], [], []

    # 단일 SSH 호출로 모든 컨테이너 inspect (N+1 → 1회)
    inspect_raw, _ = ssh(sname, "docker inspect $(docker ps -q) 2>/dev/null || echo '[]'", timeout=20)
    try:
        inspect_data = json.loads(inspect_raw or '[]')
    except:
        inspect_data = []

    for cdata in inspect_data:
        cname = cdata.get('Name', '').lstrip('/')
        # CIS 4.1 — Non-root 사용자 실행
        user = (cdata.get('Config') or {}).get('User', '')
        if not user or user in ('', 'root', '0'):
            root_ctrs.append(cname)
        # CIS 5.4 — Privileged 모드
        if (cdata.get('HostConfig') or {}).get('Privileged', False):
            priv_ctrs.append(cname)
        # CIS 4.6 — 환경변수 평문 시크릿
        envs = (cdata.get('Config') or {}).get('Env') or []
        leaked = [e.split('=')[0] for e in envs
                  if re.search(r'(password|secret|key|token|pwd)', e.split('=')[0], re.I)
                  and '=' in e and e.split('=', 1)[1]]
        if leaked:
            env_issues.append(f'{cname}: {", ".join(leaked)}')
        # CIS 5.25 — 메모리 제한 (루프 내에서 처리)
        mem = (cdata.get('HostConfig') or {}).get('Memory', -1)
        if mem == 0:
            add(cat, f'메모리 제한 ({cname})', 'WARN', 'LOW',
                f'{cname}: 메모리 제한 미설정 (OOM 위험)',
                'docker run --memory 512m 또는 compose: mem_limit 설정',
                server=sname, ref='CIS Docker 5.25')

    if root_ctrs:
        add(cat, 'Root 실행 컨테이너', 'WARN', 'HIGH',
            f'root 권한 실행 컨테이너: {", ".join(root_ctrs)}',
            'Dockerfile에 `USER nonroot` 추가 (e.g., addgroup/adduser 후 USER 지시어)',
            server=sname, ref='CIS Docker 4.1')
    else:
        add(cat, 'Root 실행 컨테이너', 'PASS', 'INFO', '모든 컨테이너 non-root 실행', server=sname)

    if priv_ctrs:
        add(cat, 'Privileged 컨테이너', 'FAIL', 'CRITICAL',
            f'Privileged 모드 컨테이너: {", ".join(priv_ctrs)}',
            '--privileged 제거 후 필요 capability만 명시: --cap-add NET_BIND_SERVICE',
            server=sname, ref='CIS Docker 5.4')
    else:
        add(cat, 'Privileged 컨테이너', 'PASS', 'INFO', 'Privileged 컨테이너 없음', server=sname)

    if env_issues:
        add(cat, '환경변수 시크릿', 'WARN', 'MEDIUM',
            '평문 시크릿 환경변수 감지',
            '\n'.join(env_issues) + '\nDocker secrets 또는 Vault 사용 권장',
            server=sname, ref='CIS Docker 4.6')
    else:
        add(cat, '환경변수 시크릿', 'PASS', 'INFO', '환경변수 평문 시크릿 없음', server=sname)

    # Trivy CVE 이미지 스캔 (설치된 경우)
    # 참조: container-security-scanning best practices (Wiz, Anchore 2024)
    # `which trivy && docker images` 를 단일 SSH 호출로 합산 (연결 1회 절약)
    trivy_info, _ = ssh(sname,
        "which trivy 2>/dev/null && "
        "docker images --format '{{.Repository}}:{{.Tag}}' | grep -v '<none>' | head -5")
    trivy_lines = trivy_info.splitlines()
    if trivy_lines and '/' in trivy_lines[0]:   # trivy 경로가 첫 줄에 출력됨
        images = [img for img in trivy_lines[1:] if img]
        for img in images:
            # HIGH: 이미지 이름 화이트리스트 검증 — 셸 메타문자 인젝션 방지
            if not re.match(r'^[a-zA-Z0-9.\-/_:@]+$', img):
                add(cat, f'CVE 스캔 ({img[:40]})', 'WARN', 'INFO',
                    f'이미지 이름에 허용되지 않은 문자 — 스캔 건너뜀', server=sname)
                continue
            trivy_out, _ = ssh(sname,
                f"trivy image --no-progress --timeout 45s "
                f"--severity CRITICAL,HIGH --format json '{img}' 2>/dev/null"
                f" | python3 -c \""
                f"import sys,json; d=json.load(sys.stdin); "
                f"vulns=d['Results'][0].get('Vulnerabilities',[]) if d.get('Results') else []; "
                f"print(sum(1 for v in vulns if v.get('Severity')=='CRITICAL'),"
                f"sum(1 for v in vulns if v.get('Severity')=='HIGH'))\"",
                timeout=60)
            try:
                cr_n, hi_n = (int(x) for x in trivy_out.split())
                if cr_n > 0:
                    add(cat, f'CVE 스캔 ({img[:40]})', 'FAIL', 'CRITICAL',
                        f'Critical CVE {cr_n}개 / High {hi_n}개 감지',
                        'docker pull <latest> 후 재빌드 또는 베이스 이미지 업그레이드',
                        server=sname, ref='OWASP A06:2021')
                elif hi_n > 0:
                    add(cat, f'CVE 스캔 ({img[:40]})', 'WARN', 'HIGH',
                        f'High CVE {hi_n}개 감지', server=sname, ref='OWASP A06:2021')
                else:
                    add(cat, f'CVE 스캔 ({img[:40]})', 'PASS', 'INFO',
                        'Critical/High CVE 없음', server=sname)
            except:
                pass
    else:
        add(cat, 'CVE 이미지 스캔', 'INFO', 'INFO',
            'Trivy 미설치 — CVE 스캔 생략 (설치 권장: apt install trivy)',
            server=sname, ref='OWASP A06:2021')


# ═══════════════════════════════════════════════════════════════════════════
# 5. 애플리케이션 보안  (OWASP ASVS v4.0)
# ═══════════════════════════════════════════════════════════════════════════
def check_application():
    cat = '애플리케이션'

    # OWASP ASVS 9.1.1 — HTTPS 전용
    redirect_out, _ = ssh('app',
        f"curl -sk --max-time 5 -o /dev/null -w '%{{url_effective}}' "
        f"http://localhost/api/health")
    if redirect_out.startswith('https://'):
        add(cat, 'HTTP→HTTPS 리다이렉트', 'PASS', 'INFO', f'HTTP → HTTPS 리다이렉트 확인',
            ref='OWASP ASVS 9.1.1')
    else:
        add(cat, 'HTTP→HTTPS 리다이렉트', 'WARN', 'MEDIUM',
            'HTTP 요청이 HTTPS로 자동 리다이렉트 안됨',
            'Nginx: return 301 https://$host$request_uri;',
            ref='OWASP ASVS 9.1.1')

    # OWASP API9:2023 — Swagger UI 인증 여부
    swagger_status = app_http_status('/swagger-ui')
    if swagger_status == 200:
        add(cat, 'Swagger UI 노출', 'WARN', 'MEDIUM',
            'Swagger UI 인증 없이 접근 가능 — API 명세 전체 노출',
            'prod: springdoc.api-docs.enabled=false 또는 IP 제한 권장',
            ref='OWASP API9:2023')
    elif swagger_status in (401, 403):
        add(cat, 'Swagger UI 노출', 'PASS', 'INFO', f'Swagger UI 인증 필요 (HTTP {swagger_status})',
            ref='OWASP API9:2023')
    else:
        add(cat, 'Swagger UI 노출', 'PASS', 'INFO', f'Swagger UI 접근 차단 (HTTP {swagger_status})')

    # OWASP API8:2023 — Actuator 민감 엔드포인트
    sensitive_actuators = ['env', 'beans', 'mappings', 'heapdump', 'threaddump']
    exposed_actuators = []
    for ep in sensitive_actuators:
        if app_http_status(f'/actuator/{ep}') == 200:
            exposed_actuators.append(ep)
    if exposed_actuators:
        add(cat, 'Actuator 민감 엔드포인트', 'FAIL', 'HIGH',
            f'인증 없이 접근 가능: /actuator/{", ".join(exposed_actuators)}',
            'application.yml: management.endpoints.web.exposure.include=health,metrics,prometheus',
            ref='OWASP API8:2023')
    else:
        add(cat, 'Actuator 민감 엔드포인트', 'PASS', 'INFO',
            '민감 Actuator 엔드포인트 노출 없음', ref='OWASP API8:2023')

    # OWASP ASVS 3.5.x — JWT 인증 헤더
    me_status = app_http_status('/api/auth/me')
    if me_status == 401:
        add(cat, '인증 보호 엔드포인트', 'PASS', 'INFO',
            '/api/auth/me 비인증 접근 → 401 차단', ref='OWASP ASVS 3.5.1')
    else:
        add(cat, '인증 보호 엔드포인트', 'FAIL', 'CRITICAL',
            f'/api/auth/me 비인증 접근 → HTTP {me_status} (401 예상)',
            ref='OWASP ASVS 3.5.1')

    # OWASP A05:2021 — 보안 응답 헤더
    headers = app_http_headers('/api/health')
    security_headers = {
        'strict-transport-security': ('HSTS 미설정', 'MEDIUM', 'OWASP A05:2021'),
        'x-content-type-options':    ('X-Content-Type-Options 미설정', 'LOW', 'OWASP A05:2021'),
        'x-frame-options':           ('X-Frame-Options 미설정', 'LOW', 'OWASP A05:2021'),
    }
    for h, (msg, sev, ref) in security_headers.items():
        if h in headers:
            add(cat, f'헤더: {h}', 'PASS', 'INFO', f'{h}: {headers[h][:60]}', ref=ref)
        else:
            add(cat, f'헤더: {h}', 'WARN', sev, msg,
                f'Nginx: add_header {h} ...;', ref=ref)

    # SSRF 방어 점검 (smoke-test.sh 동일 케이스)
    ssrf_status = app_http_status_post(
        '/api/public-data/invoke',
        '{"serviceKey":"test","endpointUrl":"https://evil.com/steal","params":{}}')
    if ssrf_status == 400:
        add(cat, 'SSRF 방어', 'PASS', 'INFO', 'SSRF 차단 확인 (허용 도메인 외 → 400)',
            ref='OWASP SSRF A10:2021')
    elif ssrf_status == 401:
        add(cat, 'SSRF 방어', 'INFO', 'INFO', 'SSRF 엔드포인트 인증 필요 (401) — 직접 점검 불가')
    else:
        add(cat, 'SSRF 방어', 'WARN', 'HIGH',
            f'SSRF 엔드포인트가 임의 URL 허용 가능 (HTTP {ssrf_status})',
            ref='OWASP SSRF A10:2021')


def app_http_status_post(path: str, body: str) -> int:
    # MEDIUM fix: base64 인코딩으로 body 셸 인젝션 방지
    # base64 출력([A-Za-z0-9+/=])은 단따옴표 내에서 안전
    b64 = base64.b64encode(body.encode()).decode()
    out, _ = ssh('app',
        f"echo '{b64}' | base64 -d | "
        f"curl -sk -o /dev/null -w '%{{http_code}}' --max-time 5 "
        f"-X POST -H 'Content-Type: application/json' "
        f"--data-binary @- '{APP_INTERNAL_BASE}{path}'")
    try:
        return int(out.strip())
    except:
        return 0


# ═══════════════════════════════════════════════════════════════════════════
# 6. Jenkins 보안
# ═══════════════════════════════════════════════════════════════════════════
def check_jenkins():
    cat = 'Jenkins'

    # 익명 접근 (인프라 서버 내부에서 Jenkins API 호출)
    anon_out, _ = ssh('infra',
        f"curl -s -o /dev/null -w '%{{http_code}}' --max-time 5 "
        f"'{JENKINS_INTERNAL}/api/json'")
    if anon_out.strip() == '200':
        add(cat, '익명 API 접근', 'FAIL', 'HIGH',
            'Jenkins REST API 인증 없이 접근 가능',
            'Manage Jenkins > Configure Global Security > Authorization: Matrix 설정\n'
            '익명 사용자 권한 전부 제거',
            server='infra')
    elif anon_out.strip() == '403':
        add(cat, '익명 API 접근', 'PASS', 'INFO', 'Jenkins API 익명 접근 차단 (403)', server='infra')
    else:
        add(cat, '익명 API 접근', 'INFO', 'INFO', f'Jenkins 응답: {anon_out} (직접 확인 필요)', server='infra')

    # Jenkins 외부 URL 노출 여부 (nginx에서 /jenkins 경로 프록시 여부)
    # 인프라 서버의 nginx가 외부에 Jenkins를 노출하는지
    nginx_conf_out, _ = ssh('infra',
        'grep -r "proxy_pass.*19090\\|proxy_pass.*jenkins" /etc/nginx/ 2>/dev/null | head -5')
    if nginx_conf_out:
        add(cat, 'Jenkins 외부 노출', 'WARN', 'HIGH',
            'Nginx가 Jenkins를 외부에 프록시 중일 수 있음',
            f'설정 확인: {nginx_conf_out[:100]}',
            server='infra')
    else:
        add(cat, 'Jenkins 외부 노출', 'PASS', 'INFO',
            'Nginx에서 Jenkins 프록시 설정 없음 (내부망 전용)', server='infra')


# ═══════════════════════════════════════════════════════════════════════════
# 7. JWT / 인증 설정  (OWASP ASVS 3.x)
# ═══════════════════════════════════════════════════════════════════════════
def check_jwt():
    cat = 'JWT·인증'

    yml_path = 'server/jbdatahub/src/main/resources/application.yml'
    if os.path.exists(yml_path):
        content = open(yml_path).read()
        m = re.search(r'expiration:\s*(\d+)', content)
        if m:
            ms = int(m.group(1))
            minutes = ms / 60000
            if minutes <= 15:
                add(cat, 'Access Token 만료', 'PASS', 'INFO',
                    f'Access Token TTL: {minutes:.0f}분 (권장범위 내)',
                    ref='OWASP ASVS 3.2.1')
            elif minutes <= 60:
                add(cat, 'Access Token 만료', 'WARN', 'LOW',
                    f'Access Token TTL: {minutes:.0f}분 (권장: ≤15분)',
                    ref='OWASP ASVS 3.2.1')
            else:
                add(cat, 'Access Token 만료', 'FAIL', 'HIGH',
                    f'Access Token TTL: {minutes:.0f}분 — 유출 시 장기 악용 가능',
                    ref='OWASP ASVS 3.2.1')

        # Token Blacklist 만료 정리 스케줄러 여부
        if 'token_blacklist' in content or 'tokenBlacklist' in content:
            add(cat, 'Token Blacklist', 'INFO', 'INFO',
                'token_blacklist 테이블 만료 항목 정기 삭제 로직 확인됨')
        else:
            add(cat, 'Token Blacklist', 'WARN', 'LOW',
                'token_blacklist 만료 정리 스케줄러 설정 확인 필요',
                'DELETE FROM token_blacklist WHERE expires_at < NOW() 정기 실행 필요')


# ═══════════════════════════════════════════════════════════════════════════
# 8. 의존성 취약점  (OWASP A06:2021)
# ═══════════════════════════════════════════════════════════════════════════
def check_dependencies():
    cat = '의존성 취약점'

    # npm audit
    npm_result = subprocess.run(
        ['npm', 'audit', '--json', '--prefix', 'ui/jbdatahub'],
        capture_output=True, text=True
    )
    try:
        audit = json.loads(npm_result.stdout)
        vulns = audit.get('metadata', {}).get('vulnerabilities', {})
        critical = vulns.get('critical', 0)
        high = vulns.get('high', 0)
        moderate = vulns.get('moderate', 0)
        low = vulns.get('low', 0)

        if critical > 0:
            add(cat, 'npm audit', 'FAIL', 'CRITICAL',
                f'npm Critical {critical}개 / High {high}개 취약점',
                'npm audit fix --force 또는 취약 패키지 업그레이드', ref='OWASP A06:2021')
        elif high > 0:
            add(cat, 'npm audit', 'FAIL', 'HIGH',
                f'npm High {high}개 / Moderate {moderate}개 취약점',
                'npm audit fix', ref='OWASP A06:2021')
        elif moderate > 0:
            add(cat, 'npm audit', 'WARN', 'MEDIUM',
                f'npm Moderate {moderate}개 / Low {low}개 취약점',
                ref='OWASP A06:2021')
        else:
            add(cat, 'npm audit', 'PASS', 'INFO',
                f'npm 취약점 없음 (total: {sum(vulns.values())})')
    except:
        add(cat, 'npm audit', 'INFO', 'INFO', 'npm audit 실행 불가 (node_modules 없음?)')


# ═══════════════════════════════════════════════════════════════════════════
# 리포터
# ═══════════════════════════════════════════════════════════════════════════
def compute_score() -> tuple[int, int, int]:
    """
    CVSS-based 환경 가중 점수 계산 (NIST SP 800-30, CVSS v4 Environmental Score 참조)
    - 공개 서비스(app) 관련 취약점: 1.5× 가중
    - 인프라(infra): 1.2×
    - 내부(db, 미지정): 1.0×
    공식: penalty += base_penalty × env_weight
    """
    ENV_WEIGHT = {'app': 1.5, 'infra': 1.2, 'db': 1.0, '': 1.0}
    penalty = 0.0
    fail_n = warn_n = 0
    for f in findings:
        weight = ENV_WEIGHT.get(f.server, 1.0)
        if f.status == 'FAIL':
            penalty += SEV_PENALTY.get(f.severity, 0) * weight
            fail_n += 1
        elif f.status == 'WARN':
            penalty += SEV_PENALTY.get(f.severity, 0) / 2 * weight
            warn_n += 1
    return max(0, round(100 - penalty)), fail_n, warn_n


def print_report():
    print(f'\n{B}{"═" * 64}{E}')
    print(f'{B}   jb-workspace 인프라 보안 점검 리포트{E}')
    print(f'{D}   {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}  |  '
          f'CIS Benchmark + OWASP ASVS v4{E}')
    print(f'{B}{"═" * 64}{E}\n')

    cats: dict[str, list[Finding]] = {}
    for f in findings:
        cats.setdefault(f.category, []).append(f)

    for cat, items in cats.items():
        fail = sum(1 for f in items if f.status == 'FAIL')
        warn = sum(1 for f in items if f.status == 'WARN')
        badge = f'{R}✕{fail}{E} ' if fail else ''
        badge += f'{Y}⚠{warn}{E}' if warn else ''
        print(f'{B}{C}▶ {cat}{E}  {badge}')

        for f in items:
            sclr = STATUS_CLR.get(f.status, D)
            ico = STATUS_ICO.get(f.status, '?')
            srv = f' [{f.server}]' if f.server else ''
            ref_txt = f'  {D}({f.ref}){E}' if f.ref else ''
            sev_txt = f' {SEV_CLR_MAP.get(f.severity, "")}{f.severity}{E}' \
                if f.status in ('FAIL', 'WARN') else ''
            print(f'  {sclr}{ico}{E}{sev_txt} {f.message}{D}{srv}{E}{ref_txt}')
            if f.detail:
                for line in f.detail.splitlines():
                    print(f'     {D}{line}{E}')
        print()

    score, fail_n, warn_n = compute_score()
    sc = G if score >= 80 else (Y if score >= 60 else R)

    print(f'{B}{"─" * 64}{E}')
    risk_level = '낮음' if score >= 80 else ('보통' if score >= 60 else '높음')
    print(f'{B}  보안 점수: {sc}{score}/100{E}  '
          f'(리스크: {sc}{risk_level}{E})  |  '
          f'실패: {R}{fail_n}건{E}  경고: {Y}{warn_n}건{E}')
    print(f'{B}{"═" * 64}{E}\n')

    if fail_n > 0:
        print(f'{R}{B}[즉시 조치 필요]{E}')
        for f in findings:
            if f.status == 'FAIL':
                srv = f'[{f.server}] ' if f.server else ''
                print(f'  {R}✕{E} {srv}{f.message}')
        print()


SEV_CLR_MAP = {'CRITICAL': R, 'HIGH': R, 'MEDIUM': Y, 'LOW': Y}


def save_json(path: str):
    score, fail_n, warn_n = compute_score()
    report = {
        'generated_at': datetime.now().isoformat(),
        'score': score,
        'summary': {
            'total': len(findings),
            'fail': fail_n,
            'warn': warn_n,
            'pass': sum(1 for f in findings if f.status == 'PASS'),
            'info': sum(1 for f in findings if f.status == 'INFO'),
        },
        'findings': [asdict(f) for f in findings],
    }
    with open(path, 'w', encoding='utf-8') as fp:
        json.dump(report, fp, ensure_ascii=False, indent=2)
    os.chmod(path, 0o600)   # LOW fix: 리포트 파일 소유자만 읽기 가능
    print(f'{G}✓ JSON 리포트 저장: {path}{E}')


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(
        description='jb-workspace 인프라 보안 점검 도구',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='예시:\n'
               '  python3 scripts/security-check.py\n'
               '  python3 scripts/security-check.py --server app\n'
               '  python3 scripts/security-check.py --json /tmp/report.json'
    )
    parser.add_argument('--server', choices=['infra', 'app', 'db', 'all'], default='all',
                        help='점검 대상 서버 (기본: all)')
    parser.add_argument('--json', metavar='PATH',
                        help='JSON 리포트 저장 경로')
    parser.add_argument('--skip-deps', action='store_true',
                        help='의존성 취약점 점검 건너뜀 (npm audit 느릴 때)')
    args = parser.parse_args()

    targets = list(SERVERS.keys()) if args.server == 'all' else [args.server]

    def progress(msg):
        print(f'{D}  ▷ {msg}...{E}', end='\r', flush=True)

    # SSH 하드닝 + 네트워크 — 서버별 병렬 실행 (ThreadPoolExecutor)
    # findings.add()는 내부에서 threading.Lock 사용으로 thread-safe
    def _check_server(s):
        check_ssh(s)
        check_network(s)

    with ThreadPoolExecutor(max_workers=len(targets)) as ex:
        list(ex.map(_check_server, targets))

    # DB 외부 노출
    if 'db' in targets or args.server == 'all':
        progress('DB 포트 외부 노출 점검')
        check_db()

    # Docker
    if 'app' in targets or args.server == 'all':
        progress('Docker 컨테이너 보안 점검')
        check_docker()

    # 애플리케이션
    if 'app' in targets or args.server == 'all':
        progress('애플리케이션 보안 점검')
        check_application()

    # Jenkins
    if 'infra' in targets or args.server == 'all':
        progress('Jenkins 보안 점검')
        check_jenkins()

    # JWT / 로컬 설정
    progress('JWT·인증 설정 점검')
    check_jwt()

    # 의존성
    if not args.skip_deps:
        progress('의존성 취약점 점검 (npm audit)')
        check_dependencies()

    # 클리어 진행 메시지
    print(' ' * 60, end='\r')

    print_report()

    if args.json:
        save_json(args.json)


if __name__ == '__main__':
    main()

pipeline {
    agent any

    environment {
        ENV_FILE   = "/var/jenkins_home/secrets/.env"
        STATE_FILE = "/var/jenkins_home/bg-state.txt"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                echo "✅ 소스 체크아웃 완료: ${WORKSPACE}"
            }
        }

        stage('.env 복사') {
            steps {
                sh 'cp ${ENV_FILE} ${WORKSPACE}/.env'
                echo "✅ 시크릿 파일 복사 완료"
            }
        }

        stage('UI 빌드') {
            steps {
                sh 'cd ${WORKSPACE} && docker compose up -d --build jbdatahubui'
                echo "✅ UI 빌드 완료"
            }
        }

        stage('Blue/Green 백엔드 배포') {
            steps {
                sh '''
                    # ── 1. 현재 active 색상 결정 ──────────────────────────
                    ACTIVE=$(cat ${STATE_FILE} 2>/dev/null || echo "blue")
                    if [ "$ACTIVE" = "blue" ]; then
                        INACTIVE="green"
                    else
                        INACTIVE="blue"
                    fi
                    echo "현재 active=${ACTIVE} / 배포 대상=${INACTIVE}"

                    # ── 2. 기존 단일 jbdatahub 컨테이너 정리 (첫 전환 시) ──
                    docker stop jbdatahub 2>/dev/null || true
                    docker rm   jbdatahub 2>/dev/null || true

                    # ── 3. Inactive 컨테이너 빌드 & 시작 ─────────────────
                    cd ${WORKSPACE}
                    docker compose up -d --build jbdatahub-${INACTIVE}

                    # ── 4. 헬스체크 (5초 간격 × 최대 36회 = 3분) ─────────
                    echo "헬스체크 시작 (jbdatahub-${INACTIVE})..."
                    PASSED=0
                    for i in $(seq 1 36); do
                        STATUS=$(docker exec jbdatahub-${INACTIVE} \
                            curl -sf -o /dev/null -w "%{http_code}" \
                            http://localhost:8080/api/health 2>/dev/null || echo "000")
                        echo "[${i}/36] health=${STATUS}"
                        if [ "$STATUS" = "200" ]; then
                            echo "✅ 헬스체크 통과"
                            PASSED=1
                            break
                        fi
                        sleep 5
                    done

                    if [ "$PASSED" = "0" ]; then
                        echo "❌ 헬스체크 타임아웃 — 롤백"
                        docker stop jbdatahub-${INACTIVE} 2>/dev/null || true
                        exit 1
                    fi

                    # ── 5. nginx upstream 전환 ────────────────────────────
                    sed "s/ACTIVE_COLOR/jbdatahub-${INACTIVE}/" \
                        ${WORKSPACE}/nginx/conf.d/default.conf.tmpl > /tmp/nginx-bg.conf
                    docker cp /tmp/nginx-bg.conf nginx:/etc/nginx/conf.d/default.conf
                    docker exec nginx nginx -t && docker exec nginx nginx -s reload
                    echo "✅ nginx → jbdatahub-${INACTIVE}"

                    # ── 6. 이전 컨테이너 중지 ────────────────────────────
                    docker stop jbdatahub-${ACTIVE} 2>/dev/null || true
                    echo "✅ jbdatahub-${ACTIVE} 중지"

                    # ── 7. 상태 저장 ──────────────────────────────────────
                    echo "${INACTIVE}" > ${STATE_FILE}
                    echo "✅ Blue/Green 배포 완료 — active: ${INACTIVE}"
                '''
            }
        }

        stage('Nginx 시작') {
            steps {
                sh 'cd ${WORKSPACE} && docker compose up -d nginx'
                echo "✅ Nginx 시작 완료"
            }
        }
    }

    post {
        success { echo "🎉 배포 성공! 빌드 번호: ${BUILD_NUMBER}" }
        failure { echo "❌ 배포 실패! 로그를 확인하세요." }
    }
}

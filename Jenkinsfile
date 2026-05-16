pipeline {
    agent any

    environment {
        ENV_FILE         = "/var/jenkins_home/secrets/.env"
        STATE_FILE       = "/var/jenkins_home/bg-state.txt"
        NETWORK          = "jb-workspace_app-network"
        DOCKER_BUILDKIT  = "1"
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
                sh 'cp $ENV_FILE $WORKSPACE/.env'
                echo "✅ 시크릿 파일 복사 완료"
            }
        }

        stage('네트워크 확인') {
            steps {
                sh 'docker network inspect $NETWORK >/dev/null 2>&1 || docker network create $NETWORK'
                echo "✅ 네트워크 확인 완료"
            }
        }

        stage('UI 빌드') {
            steps {
                sh '''
                    docker build -t jbdatahubui:latest $WORKSPACE/jbDataHubUI
                    docker stop jbdatahubui 2>/dev/null || true
                    docker rm   jbdatahubui 2>/dev/null || true
                    docker run -d \
                        --name jbdatahubui \
                        --restart unless-stopped \
                        --log-opt max-size=10m \
                        --log-opt max-file=3 \
                        --network $NETWORK \
                        jbdatahubui:latest
                '''
                echo "✅ UI 빌드 완료"
            }
        }

        stage('Blue/Green 백엔드 배포') {
            steps {
                sh '''
                    # ── 1. 현재 active 색상 결정 ──────────────────────────
                    ACTIVE=$(cat $STATE_FILE 2>/dev/null || echo "blue")
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
                    docker build -t jbdatahub-backend:latest $WORKSPACE/jbDataHub
                    docker stop jbdatahub-${INACTIVE} 2>/dev/null || true
                    docker rm   jbdatahub-${INACTIVE} 2>/dev/null || true
                    docker run -d \
                        --name jbdatahub-${INACTIVE} \
                        --restart unless-stopped \
                        --log-opt max-size=20m \
                        --log-opt max-file=5 \
                        --env-file $WORKSPACE/.env \
                        -e SPRING_PROFILES_ACTIVE=prod \
                        --network $NETWORK \
                        jbdatahub-backend:latest

                    # ── 4. 헬스체크 (5초 간격 × 최대 100회 = 8분20초) ─────────
                    echo "헬스체크 시작 (jbdatahub-${INACTIVE})..."
                    PASSED=0
                    for i in $(seq 1 100); do
                        STATUS=$(docker exec jbdatahub-${INACTIVE} \
                            curl -s -o /dev/null -w "%{http_code}" \
                            http://localhost:8080/api/health 2>/dev/null) || STATUS="000"
                        echo "[${i}/60] health=${STATUS}"
                        if [ "$STATUS" = "200" ]; then
                            echo "✅ 헬스체크 통과"
                            PASSED=1
                            break
                        fi
                        sleep 5
                    done

                    if [ "$PASSED" = "0" ]; then
                        echo "❌ 헬스체크 타임아웃 (500초) — 롤백"
                        docker stop jbdatahub-${INACTIVE} 2>/dev/null || true
                        exit 1
                    fi

                    # ── 5. nginx upstream 전환 ────────────────────────────
                    sed "s/ACTIVE_COLOR/jbdatahub-${INACTIVE}/" \
                        $WORKSPACE/nginx/conf.d/default.conf.tmpl > /tmp/nginx-bg.conf
                    docker cp /tmp/nginx-bg.conf nginx:/etc/nginx/conf.d/default.conf
                    docker exec nginx nginx -t && docker exec nginx nginx -s reload
                    echo "✅ nginx → jbdatahub-${INACTIVE}"

                    # ── 6. 이전 컨테이너 중지 ────────────────────────────
                    docker stop jbdatahub-${ACTIVE} 2>/dev/null || true
                    echo "✅ jbdatahub-${ACTIVE} 중지"

                    # ── 7. 상태 저장 ──────────────────────────────────────
                    echo "${INACTIVE}" > $STATE_FILE
                    echo "✅ Blue/Green 배포 완료 — active: ${INACTIVE}"
                '''
            }
        }

        stage('Nginx 시작') {
            steps {
                sh '''
                    if docker ps --format "{{.Names}}" | grep -q "^nginx$"; then
                        echo "✅ nginx 이미 실행 중"
                    else
                        mkdir -p $WORKSPACE/certbot/conf $WORKSPACE/certbot/www
                        docker run -d \
                            --name nginx \
                            --restart unless-stopped \
                            -p 80:80 \
                            -p 443:443 \
                            -v $WORKSPACE/nginx/conf.d:/etc/nginx/conf.d \
                            -v $WORKSPACE/certbot/conf:/etc/letsencrypt:ro \
                            -v $WORKSPACE/certbot/www:/var/www/certbot:ro \
                            --network $NETWORK \
                            nginx:alpine
                        echo "✅ nginx 시작 완료"
                    fi
                '''
            }
        }
    }

    post {
        success {
            echo "🎉 배포 성공! 빌드 번호: ${BUILD_NUMBER}"
            sh """
                GITHUB_TOKEN=\$(grep ^GITHUB_TOKEN= /var/jenkins_home/secrets/.env | cut -d= -f2-)
                curl -sf -X POST \\
                  -H "Authorization: token \${GITHUB_TOKEN}" \\
                  -H "Content-Type: application/json" \\
                  https://api.github.com/repos/jbkim4040/jb-workspace/statuses/${GIT_COMMIT} \\
                  -d "{\\\"state\\\": \\\"success\\\", \\\"description\\\": \\\"Build #${BUILD_NUMBER} succeeded\\\", \\\"context\\\": \\\"jenkins/build\\\"}" \\
                  -o /dev/null || true
            """
        }
        failure {
            echo "❌ 배포 실패! 로그를 확인하세요."
            sh """
                GITHUB_TOKEN=\$(grep ^GITHUB_TOKEN= /var/jenkins_home/secrets/.env | cut -d= -f2-)
                curl -sf -X POST \\
                  -H "Authorization: token \${GITHUB_TOKEN}" \\
                  -H "Content-Type: application/json" \\
                  https://api.github.com/repos/jbkim4040/jb-workspace/statuses/${GIT_COMMIT} \\
                  -d "{\\\"state\\\": \\\"failure\\\", \\\"description\\\": \\\"Build #${BUILD_NUMBER} failed\\\", \\\"context\\\": \\\"jenkins/build\\\"}" \\
                  -o /dev/null || true
            """
        }
    }
}

pipeline {
    agent any

    parameters {
        booleanParam(name: 'RUN_SECURITY_GATE', defaultValue: false,
            description: '배포 전 보안 게이트 실행 (~2분)')
        booleanParam(name: 'FORCE_ALL', defaultValue: false,
            description: '경로 감지 무시하고 전체 빌드')
    }

    environment {
        ENV_FILE        = "/var/jenkins_home/secrets/.env"
        STATE_FILE      = "/home/ubuntu/bg-state.txt"
        NETWORK         = "jb-workspace_app-network"
        DOCKER_BUILDKIT = "1"
        APP_SERVER      = "ubuntu@140.245.74.59"
        PROMETHEUS_URL  = "http://168.107.20.90:9091"
        CI_SERVER       = "ubuntu@168.107.20.90"
        TRIVY_CACHE     = "/tmp/trivy-cache"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('변경 경로 감지') {
            steps {
                script {
                    if (params.FORCE_ALL) {
                        env.BUILD_SERVER = 'true'
                        env.BUILD_UI = 'true'
                    } else {
                        def changed = sh(
                            script: "git log -1 --name-only --pretty=format: HEAD | grep -v '^\$' | sort -u",
                            returnStdout: true
                        ).trim()
                        echo "변경 파일:\n${changed}"
                        env.BUILD_SERVER = changed.split('\n').any { it.startsWith('server/jbdatahub/') } ? 'true' : 'false'
                        env.BUILD_UI = changed.split('\n').any { it.startsWith('ui/jbdatahub/') } ? 'true' : 'false'
                        env.BUILD_NGINX_CI = changed.split('\n').any { it == 'nginx/conf.d/ci.conf' } ? 'true' : 'false'
                        if (changed.split('\n').any { it == 'nginx/conf.d/was.conf.tmpl' || it == 'Jenkinsfile' || it == 'docker-compose.yml' || it.startsWith('deploy') }) {
                            env.BUILD_SERVER = 'true'
                            env.BUILD_UI = 'true'
                        }
                        if (env.BUILD_SERVER == 'false' && env.BUILD_UI == 'false' && env.BUILD_NGINX_CI == 'false') {
                            env.BUILD_SERVER = 'true'
                        }
                    }
                    echo "BUILD_SERVER=${env.BUILD_SERVER}  BUILD_UI=${env.BUILD_UI}  BUILD_NGINX_CI=${env.BUILD_NGINX_CI}"
                }
            }
        }

        // Controller ↔ ControllerTest 1:1 대응 검사 (면제 목록: server/jbdatahub/.test-skip)
        stage('Test Coverage Gate') {
            when { expression { return env.BUILD_SERVER == 'true' } }
            steps {
                sh 'chmod +x tools/check-controller-tests.sh && bash tools/check-controller-tests.sh'
            }
            post {
                failure {
                    error 'Test Coverage Gate 실패 — 새 컨트롤러에 테스트 파일을 추가하거나 .test-skip에 면제 사유를 기재하세요.'
                }
            }
        }

        // server 코드 변경 시 배포 전 전체 테스트 통과 필수
        stage('API 검증 (테스트)') {
            when { expression { return env.BUILD_SERVER == 'true' } }
            steps {
                dir('server/jbdatahub') {
                    sh './gradlew test --no-daemon 2>&1'
                }
            }
            post {
                always {
                    junit allowEmptyResults: true,
                          testResults: 'server/jbdatahub/build/test-results/**/*.xml'
                }
                failure {
                    error 'API 검증 실패 — 모든 테스트를 통과해야 배포가 진행됩니다.'
                }
            }
        }

        stage('보안 게이트') {
            when { expression { return params.RUN_SECURITY_GATE } }
            steps {
                sh 'mkdir -p ${WORKSPACE}/security-gate ${TRIVY_CACHE}'
                sh '''docker run --rm -v ${WORKSPACE}:/path zricethezav/gitleaks:latest detect \
                    --source /path --report-format json \
                    --report-path /path/security-gate/gitleaks.json --no-git 2>&1 | tail -5 || true'''
                sh '''docker run --rm -v ${WORKSPACE}:/workspace -v ${TRIVY_CACHE}:/root/.cache/trivy \
                    aquasec/trivy:latest fs --scanners vuln,secret,misconfig \
                    --severity HIGH,CRITICAL --exit-code 0 --format table /workspace 2>&1 | tail -30 || true'''
                echo "OK: 보안 게이트 완료"
            }
        }

        stage('.env 복사') {
            steps {
                sh 'cp $ENV_FILE $WORKSPACE/.env'
                sh 'ssh -o StrictHostKeyChecking=no $APP_SERVER "mkdir -p /home/ubuntu/.secrets && chmod 700 /home/ubuntu/.secrets"'
                sh 'scp -o StrictHostKeyChecking=no $WORKSPACE/.env $APP_SERVER:/home/ubuntu/.secrets/jbdatahub.env'
                sh 'ssh -o StrictHostKeyChecking=no $APP_SERVER "chmod 600 /home/ubuntu/.secrets/jbdatahub.env"'
            }
        }

        stage('소스 배포') {
            steps {
                sh '''
                    ssh -o StrictHostKeyChecking=no $APP_SERVER \
                        "if [ -d /home/ubuntu/jb-workspace-deploy/.git ]; then \
                            cd /home/ubuntu/jb-workspace-deploy && git fetch origin && git checkout master && git reset --hard origin/master; \
                         else \
                            git clone https://jbkim4040:$(grep ^GITHUB_TOKEN= $ENV_FILE | cut -d= -f2-)@github.com/jbkim4040/jb-workspace.git /home/ubuntu/jb-workspace-deploy; \
                         fi"
                '''
            }
        }

        stage('네트워크 확인') {
            steps {
                sh 'ssh -o StrictHostKeyChecking=no $APP_SERVER "docker network inspect $NETWORK >/dev/null 2>&1 || docker network create $NETWORK"'
            }
        }

        stage('UI 빌드') {
            when { expression { return env.BUILD_UI == 'true' } }
            steps {
                sh '''
                    ssh -o StrictHostKeyChecking=no $APP_SERVER \
                        "docker build -t jbdatahubui:latest /home/ubuntu/jb-workspace-deploy/ui/jbdatahub && \
                         docker stop jbdatahubui 2>/dev/null || true && \
                         docker rm   jbdatahubui 2>/dev/null || true && \
                         docker run -d --name jbdatahubui --restart unless-stopped \
                             --log-opt max-size=10m --log-opt max-file=3 \
                             --network jb-workspace_app-network jbdatahubui:latest"
                '''
            }
        }

        stage('Blue/Green 백엔드 배포') {
            when { expression { return env.BUILD_SERVER == 'true' } }
            steps {
                sh 'scp -o StrictHostKeyChecking=no $WORKSPACE/deploy.sh $APP_SERVER:/tmp/deploy.sh'
                sh 'ssh -o StrictHostKeyChecking=no $APP_SERVER "chmod +x /tmp/deploy.sh && bash /tmp/deploy.sh"'
            }
        }

        stage('Nginx 시작') {
            steps {
                sh '''
                    ssh -o StrictHostKeyChecking=no $APP_SERVER \
                        "docker ps --format '{{.Names}}' | grep -q '^nginx$' || \
                         (mkdir -p /home/ubuntu/jb-workspace-deploy/certbot/conf /home/ubuntu/jb-workspace-deploy/certbot/www && \
                          docker run -d --name nginx --restart unless-stopped -p 80:80 -p 443:443 \
                             -v /home/ubuntu/jb-workspace-deploy/nginx/conf.d:/etc/nginx/conf.d \
                             -v /home/ubuntu/jb-workspace-deploy/certbot/conf:/etc/letsencrypt:ro \
                             -v /home/ubuntu/jb-workspace-deploy/certbot/www:/var/www/certbot:ro \
                             --network jb-workspace_app-network nginx:alpine)"
                '''
            }
        }


        stage('CI Nginx 업데이트') {
            when { expression { return env.BUILD_NGINX_CI == 'true' } }
            steps {
                sh '''
                    scp -o StrictHostKeyChecking=no \
                        $WORKSPACE/nginx/conf.d/ci.conf \
                        $CI_SERVER:/tmp/jb-ci-nginx.conf
                    ssh -o StrictHostKeyChecking=no $CI_SERVER \
                        "docker cp /tmp/jb-ci-nginx.conf nginx-ssl:/etc/nginx/conf.d/ssl.conf && \
                         docker exec nginx-ssl nginx -t && \
                         docker exec nginx-ssl nginx -s reload && \
                         rm -f /tmp/jb-ci-nginx.conf"
                '''
            }
            post {
                failure { error 'CI Nginx 업데이트 실패 — nginx -t 결과를 확인하세요.' }
            }
        }

        stage('Prometheus 리로드') {
            steps {
                sh 'curl -s -X POST ${PROMETHEUS_URL}/-/reload >/dev/null 2>&1 || true'
            }
        }
    }

    post {
        success {
            echo "배포 성공: Build #${BUILD_NUMBER}"
            sh '''
                GITHUB_TOKEN=$(grep ^GITHUB_TOKEN= /var/jenkins_home/secrets/.env | cut -d= -f2-)
                curl -s -X POST -H "Authorization: token ${GITHUB_TOKEN}" -H "Content-Type: application/json" \
                  https://api.github.com/repos/jbkim4040/jb-workspace/statuses/${GIT_COMMIT} \
                  -d "{\"state\":\"success\",\"description\":\"Build #${BUILD_NUMBER} passed\",\"context\":\"jenkins/build\"}" \
                  -o /dev/null || true
            '''
        }
        failure {
            echo "배포 실패: Build #${BUILD_NUMBER}"
            sh '''
                GITHUB_TOKEN=$(grep ^GITHUB_TOKEN= /var/jenkins_home/secrets/.env | cut -d= -f2-)
                curl -s -X POST -H "Authorization: token ${GITHUB_TOKEN}" -H "Content-Type: application/json" \
                  https://api.github.com/repos/jbkim4040/jb-workspace/statuses/${GIT_COMMIT} \
                  -d "{\"state\":\"failure\",\"description\":\"Build #${BUILD_NUMBER} failed\",\"context\":\"jenkins/build\"}" \
                  -o /dev/null || true
            '''
        }
    }
}

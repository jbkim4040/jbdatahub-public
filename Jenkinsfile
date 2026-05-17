pipeline {
    agent any

    environment {
        ENV_FILE       = "/var/jenkins_home/secrets/.env"
        STATE_FILE     = "/home/ubuntu/bg-state.txt"
        NETWORK        = "jb-workspace_app-network"
        DOCKER_BUILDKIT = "1"
        APP_SERVER     = "ubuntu@158.180.65.135"
        PROMETHEUS_URL = "http://134.185.105.226:9091"
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

        stage('소스 배포') {
            steps {
                sh '''
                    ssh -o StrictHostKeyChecking=no $APP_SERVER \
                        "if [ -d /home/ubuntu/jb-workspace-deploy/.git ]; then
                            cd /home/ubuntu/jb-workspace-deploy && git pull origin master
                         else
                            git clone https://jbkim4040:$(grep ^GITHUB_TOKEN= $ENV_FILE | cut -d= -f2-)@github.com/jbkim4040/jb-workspace.git /home/ubuntu/jb-workspace-deploy
                         fi"
                '''
                echo "✅ 소스 동기화 완료"
            }
        }

        stage('네트워크 확인') {
            steps {
                sh '''
                    ssh -o StrictHostKeyChecking=no $APP_SERVER \
                        "docker network inspect $NETWORK >/dev/null 2>&1 || docker network create $NETWORK"
                '''
                echo "✅ 네트워크 확인 완료"
            }
        }

        stage('UI 빌드') {
            steps {
                sh '''
                    ssh -o StrictHostKeyChecking=no $APP_SERVER \
                        "docker build -t jbdatahubui:latest /home/ubuntu/jb-workspace-deploy/jbDataHubUI && \
                         docker stop jbdatahubui 2>/dev/null || true && \
                         docker rm   jbdatahubui 2>/dev/null || true && \
                         docker run -d \
                             --name jbdatahubui \
                             --restart unless-stopped \
                             --log-opt max-size=10m \
                             --log-opt max-file=3 \
                             --network jb-workspace_app-network \
                             jbdatahubui:latest"
                '''
                echo "✅ UI 빌드 완료"
            }
        }

        stage('Blue/Green 백엔드 배포') {
            steps {
                sh '''
                    # deploy.sh 를 Server 1에 전송 후 실행
                    scp -o StrictHostKeyChecking=no \
                        $WORKSPACE/deploy.sh \
                        $APP_SERVER:/tmp/deploy.sh
                    ssh -o StrictHostKeyChecking=no $APP_SERVER \
                        "chmod +x /tmp/deploy.sh && bash /tmp/deploy.sh"
                '''
            }
        }

        stage('Nginx 시작') {
            steps {
                sh '''
                    ssh -o StrictHostKeyChecking=no $APP_SERVER \
                        "docker ps --format '{{.Names}}' | grep -q '^nginx$' || \
                         (mkdir -p /home/ubuntu/jb-workspace-deploy/certbot/conf \
                                   /home/ubuntu/jb-workspace-deploy/certbot/www && \
                          docker run -d \
                             --name nginx \
                             --restart unless-stopped \
                             -p 80:80 -p 443:443 \
                             -v /home/ubuntu/jb-workspace-deploy/nginx/conf.d:/etc/nginx/conf.d \
                             -v /home/ubuntu/jb-workspace-deploy/certbot/conf:/etc/letsencrypt:ro \
                             -v /home/ubuntu/jb-workspace-deploy/certbot/www:/var/www/certbot:ro \
                             --network jb-workspace_app-network \
                             nginx:alpine && echo '✅ nginx 시작 완료')"
                '''
            }
        }

        stage('Prometheus 리로드') {
            steps {
                sh 'curl -s -X POST ${PROMETHEUS_URL}/-/reload >/dev/null 2>&1 || true'
                echo "✅ Prometheus 리로드 완료"
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

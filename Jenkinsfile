pipeline {
    agent any

    environment {
        ENV_FILE = "/var/jenkins_home/secrets/.env"   // Jenkins 컨테이너 내부 시크릿 경로
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
                // Jenkins에 미리 올려둔 .env를 워크스페이스로 복사
                sh 'cp ${ENV_FILE} ${WORKSPACE}/.env'
                echo "✅ 시크릿 파일 복사 완료"
            }
        }

        stage('Build & Deploy') {
            steps {
                sh '''
                    cd ${WORKSPACE}
                    docker compose up -d --build jbdatahubui jbdatahub
                '''
                echo "✅ 빌드 및 배포 완료"
            }
        }

        stage('Nginx 재시작') {
            steps {
                sh '''
                    cd ${WORKSPACE}
                    docker compose up -d nginx
                '''
                echo "✅ Nginx 시작 완료"
            }
        }
    }

    post {
        success { echo "🎉 배포 성공! 빌드 번호: ${BUILD_NUMBER}" }
        failure { echo "❌ 배포 실패! 로그를 확인하세요." }
    }
}

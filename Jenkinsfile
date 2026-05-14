pipeline {
    agent any

    environment {
        PROJECT_PATH = '/home/ubuntu/jb-workspace'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                echo "✅ 소스 체크아웃 완료"
            }
        }

        stage('Pull Latest') {
            steps {
                sh 'cd ${PROJECT_PATH} && git pull origin master'
                echo "✅ 최신 코드 반영 완료"
            }
        }

        stage('Build & Deploy') {
            steps {
                sh 'cd ${PROJECT_PATH} && docker compose up -d --build jbdatahubui jbdatahub'
                echo "✅ 빌드 및 배포 완료"
            }
        }

        stage('Nginx 재시작') {
            steps {
                sh 'cd ${PROJECT_PATH} && docker compose up -d nginx'
                echo "✅ Nginx 시작 완료"
            }
        }
    }

    post {
        success { echo "🎉 배포 성공! 빌드 번호: ${BUILD_NUMBER}" }
        failure { echo "❌ 배포 실패! 로그를 확인하세요." }
    }
}
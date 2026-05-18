# Jenkinsfile 시크릿 관리 (H4)

## 현재 (보안 약함)
`/var/jenkins_home/secrets/.env` 평문 파일에 시크릿 저장

## 목표 (C4 머지 후)
모든 시크릿 → Jenkins Credentials Store
- `github-pat` (Secret text)
- `db-password` (Secret text)
- `jenkins-admin-pw` (Secret text)
- `webhook-secret` (Secret text)

## 마이그레이션 절차 (C4 머지 직후)

1. Jenkins UI → Credentials → 각 항목 등록
2. Jenkinsfile의 `grep ^XXX= .env` 패턴 → `withCredentials([string(...)])` 변환
3. `/var/jenkins_home/secrets/.env` 백업 → 삭제
   ```
   sudo cp /var/jenkins_home/secrets/.env ~/secrets-backup-$(date +%F).env.gz
   sudo rm /var/jenkins_home/secrets/.env
   ```
4. 빌드 검증 (성공 시 PR + 머지)

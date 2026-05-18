// k6 spike — 갑작스러운 트래픽 폭증 / 회복 시간 측정.
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '20s', target: 10 },
    { duration: '30s', target: 500 },  // spike!
    { duration: '30s', target: 500 },
    { duration: '30s', target: 10 },   // recover
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.20'],   // 일시적 실패 허용
    http_req_duration: ['p(95)<5000'],
  },
}

const BASE = __ENV.BASE_URL || 'https://jbdatahub.com'

export default function () {
  const r = http.get(`${BASE}/api/public-data/list?page=0&size=20`)
  check(r, { '<5xx': (r) => r.status < 500 })
  sleep(0.1)
}

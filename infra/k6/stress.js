// k6 stress — 점진 부하 증가. 시스템 한계 측정 (manual trigger).
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '1m',  target: 50 },
    { duration: '2m',  target: 100 },
    { duration: '3m',  target: 200 },
    { duration: '2m',  target: 200 },
    { duration: '1m',  target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.05'],
  },
}

const BASE = __ENV.BASE_URL || 'https://jbdatahub.com'

export default function () {
  const r = http.get(`${BASE}/api/public-data/list?page=${Math.floor(Math.random()*30)}&size=20`)
  check(r, { '<5xx': (r) => r.status < 500 })
  sleep(0.3)
}

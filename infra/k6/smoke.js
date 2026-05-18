// k6 smoke test — 30초, 5 VU. PR마다 빠르게 정상 동작 확인.
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.05'],
  },
}

const BASE = __ENV.BASE_URL || 'https://jbdatahub.com'

export default function () {
  const r1 = http.get(`${BASE}/api/public-data/list?page=0&size=20`)
  check(r1, { 'list 200': (r) => r.status === 200 })

  const r2 = http.get(`${BASE}/api/public-data/related?q=의료&limit=3`)
  check(r2, { 'related 200': (r) => r.status === 200 })

  const r3 = http.get(`${BASE}/api/health`)
  check(r3, { 'health 200': (r) => r.status === 200 })

  sleep(1)
}

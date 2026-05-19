// k6 baseline — 5분, 20 VU. 평소 부하 SLO 검증 (nightly).
import http from 'k6/http'
import { check, sleep, group } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '4m', target: 20 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:list}': ['p(95)<400'],
    'http_req_duration{endpoint:related}': ['p(95)<600'],
    'http_req_duration{endpoint:login}': ['p(95)<800'],
  },
}

const BASE = __ENV.BASE_URL || 'https://jbdatahub.com'

export default function () {
  group('list', () => {
    const r = http.get(`${BASE}/api/public-data/list?page=${Math.floor(Math.random()*20)}&size=20`,
      { tags: { endpoint: 'list' } })
    check(r, { 200: (r) => r.status === 200 })
  })

  group('related', () => {
    const q = ['의료', '기상', '교통', '관광', '문화'][Math.floor(Math.random() * 5)]
    const r = http.get(`${BASE}/api/public-data/related?q=${encodeURIComponent(q)}&limit=5`,
      { tags: { endpoint: 'related' } })
    check(r, { 200: (r) => r.status === 200 })
  })

  group('login_then_me', () => {
    const r = http.post(`${BASE}/api/auth/login`,
      JSON.stringify({ username: __ENV.TEST_USERNAME || 'guest', password: __ENV.TEST_PASSWORD || 'guest' }),
      { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } })
    check(r, { 200: (r) => r.status === 200 })
  })

  sleep(Math.random() * 2 + 0.5)
}

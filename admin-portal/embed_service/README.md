# embed_service

jbdatahub의 시맨틱 검색·유사도·토픽 클러스터링용 임베딩 마이크로서비스.

## 배포 위치
- **별도 Oracle Cloud Always Free ARM A1 인스턴스** (1~2 OCPU / 4~6 GB)
- CI/모니터링 서버 부담을 피하기 위해 분리
- WAS와는 사설 IP 또는 `embed.jbdatahub.com` 경유 통신

## 모델
- `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- 384차원, 약 120MB, 한국어 포함 50+ 언어 지원
- 임베딩은 normalize 됨 (cosine = dot product)

## API
```
GET  /health                  → {ok, model, dim}
POST /embed       {text}       → {embedding: float[384]}
POST /embed_batch {texts: []}  → {embeddings: [float[384]]}
```

## 빌드 + 실행
```bash
docker build -t embed-service:latest .
docker run -d --name embed-service --restart unless-stopped \
  -p 8001:8001 embed-service:latest
```

ARM A1 1코어 기준 첫 빌드 (모델 다운로드 포함) 약 5분, 이후 캐시 사용.

## 운영
- WAS의 `EMBED_SERVICE_URL` 환경변수가 이 서비스의 base URL을 가리킴
- `SemanticSearchService.semanticSearch()`가 embed_service 미응답 시 빈 결과 반환 (fallback 안전)
- 70만 건 초기 배치는 `tools/embed_initial_batch.py` 참고

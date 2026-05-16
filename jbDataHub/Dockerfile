FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
RUN chmod +x gradlew

# 의존성만 먼저 레이어 분리 + Gradle 캐시 재사용
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew dependencies --no-daemon -q

COPY src src
RUN --mount=type=cache,target=/root/.gradle \
    GRADLE_OPTS="-Xmx512m -Xms128m" ./gradlew bootJar --no-daemon -q

FROM eclipse-temurin:21-jre-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# JVM 시작 시간 단축 플래그:
#  -XX:TieredStopAtLevel=1 : C2 JIT 단계 생략 (startup ↑, peak 성능 미세 ↓)
#  -Xss256k                : 스레드 스택 축소 (기본 1MB → 256KB, 메모리 절약)
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:TieredStopAtLevel=1", \
  "-Xss256k", \
  "-Dspring.jpa.open-in-view=false", \
  "-jar", "app.jar"]

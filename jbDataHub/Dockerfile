FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
RUN chmod +x gradlew

# 의존성만 먼저 레이어 분리 (소스 미변경 시 캐시 재사용)
RUN ./gradlew dependencies --no-daemon -q

COPY src src
RUN ./gradlew bootJar --no-daemon -q

FROM eclipse-temurin:21-jre-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Dspring.jpa.open-in-view=false", \
  "-jar", "app.jar"]

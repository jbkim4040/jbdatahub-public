FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
RUN chmod +x gradlew

# Gradle 의존성만 먼저 캐싱 (소스 변경 시 재사용)
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew dependencies --no-daemon -q

COPY src src
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew bootJar --no-daemon -q

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

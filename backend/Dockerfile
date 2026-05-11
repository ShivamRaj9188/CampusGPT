# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build the Spring Boot JAR using Maven
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jdk-alpine AS builder

WORKDIR /app

# Copy Maven wrapper and pom first (for better Docker layer caching)
COPY pom.xml .
COPY apache-maven-3.9.6 ./apache-maven-3.9.6

# Copy source code
COPY src ./src

# Build the JAR (skip tests for faster build during submission)
RUN ./apache-maven-3.9.6/bin/mvn clean package -DskipTests

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Run the JAR on a slim JRE image (no build tools, smaller image)
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy the built JAR from the builder stage
COPY --from=builder /app/target/*.jar app.jar

# Expose the Spring Boot port
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]

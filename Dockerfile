FROM node:lts-alpine AS frontend-build

WORKDIR /build/frontend

COPY ./frontend ./

RUN yarn
RUN yarn build

RUN mkdir -p /app/static/frontend
RUN mv build/* /app/static/frontend

FROM gradle:8.13-jdk17 AS backend-build

WORKDIR /build/backend

COPY ./frontend ./

RUN ./gradlew uberJar

RUN cp build/libs/*.jar /app

FROM eclipse-temurin:17-jdk-alpine

WORKDIR /app

EXPOSE 8080

# Run the app by dynamically finding the JAR file in the target directory
CMD ["sh", "-c", "java -jar /app/website-backend-*.jar --production"]

FROM node:lts-alpine AS frontend-build

WORKDIR /build/frontend

COPY ./frontend ./

RUN yarn
RUN yarn build

FROM gradle:8.13-jdk17 AS backend-build

WORKDIR /build/backend

COPY ./backend ./

RUN ./gradlew uberJar

FROM eclipse-temurin:17-jdk-alpine

WORKDIR /app

RUN mkdir -p static/frontend
COPY --from=frontend-build /build/frontend/build/* static/frontend/

COPY --from=backend-build /build/backend/build/libs/*.jar ./
COPY --from=backend-build /build/backend/static/home/* static/home/

EXPOSE 8080

# Run the app by dynamically finding the JAR file in the target directory
CMD ["sh", "-c", "java -jar /app/website-backend-*.jar --production"]

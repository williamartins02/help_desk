# ─── Etapa 1: Build da aplicação ───────────────────────────────────────────
FROM maven:3.8.6-eclipse-temurin-11 AS build
WORKDIR /app

# Copia apenas o pom.xml primeiro para aproveitar o cache de dependências
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copia o restante do código e empacota (sem rodar testes — ambiente CI)
COPY src ./src
RUN mvn package -DskipTests -B

# ─── Etapa 2: Imagem final mínima ──────────────────────────────────────────
FROM eclipse-temurin:11-jre-alpine
WORKDIR /app

# Cria usuário não-root para execução segura
RUN addgroup -S helpdesk && adduser -S helpdesk -G helpdesk
USER helpdesk

COPY --from=build /app/target/helpdesk-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]


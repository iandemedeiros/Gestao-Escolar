# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY nest-cli.json tsconfig.json ./
COPY apps ./apps
# Generate from checked-in schemas only. No credentials, introspection or migrations.
RUN npm run prisma:alunos:generate \
 && npm run prisma:professores:generate \
 && npm run prisma:turmas-disciplinas:generate \
 && npm run prisma:avaliacoes-notas:generate \
 && npm run prisma:comunicacao:generate \
 && npm run build:all
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000 3001 3002 3003 3004 3005
CMD ["node", "dist/apps/api-gateway/main.js"]

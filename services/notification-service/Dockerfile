FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json tsconfig.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/common/tsconfig.json ./packages/common/
COPY packages/common/src ./packages/common/src
COPY services/notification-service/package.json ./services/notification-service/
COPY services/notification-service/tsconfig.json ./services/notification-service/
COPY services/notification-service/src ./services/notification-service/src

RUN npm install
RUN npm run build --workspace=@app/common
RUN npm run build --workspace=@app/notification-service

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache python3 make g++

COPY package.json ./
COPY packages/common/package.json ./packages/common/
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY services/notification-service/package.json ./services/notification-service/
COPY --from=builder /app/services/notification-service/dist ./services/notification-service/dist

RUN npm install --omit=dev --workspace=@app/notification-service --workspace=@app/common

EXPOSE 8002
CMD ["node", "services/notification-service/dist/index.js"]

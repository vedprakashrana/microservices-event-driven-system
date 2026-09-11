FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json tsconfig.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/common/tsconfig.json ./packages/common/
COPY packages/common/src ./packages/common/src
COPY services/user-service/package.json ./services/user-service/
COPY services/user-service/tsconfig.json ./services/user-service/
COPY services/user-service/src ./services/user-service/src

RUN npm install
RUN npm run build --workspace=@app/common
RUN npm run build --workspace=@app/user-service

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache python3 make g++

COPY package.json ./
COPY packages/common/package.json ./packages/common/
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY services/user-service/package.json ./services/user-service/
COPY --from=builder /app/services/user-service/dist ./services/user-service/dist

RUN npm install --omit=dev --workspace=@app/user-service --workspace=@app/common

EXPOSE 8001
CMD ["node", "services/user-service/dist/index.js"]

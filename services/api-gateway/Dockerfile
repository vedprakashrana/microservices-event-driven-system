FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and package manifests
COPY package.json tsconfig.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/common/tsconfig.json ./packages/common/
COPY packages/common/src ./packages/common/src
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/api-gateway/tsconfig.json ./services/api-gateway/
COPY services/api-gateway/src ./services/api-gateway/src

# Install dependencies and build
RUN npm install
RUN npm run build --workspace=@app/common
RUN npm run build --workspace=@app/api-gateway

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY packages/common/package.json ./packages/common/
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY services/api-gateway/package.json ./services/api-gateway/
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist

RUN npm install --omit=dev --workspace=@app/api-gateway --workspace=@app/common

EXPOSE 8000
CMD ["node", "services/api-gateway/dist/index.js"]

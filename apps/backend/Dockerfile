FROM node:20-alpine

# Install pnpm globally
RUN npm install -g pnpm@10.10.0

WORKDIR /app

# Copy root configurations (since this is a Turborepo monorepo)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/config/package.json ./packages/config/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/

# Install dependencies (frozen-lockfile is not used as we are only copying partial workspace package.json files)
RUN pnpm install

# Copy source code
COPY apps/backend ./apps/backend
COPY packages/config ./packages/config
COPY packages/api-client ./packages/api-client
COPY packages/types ./packages/types
COPY packages/ui ./packages/ui
COPY packages/utils ./packages/utils

WORKDIR /app/apps/backend

EXPOSE 8000

CMD ["pnpm", "dev"]

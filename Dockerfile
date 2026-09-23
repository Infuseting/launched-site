FROM node:20-alpine AS base

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Prisma Schema
COPY prisma ./prisma
RUN npx prisma generate

# Application source
COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000

# Run prisma db push on startup then start next server
CMD ["sh", "-c", "npx prisma db push && npm start"]

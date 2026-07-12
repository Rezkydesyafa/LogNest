FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY prisma ./prisma

RUN npm ci --ignore-scripts
RUN npm run prisma:generate
RUN npm run build:worker
RUN npm prune --omit=dev

ENV NODE_ENV=production
CMD ["node", "dist/apps/worker/src/main.js"]

FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci --ignore-scripts
RUN npm run build:agent

ENV NODE_ENV=production
CMD ["npm", "run", "start:agent"]

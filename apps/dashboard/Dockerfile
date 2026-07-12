FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/frontend-logger/package.json packages/frontend-logger/package.json
RUN npm ci
COPY . .
RUN npm run build:frontend-logger && npm run build:dashboard

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0
COPY --from=build /app/apps/dashboard/.next/standalone ./
COPY --from=build /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public
EXPOSE 3001
CMD ["node", "apps/dashboard/server.js"]

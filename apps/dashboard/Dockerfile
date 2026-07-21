FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_LOGMIND_API_URL
ARG NEXT_PUBLIC_LOGMIND_CLIENT_KEY
ENV NEXT_PUBLIC_LOGMIND_API_URL=$NEXT_PUBLIC_LOGMIND_API_URL
ENV NEXT_PUBLIC_LOGMIND_CLIENT_KEY=$NEXT_PUBLIC_LOGMIND_CLIENT_KEY
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
EXPOSE 3001
CMD ["node", "apps/dashboard/server.js"]

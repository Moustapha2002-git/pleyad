# Pleyad platform — production container.
# One Node service serves the built client + the API. The database is external
# (TiDB Cloud); provide DATABASE_URL and SESSION_SECRET as environment variables.
FROM node:20-slim

RUN corepack enable
WORKDIR /app

# Install workspace dependencies (uses the committed lockfile).
COPY . .
RUN pnpm install --frozen-lockfile

# Build the client bundle (apps/platform/dist/client).
RUN pnpm -C apps/platform build

ENV NODE_ENV=production
# Hosts inject their own PORT; default to 3001 locally.
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/apps/platform
CMD ["pnpm", "start"]

FROM oven/bun:1.2.23

WORKDIR /workspace

COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/package.json
COPY apps/game/package.json apps/game/package.json
COPY packages/arcad-cli/package.json packages/arcad-cli/package.json
COPY packages/arcade-sdk/package.json packages/arcade-sdk/package.json
RUN bun install --frozen-lockfile

COPY demo demo
COPY packages packages

CMD ["bun", "demo/agents/agent.ts"]

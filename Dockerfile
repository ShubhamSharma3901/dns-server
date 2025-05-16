# Stage 1: Build the TypeScript app using Bun
FROM oven/bun AS builder

# Create working directory
WORKDIR /app

# Copy lock and package files
COPY bun.lockb package.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the source code
COPY . .

# Build the app into plain JS (Node-compatible)
RUN bun build app/main.ts --outdir=dist --target=node

# Stage 2: Run the app using a minimal Node.js runtime
FROM node:latest AS runner

WORKDIR /app

# Copy only the built output and dependencies (optional: remove src)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Expose DNS port
EXPOSE 2053/udp

# Accept command line arguments like --resolver
CMD ["node", "./dist/main.js"]
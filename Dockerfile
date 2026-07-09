# Node 22 (matches local dev: v22.16.0)
FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better layer caching — only re-runs
# npm install when package*.json actually changes, not on every
# source edit).
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the source
COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
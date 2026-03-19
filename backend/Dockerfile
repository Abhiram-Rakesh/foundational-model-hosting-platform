FROM node:18-alpine

WORKDIR /app

# Install git (needed for git add/commit/push operations)
RUN apk add --no-cache git

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create directory for git repo clone
RUN mkdir -p /app/repo

EXPOSE 3001

CMD ["node", "src/index.js"]

FROM node:18-alpine

WORKDIR /app

# Install git and kubectl
RUN apk add --no-cache git curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create directory for git repo clone
RUN mkdir -p /app/repo

EXPOSE 3001

CMD ["node", "src/index.js"]

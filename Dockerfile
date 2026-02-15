FROM node:18-bullseye-slim

WORKDIR /app
ENV NODE_ENV=production

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy app source (API + frontend static files)
COPY . .

# Ensure runtime dirs exist and are writable (uploads, logs)
RUN mkdir -p uploads logs && chown -R node:node /app

USER node

# Render sets PORT; default to 8899 in container
ENV PORT=8899
EXPOSE 8899

CMD ["node", "server.js"]

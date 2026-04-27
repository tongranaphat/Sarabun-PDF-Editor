FROM node:22-bookworm

RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

ARG SERVER_PORT=4011
EXPOSE ${SERVER_PORT}

# Auto-sync database schema on startup for development convenience
CMD ["sh", "-c", "npx prisma db push --accept-data-loss 2>&1 || echo 'Prisma push warning'; exec node index.js"]
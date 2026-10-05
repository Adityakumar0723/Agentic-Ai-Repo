FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV PORT=5000
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||5000)+'/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]

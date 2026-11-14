# Bloody-Gambit-Server (WebSockets, Räume im Speicher). Nur der Server, das Spiel ist eine statische Seite (dist/).
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8790
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY shared ./shared
COPY server ./server
USER node
EXPOSE 8790
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8790/health || exit 1
CMD ["node", "server/src/index.ts"]

# Se construye con contexto en game-time-guard/ (no en backend/), porque el
# servidor sirve el panel web desde ../../web relativo a backend/src.
FROM node:20-slim

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend ./backend
COPY web ./web

WORKDIR /app/backend
ENV NODE_ENV=production

# Cloud Run inyecta PORT (normalmente 8080); server.js ya lo respeta.
EXPOSE 8080

CMD ["node", "src/server.js"]

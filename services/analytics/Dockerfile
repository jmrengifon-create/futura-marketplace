FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --only=production
COPY shared/ ./shared/
COPY backend/s3.js ./backend/
COPY services/analytics/ ./services/analytics/
EXPOSE 3009
CMD ["node", "services/analytics/index.js"]

FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --only=production
COPY shared/ ./shared/
COPY backend/s3.js ./backend/
COPY services/shipping/ ./services/shipping/
EXPOSE 3005
CMD ["node", "services/shipping/index.js"]

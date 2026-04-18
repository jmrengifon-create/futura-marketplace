FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY backend/package*.json ./
RUN npm install --only=production
COPY shared/ ./shared/
COPY backend/s3.js ./backend/
COPY services/payment/ ./services/payment/
EXPOSE 3006
CMD ["node", "services/payment/index.js"]

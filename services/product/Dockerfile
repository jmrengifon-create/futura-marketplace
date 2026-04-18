FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY backend/package*.json ./
RUN npm install --only=production
COPY shared/ ./shared/
COPY backend/s3.js ./backend/
COPY services/product/ ./services/product/
EXPOSE 3002
CMD ["node", "services/product/index.js"]

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY backend/package*.json ./
RUN npm install --only=production
COPY shared/ ./shared/
COPY backend/s3.js ./backend/
COPY services/quotation/ ./services/quotation/
EXPOSE 3004
CMD ["node", "services/quotation/index.js"]

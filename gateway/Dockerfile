FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY gateway/package*.json ./
RUN npm install --only=production
COPY gateway/index.js ./
EXPOSE 8080
CMD ["node", "index.js"]

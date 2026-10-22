FROM node:20-alpine

# Installation des mongodb-database-tools (mongodump, mongorestore, mongoexport...)
RUN apk add --no-cache mongodb-tools

WORKDIR /app

# Installer les dépendances en premier (cache Docker optimisé)
COPY package*.json ./
RUN npm install

# Copier le code source
COPY . .

EXPOSE 3001

CMD ["node", "server.js"]

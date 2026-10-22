FROM node:20-alpine

WORKDIR /app

# Dépendances
COPY package*.json ./
RUN npm install

# Code source
COPY . .

EXPOSE 5173

# --host 0.0.0.0 obligatoire pour être accessible hors du conteneur
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

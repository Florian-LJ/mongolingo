═══════════════════════════════════════════════════════════════════
  MONGOLINGO — Application web de quiz MongoDB
  DUT Informatique Vannes — R4.03 NoSQL — G. Kerbellec 2025
═══════════════════════════════════════════════════════════════════

Lien vidéo de démonstration : https://www.youtube.com/watch?v=_pY-RvJ5wZs

───────────────────────────────────────────────────────────────────
PRÉREQUIS (Ubuntu récente)
───────────────────────────────────────────────────────────────────
1. Mettre à jour les paquets
   sudo apt update && sudo apt upgrade -y

2. Installer Docker et Docker Compose
   sudo apt install -y ca-certificates curl gnupg lsb-release
   sudo mkdir -p /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
   sudo usermod -aG docker $USER
   newgrp docker

3. Vérifier que Docker fonctionne
   docker --version
   docker compose version

───────────────────────────────────────────────────────────────────
DESCRIPTION
───────────────────────────────────────────────────────────────────

Mongolingo est une application web de quiz inspirée de Duolingo,
dédiée à l'apprentissage de MongoDB. Elle propose plus de 100
questions réparties sur 4 niveaux de difficulté (Easy, Medium,
Hard, Expert) couvrant les thèmes suivants :

  - Requêtes find() et filtres
  - Opérateurs de comparaison ($gt, $lt, $in, $ne...)
  - Opérateurs logiques ($and, $or, $not, $nor)
  - Tri, limite et pagination
  - Mise à jour ($set, $inc, $push, $addToSet)
  - Requêtes sur tableaux ($elemMatch, $size, $all)
  - Pipeline d'agrégation ($group, $lookup, $facet, $bucket)
  - Index et optimisation (règle ESR, explain())
  - Transactions ACID multi-documents
  - Conception de schéma (embed vs référence, patterns)

Chaque bonne réponse exécute la requête sur une vraie base MongoDB
et affiche le résultat en temps réel dans l'interface.

───────────────────────────────────────────────────────────────────
ARCHITECTURE
───────────────────────────────────────────────────────────────────

  mongolingo/
  ├── docker-compose.yml        ← Orchestration des 3 services
  ├── frontend/                 ← Application React + Vite
  │   ├── Dockerfile
  │   ├── src/
  │   │   ├── App.jsx           ← Navigation entre les écrans
  │   │   └── pages/            ← Home, Path, Quiz, Result, Schema, DataManager
  │   └── package.json
  ├── backend/                  ← API REST Express + Node.js
  │   ├── Dockerfile
  │   ├── server.js             ← Routes API + exécution des requêtes
  │   └── package.json
  ├── data/                     ← Données de démonstration JSON
  │   ├── users.json            ← 15 utilisateurs
  │   ├── products.json         ← 10 produits
  │   ├── orders.json           ← 12 commandes
  │   └── lessons.json          ← 100+ questions du quiz
  ├── schemas/                  ← JSON Schemas des collections
  │   ├── users.schema.json
  │   ├── products.schema.json
  │   └── orders.schema.json
  └── backup/                   ← Dossier de sauvegarde

3 services Docker :
  - mongo    : MongoDB 7 (port 27017)
  - backend  : Express Node.js (port 3001)
  - frontend : React Vite (port 5173)

───────────────────────────────────────────────────────────────────
INSTALLATION
───────────────────────────────────────────────────────────────────

1. Décompresser l'archive

   unzip mongolingo.zip
   cd mongolingo

2. Lancer l'application (première fois — télécharge les images)

   docker compose up --build

   Le premier lancement prend 2-3 minutes.
   Les étapes suivantes sont automatiques :
     ✓ Téléchargement des images Node.js et MongoDB
     ✓ Construction des images frontend et backend
     ✓ Démarrage de MongoDB
     ✓ Création des collections avec JSON Schema validators
     ✓ Chargement des données de démonstration
     ✓ Démarrage du serveur Express
     ✓ Démarrage du serveur Vite

3. Accéder à l'application

   Ouvrir dans un navigateur : http://localhost:5173

───────────────────────────────────────────────────────────────────
LOGS ATTENDUS AU DÉMARRAGE
───────────────────────────────────────────────────────────────────

   mongolingo_backend  | ✓ Mongolingo backend → http://localhost:3001
   mongolingo_backend  | ✓ Connecté à MongoDB → mongolingo
   mongolingo_backend  | ✓ Collection recréée avec validator → users
   mongolingo_backend  | ✓ 15 documents chargés → users
   mongolingo_backend  | ✓ Collection recréée avec validator → products
   mongolingo_backend  | ✓ 10 documents chargés → products
   mongolingo_backend  | ✓ Collection recréée avec validator → orders
   mongolingo_backend  | ✓ 12 documents chargés → orders
   mongolingo_backend  | ✓ 10 leçons chargées → lessons
   mongolingo_frontend | ➜  Local: http://localhost:5173/

───────────────────────────────────────────────────────────────────
COMMANDES UTILES
───────────────────────────────────────────────────────────────────

  # Lancer en arrière-plan
  docker compose up -d --build

  # Voir les logs en temps réel
  docker compose logs -f

  # Arrêter
  docker compose down

  # Arrêter et supprimer les données (repart de zéro)
  docker compose down -v

  # Accéder à MongoDB en ligne de commande
  docker exec -it mongolingo_mongo mongosh
  use mongolingo
  db.users.find()

  # Accéder au shell du backend
  docker exec -it mongolingo_backend sh

───────────────────────────────────────────────────────────────────
COLLECTIONS
───────────────────────────────────────────────────────────────────

Base de données : mongolingo

  users
    Champs : _id, username, email, age, country, role, score,
             tags, createdAt, address
    Validator : rôle limité à [admin, seller, buyer]
                age entre 13 et 120
                email validé par regex

  products
    Champs : _id, name, category, price, stock, sellerId,
             ratings, specs, createdAt
    Validator : catégorie limitée à
                [electronics, clothing, food, sport, books, other]
                prix et stock >= 0

  orders
    Champs : _id, buyerId, items, total, status, createdAt, shippedAt
    Validator : statut limité à [pending, shipped, delivered, cancelled]
                items doit contenir au moins 1 article

  lessons
    Champs : id, titre, icon, niveau, desc, questions
    Contenu : 100+ questions du quiz avec leurs requêtes MongoDB

───────────────────────────────────────────────────────────────────
TECHNOLOGIES UTILISÉES
───────────────────────────────────────────────────────────────────

  Frontend  : React 18, Vite 5
  Backend   : Node.js 20, Express 4
  Base      : MongoDB 7
  Docker    : Docker Engine, Docker Compose v2
  Polices   : Sora (Google Fonts), JetBrains Mono (Google Fonts)

═══════════════════════════════════════════════════════════════════
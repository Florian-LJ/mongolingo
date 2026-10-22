/**
 * frontend/src/pages/Schema.jsx
 *
 * Page de documentation des schémas MongoDB
 * Affiche les collections, leurs champs, et exemples de documents.
 */
import './Schema.css'

const COLLECTIONS = [
  {
    nom: 'users',
    count: '~15 documents',
    desc: 'Utilisateurs enregistrés sur la plateforme',
    champs: [
      { nom: '_id',       type: 'ObjectId', desc: 'Identifiant unique auto-généré' },
      { nom: 'username',  type: 'String',   desc: 'Nom de connexion unique, indexé' },
      { nom: 'email',     type: 'String',   desc: 'Email unique, indexé' },
      { nom: 'age',       type: 'Number',   desc: 'Âge en années' },
      { nom: 'country',   type: 'String',   desc: 'Code ISO pays (FR, US, DE…)' },
      { nom: 'role',      type: 'String',   desc: '"admin", "seller" ou "buyer"' },
      { nom: 'score',     type: 'Number',   desc: 'Score de gamification (0–10000)' },
      { nom: 'tags',      type: '[String]', desc: 'Tableau de tags d\'intérêt' },
      { nom: 'createdAt', type: 'Date',     desc: 'Date de création du compte' },
      { nom: 'address',   type: 'Object',   desc: 'Adresse imbriquée { street, city, zip }' },
    ],
    sample: `{
  "_id": ObjectId("64af3..."),
  "username": "alice42",
  "email": "alice@example.com",
  "age": 29,
  "country": "FR",
  "role": "buyer",
  "score": 1420,
  "tags": ["tech", "gaming"],
  "createdAt": ISODate("2024-01-15"),
  "address": { "city": "Nantes", "zip": "44000" }
}`
  },
  {
    nom: 'products',
    count: '~10 documents',
    desc: 'Catalogue de produits en vente',
    champs: [
      { nom: '_id',       type: 'ObjectId', desc: 'Identifiant unique' },
      { nom: 'name',      type: 'String',   desc: 'Nom du produit' },
      { nom: 'category',  type: 'String',   desc: '"electronics", "clothing", "food"…' },
      { nom: 'price',     type: 'Number',   desc: 'Prix en euros' },
      { nom: 'stock',     type: 'Number',   desc: 'Quantité disponible' },
      { nom: 'sellerId',  type: 'ObjectId', desc: 'Référence vers users._id' },
      { nom: 'ratings',   type: '[Object]', desc: 'Tableau de { userId, score, comment }' },
      { nom: 'specs',     type: 'Object',   desc: 'Spécifications techniques flexibles' },
      { nom: 'createdAt', type: 'Date',     desc: 'Date de création de l\'annonce' },
    ],
    sample: `{
  "_id": ObjectId("64af5..."),
  "name": "Mechanical Keyboard",
  "category": "electronics",
  "price": 89.99,
  "stock": 42,
  "sellerId": ObjectId("64af3..."),
  "ratings": [{ "userId": ObjectId("..."), "score": 4.5 }],
  "specs": { "color": "black", "switches": "Cherry MX" }
}`
  },
  {
    nom: 'orders',
    count: '~12 documents',
    desc: 'Commandes passées par les acheteurs',
    champs: [
      { nom: '_id',       type: 'ObjectId', desc: 'Identifiant unique' },
      { nom: 'buyerId',   type: 'ObjectId', desc: 'Référence vers users._id (acheteur)' },
      { nom: 'items',     type: '[Object]', desc: 'Tableau de { productId, qty, unitPrice }' },
      { nom: 'total',     type: 'Number',   desc: 'Total calculé de la commande' },
      { nom: 'status',    type: 'String',   desc: '"pending", "shipped", "delivered", "cancelled"' },
      { nom: 'createdAt', type: 'Date',     desc: 'Date de passage de la commande' },
      { nom: 'shippedAt', type: 'Date',     desc: 'Date d\'expédition (null si pas encore)' },
    ],
    sample: `{
  "_id": ObjectId("64af8..."),
  "buyerId": ObjectId("64af3..."),
  "items": [
    { "productId": ObjectId("64af5..."), "qty": 2, "unitPrice": 89.99 }
  ],
  "total": 179.98,
  "status": "delivered",
  "createdAt": ISODate("2024-03-10")
}`
  },
  {
    nom: 'lessons',
    count: '13 leçons — 115 questions',
    desc: 'Leçons et questions du quiz Mongolingo',
    champs: [
      { nom: '_id',       type: 'ObjectId', desc: 'Identifiant unique auto-généré par MongoDB' },
      { nom: 'id',        type: 'String',   desc: 'Identifiant métier unique (ex: find-basics)' },
      { nom: 'titre',     type: 'String',   desc: 'Titre affiché dans l\'interface' },
      { nom: 'icon',      type: 'String',   desc: 'Emoji représentant la leçon' },
      { nom: 'niveau',    type: 'String',   desc: '"easy", "medium", "hard" ou "expert"' },
      { nom: 'desc',      type: 'String',   desc: 'Description courte des thèmes abordés' },
      { nom: 'questions', type: '[Object]', desc: 'Tableau de questions — voir structure ci-dessous' },
    ],
    sample: `{
    "_id": ObjectId("..."),
    "id": "find-basics",
    "titre": "Premier find()",
    "icon": "🔍",
    "niveau": "easy",
    "desc": "Récupérer et filtrer des documents",
    "questions": [
      {
        "id": "q1",
        "enonce": "Comment récupérer TOUS les documents ?",
        "options": [
          { "code": "db.users.find({})", "correct": true },
          { "code": "db.users.get()",    "correct": false }
        ],
        "explication": "find({}) retourne tous les documents...",
        "query": {
          "collection": "users",
          "operation": "find",
          "args": [{}],
          "options": { "limit": 5 }
        }
      }
    ]
  }`
  },
]

export default function Schema({ goTo }) {
  return (
    <div className="schema">
      <div className="topbar">
        <button className="btn-back-top" onClick={() => goTo('path')}>← Retour</button>
        <div className="topbar-title">Collections</div>
        <div style={{ width: 80 }} />
      </div>

      <div className="schema-content">
        {COLLECTIONS.map(col => (
          <div key={col.nom} className="schema-card">

            <div className="schema-header">
              <span className="schema-colname">db.{col.nom}</span>
              <span className="schema-count">{col.count}</span>
            </div>

            <div className="schema-body">
              <p className="schema-desc">{col.desc}</p>

              {col.champs.map(c => (
                <div key={c.nom} className="schema-field">
                  <span className="field-nom">{c.nom}</span>
                  <span className="field-type">{c.type}</span>
                  <span className="field-desc">{c.desc}</span>
                </div>
              ))}
            </div>

            <pre className="schema-sample">{col.sample}</pre>

          </div>
        ))}
      </div>

      <div className="navbar">
        <button className="nav-item" onClick={() => goTo('path')}>🗺 Parcours</button>
        <button className="nav-item active">📋 Collections</button>
        <button className="nav-item" onClick={() => goTo('data')}>💾 Données</button>
      </div>
    </div>
  )
}
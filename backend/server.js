/**
 * backend/server.js
 *
 * API serveur Express pour Mongolingo
 * - management de la connexion MongoDB
 * - initialisation des collections, validation JSON Schema
 * - endpoints /api/* pour health, stats, load/export/dump/restore
 */
import express from 'express'
import cors from 'cors'
import { MongoClient, ObjectId, Int32 } from 'mongodb'
import { exec } from 'child_process'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017'
const DB_NAME   = process.env.DB_NAME   || 'mongolingo'
const PORT      = process.env.PORT      || 3001

const BACKUP_DIR = join(__dirname, 'backup')  // /app/backup
const DATA_DIR   = join(__dirname, 'data')    // /app/data
const SCHEMA_DIR = join(__dirname, 'schemas') // /app/schemas

let client
let db

/**
 * connect
 *
 * Initialise une connexion MongoDB réutilisable via MongoClient.
 * Si jamais connecté, réutilise la connexion existante.
 * Lance l'initialisation des collections / données (initCollections).
 *
 * @returns {Promise<import('mongodb').Db>} instance de DB Mongo
 */
async function connect() {
  if (!client) {
    client = new MongoClient(MONGO_URI)
    await client.connect()
    db = client.db(DB_NAME)
    console.log(`✓ Connecté à MongoDB → ${DB_NAME}`)

    // Appliquer les schemas dès la connexion
    await initCollections()

  }
  return db
}

/**
 * ensureCollectionExists
 *
 * Vérifie si une collection existe, sinon la crée avec le validator JSON Schema si disponible.
 * @param {*} name 
 * @returns 
 */
async function ensureCollectionExists(name) {
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext()
  if (exists) return

  const options = {
    validationAction: 'warn',
    validationLevel: 'strict'
  }
  const schemaPath = join(SCHEMA_DIR, `${name}.schema.json`)
  if (existsSync(schemaPath)) {
    const { $jsonSchema } = JSON.parse(readFileSync(schemaPath, 'utf8'))
    options.validator = { $jsonSchema }
  }

  await db.createCollection(name, options)
}

/**
 * initCollections
 *
 * Applique les JSON Schema pour chaque collection (users/products/orders),
 * reclée la collection puis charge les données de `data/*.json`.
 *
 * Utilise `validator` strict et ajuste en mode warn pendant le chargement.
 */
async function initCollections() {
  for (const name of ['users', 'products', 'orders']) {
    const schemaPath = join(SCHEMA_DIR, `${name}.schema.json`)

    if (!existsSync(schemaPath)) {
      console.log(`⚠ Schema introuvable pour '${name}'`)
      continue
    }

    const { $jsonSchema } = JSON.parse(readFileSync(schemaPath, 'utf8'))

    // Dropper et recréer pour garantir le bon validationAction
    await db.collection(name).drop().catch(() => {})
    await db.createCollection(name, {
      validator: { $jsonSchema },
      validationAction: 'error',
      validationLevel: 'strict'
    })
    console.log(`✓ Collection recréée avec validator → ${name}`)

    // Charger les données de démo automatiquement
    const dataPath = join(DATA_DIR, `${name}.json`)
    if (existsSync(dataPath)) {
      const docs = JSON.parse(readFileSync(dataPath, 'utf8'))
      const converted = docs.map(d => convertDoc(d))
      // Passer en warn le temps de l'import pour éviter les conflits de types
      await db.command({ collMod: name, validationAction: 'warn' })
      await db.collection(name).insertMany(converted)
      // Repasser en error après l'import
      await db.command({ collMod: name, validationAction: 'error' })
      console.log(`✓ ${converted.length} documents chargés → ${name}`)
    }
  }
  await initLessons()
}

/**
 * initLessons
 *
 * Lit le fichier data/lessons.json et l'insert dans la collection `lessons`.
 * Si lessons.schema.json existe, crée la collection avec validator strict.
 * Crée un index unique sur id pour éviter doublons.
 */
async function initLessons() {
  const lessonsPath = join(DATA_DIR, 'lessons.json')
  if (!existsSync(lessonsPath)) {
    console.log('⚠ lessons.json introuvable — quiz non chargé')
    return
  }

  // Lire le schema — doit être AVANT le if (validator)
  const schemaPath = join(SCHEMA_DIR, 'lessons.schema.json')
  const validator = existsSync(schemaPath)
    ? JSON.parse(readFileSync(schemaPath, 'utf8'))
    : null

  // Dropper et recréer proprement
  await db.collection('lessons').drop().catch(() => {})

  if (validator) {
    await db.createCollection('lessons', {
      validator,
      validationAction: 'warn',
      validationLevel: 'strict'
    })
    console.log('✓ Collection lessons créée avec validator')
  } else {
    await db.createCollection('lessons')
    console.log('⚠ Collection lessons créée sans validator')
  }

  // Index sur id (unique) et niveau pour filtrer par difficulté
  await db.collection('lessons').createIndex({ id: 1 }, { unique: true })

  const lessons = JSON.parse(readFileSync(lessonsPath, 'utf8'))
  await db.collection('lessons').insertMany(lessons)
  console.log(`✓ ${lessons.length} leçons chargées → lessons`)
}

/**
 * GET /api/health
 *
 * Vérifie que le serveur est joignable et que MongoDB répond.
 * - connect() est appelée pour s'assurer de la connexion
 * - ping renvoie une validation directe de MongoDB
 *
 * @returns {object} { ok: true, db }
 */
app.get('/api/health', async (req, res) => {
  try {
    await connect()
    await db.command({ ping: 1 })
    res.json({ ok: true, db: DB_NAME })
  } catch (e) {
    res.status(500).json({ ok: false, mongo_dataerror: e.message })
  }
})

/**
 * GET /api/stats
 *
 * Renvoie le nombre de documents pour each collection users/products/orders.
 * Utile pour affichage de statistiques dans l’UI.
 *
 * @returns {object} { ok: true, stats }
 */
app.get('/api/stats', async (req, res) => {
  try {
    await connect()
    const stats = {}
    for (const col of ['users', 'products', 'orders']) {
      stats[col] = await db.collection(col).countDocuments()
    }
    res.json({ ok: true, stats })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * convertDoc
 *
 * Convertit les marqueurs JSON de fichiers data/*.json en types MongoDB natifs :
 * - { $oid: '...' } -> ObjectId
 * - { $date: '...' } -> Date
 * - integers -> Int32
 *
 * @param {any} doc - document JSON (possiblement recursif)
 * @returns {any} valeur convertie compatible MongoDB
 */
function convertDoc(doc) {
  if (Array.isArray(doc)) return doc.map(convertDoc)
  if (doc && typeof doc === 'object') {
    if (doc.$oid)  return new ObjectId(doc.$oid)
    if (doc.$date) return new Date(doc.$date)

    const out = {}
    for (const [k, v] of Object.entries(doc)) {
      // _id + relations *Id en chaîne hex Web JSON -> ObjectId
      if (typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v) && (k === '_id' || k.endsWith('Id'))) {
        out[k] = new ObjectId(v)
        continue
      }

      // dates ISO en chaîne -> Date
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) {
        out[k] = new Date(v)
        continue
      }

      out[k] = convertDoc(v)
    }
    return out
  }
  if (typeof doc === 'number' && Number.isInteger(doc)) {
    return new Int32(doc)
  }
  return doc
}

/**
 * @function validateDocsWithCollectionSchema
 * @description Crée une collection temporaire avec le validator de la collection cible,
 * puis tente d'y insérer les documents pour activer la validation JSON Schema MongoDB.
 * La collection temporaire est supprimée ensuite quel que soit le résultat.
 * @param {string} collection - nom de la collection (users/products/orders/lessons)
 * @param {Array<any>} docs - documents convertis à insérer (ObjectId/Date etc.)
 * @throws {Error} si la validation échoue
 */
async function validateDocsWithCollectionSchema(collection, docs) {
  const collInfo = await db.listCollections({ name: collection }).next()
  const validator = collInfo?.options?.validator
  if (!validator) return

  const tmpCollection = `${collection}_upload_validation`
  await db.collection(tmpCollection).drop().catch(() => {})

  await db.createCollection(tmpCollection, {
    validator,
    validationAction: 'error',
    validationLevel: 'strict'
  })

  try {
    await db.collection(tmpCollection).insertMany(docs)
  } catch (err) {
    const message = err?.message || 'Document failed validation'
    throw new Error(`Schema validation échouée: ${message}`)
  } finally {
    await db.collection(tmpCollection).drop().catch(() => {})
  }
}

/**
 * @route POST /api/data/upload
 * @description Remplace le contenu de /data/<collection>.json et recharge la collection MongoDB.
 * - validation JSON Schema via validateDocsWithCollectionSchema
 * - rollback en cas d'échec d'insertion
 * @body {string} collection - users/products/orders/lessons
 * @body {Array<any>} docs - documents JSON parsés (tableau)
 * @returns {{ok: boolean, inserted?: number, path?: string, error?: string}}
 */
app.post('/api/data/upload', async (req, res) => {
  const { collection, docs } = req.body
  const allowed = ['users', 'products', 'orders', 'lessons']

  if (!collection || !allowed.includes(collection)) {
    return res.status(400).json({ ok: false, error: `Collection invalide : ${collection}` })
  }
  if (!Array.isArray(docs)) {
    return res.status(400).json({ ok: false, error: 'Le contenu doit être un tableau JSON' })
  }

  try {
    await connect()

    const converted = docs.map(d => convertDoc(d))

    // Validation stricte contre le schema MongoDB existant.
    await validateDocsWithCollectionSchema(collection, converted)

    const col = db.collection(collection)
    const previousDocs = await col.find({}).toArray()

    await col.deleteMany({})
    try {
      await col.insertMany(converted)
    } catch (e) {
      // rollback en cas d'erreur d'insertion
      await col.deleteMany({})
      if (previousDocs.length) {
        await col.insertMany(previousDocs)
      }
      const message = e?.message || 'Document failed validation'
      return res.status(400).json({ ok: false, error: `Validation ou insertion échouée : ${message}` })
    }

    const destPath = join(DATA_DIR, `${collection}.json`)
    writeFileSync(destPath, JSON.stringify(docs, null, 2), 'utf8')

    res.json({ ok: true, inserted: converted.length, path: destPath })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.post('/api/data/load', async (req, res) => {
  const { collection } = req.body
  try {
    await connect()

    // ── Cas lessons : recharge via initLessons ──────────────
    if (collection === 'lessons') {
      await initLessons()
      return res.json({ ok: true, report: [{ collection: 'lessons', inserted: 'rechargé' }] })
    }

    // ── Cas all : recharge users, products, orders + lessons ─
    if (collection === 'all') {
      const report = []
      for (const col of ['users', 'products', 'orders']) {
        const filePath = join(DATA_DIR, `${col}.json`)
        if (!existsSync(filePath)) {
          report.push({ collection: col, error: 'Fichier introuvable' })
          continue
        }
        const docs = JSON.parse(readFileSync(filePath, 'utf8'))
        const converted = docs.map(d => convertDoc(d))
        await ensureCollectionExists(col)
        await db.collection(col).deleteMany({})
        await db.command({ collMod: col, validationAction: 'warn' })
        const r = await db.collection(col).insertMany(converted)
        await db.command({ collMod: col, validationAction: 'error' })
        report.push({ collection: col, inserted: r.insertedCount })
      }
      await initLessons()
      report.push({ collection: 'lessons', inserted: 'rechargé' })
      return res.json({ ok: true, report })
    }

    // ── Cas collection unique ────────────────────────────────
    const filePath = join(DATA_DIR, `${collection}.json`)
    if (!existsSync(filePath)) {
      return res.json({ ok: true, report: [{ collection, error: 'Fichier introuvable' }] })
    }
    const docs = JSON.parse(readFileSync(filePath, 'utf8'))
    const converted = docs.map(d => convertDoc(d))
    await ensureCollectionExists(collection)
    await db.collection(collection).deleteMany({})
    await db.command({ collMod: collection, validationAction: 'warn' })
    const r = await db.collection(collection).insertMany(converted)
    await db.command({ collMod: collection, validationAction: 'error' })
    res.json({ ok: true, report: [{ collection, inserted: r.insertedCount }] })

  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * POST /api/data/dump
 *
 * Lance `mongodump` sur la base DB_NAME vers backup/bson.
 * Nécessite mongodump installé sur l'hôte.
 *
 * @returns {object} { ok: true, path }
 */
app.post('/api/data/dump', async (req, res) => {
  const outDir = join(BACKUP_DIR, 'bson')
  const cmd = `mongodump --uri="${MONGO_URI}" --db=${DB_NAME} --out="${outDir}"`
  exec(cmd, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ ok: false, error: stderr })
    res.json({ ok: true, path: outDir })
  })
})

/**
 * POST /api/data/restore
 *
 * Restaure la base depuis backup/bson/{DB_NAME} via mongorestore --drop.
 * Vérifie que le dossier existe avant lancement.
 *
 * @returns {object} { ok: true }
 */
app.post('/api/data/restore', async (req, res) => {
  const srcDir = join(BACKUP_DIR, 'bson', DB_NAME)
  if (!existsSync(srcDir))
    return res.status(400).json({ ok: false, error: 'Aucun dump BSON trouvé. Lance mongodump d\'abord.' })
  const cmd = `mongorestore --uri="${MONGO_URI}" --db=${DB_NAME} "${srcDir}" --drop`
  exec(cmd, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ ok: false, error: stderr })
    res.json({ ok: true })
  })
})

/**
 * POST /api/data/drop
 *
 * Supprime toutes les collections users/products/orders.
 * Utilisé pour réinitialiser rapidement l’état en base.
 *
 * @returns {object} { ok: true, dropped: ['users','products','orders'] }
 */
app.post('/api/data/drop', async (req, res) => {
  try {
    await connect()
    for (const col of ['users', 'products', 'orders']) {
      await db.collection(col).drop().catch(() => {})
    }
    res.json({ ok: true, dropped: ['users', 'products', 'orders'] })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * @function reloadDataCollections
 * @description Recharge les collections users/products/orders depuis les fichiers /data/*.json.
 * Utilisé par /api/execute pour garantir un état propre entre chaque exécution de requêtes quiz.
 *
 * @returns {Promise<void>}
 */
async function reloadDataCollections() {
  // Si une collection a été droppée, on réapplique la création / schema / données
  // pour s'assurer de disposer d'un état propre et cohérent.
  const colCount = await db.listCollections({ name: 'users' }).hasNext()
  if (!colCount) {
    await initCollections()
    return
  }

  for (const col of ['users','products','orders']) {
    const filePath = join(DATA_DIR, `${col}.json`)
    if (!existsSync(filePath)) continue

    const docs = JSON.parse(readFileSync(filePath, 'utf8'))
    const converted = docs.map(d => convertDoc(d))
    await db.collection(col).deleteMany({})
    await db.command({ collMod: col, validationAction: 'warn' })
    await db.collection(col).insertMany(converted)
    await db.command({ collMod: col, validationAction: 'error' })
  }
}

/**
 * POST /api/execute
 *
 * Exécute une requête MongoDB prédéfinie via runQuery.
 * - recharge systématiquement users/products/orders depuis /data (reloadDataCollections)
 * - exécute la requête fournie dans req.body.query
 *
 * @body {object} query - Requête de type { collection, operation, args?, options? }
 * @body {boolean} [query.reset] - (déprécié) force un reset explicite après reload initial.
 *
 * @returns {{ok: boolean, result?: any, error?: string}}
 */
app.post('/api/execute', async (req, res) => {
  const { query } = req.body
  try {
    await connect()
    // Réinitialise toujours l’état avant d’exécuter une requête
    // pour garantir un jeu de données propre pour chaque question.
    await reloadDataCollections()

    // Permettre de forcer un reset explicite aussi 
    if (query && query.reset) {
      await reloadDataCollections()
    }

    const result = await runQuery(query)
    res.json({ ok: true, result })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * @function convertQuery
 * @description Convertit récursivement les marqueurs { $date: "..." }
 * en vrais objets Date JavaScript dans les args des requêtes.
 * Nécessaire car le JSON ne supporte pas new Date().
 *
 * @param {any} obj - Valeur à convertir
 * @returns {any} - Valeur avec les dates converties
 */
function convertQuery(obj) {
  if (Array.isArray(obj)) return obj.map(convertQuery)
  if (obj && typeof obj === 'object') {
    if (obj.$date) return new Date(obj.$date)
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = convertQuery(v)
    }
    return out
  }
  return obj
}

/**
 * runQuery
 *
 * Applique des opérations Mongo sur une collection via la requête fournie.
 * Supporte find, findOne, aggregate, updateOne, deleteMany, countDocuments, createIndex.
 *
 * @param {object} query
 * @param {string} query.collection
 * @param {string} query.operation
 * @param {Array<any>} [query.args]
 * @param {object} [query.options]
 * @returns {Promise<any>} résultat de l'opération
 * @throws {Error} opération non supportée ou requête absente
 */
async function runQuery(query) {
  if (!query) throw new Error('Pas de requête à exécuter')

  const { collection, operation, options = {} } = query
  const args = convertQuery(query.args || [])  // ← convertit les { $date: "..." }
  const col = db.collection(collection)

  // find et findOne
  if (operation === 'find') {
    let cursor = col.find(args[0] || {}, { projection: args[1] || {} })
    if (options.sort)  cursor = cursor.sort(options.sort)
    if (options.skip)  cursor = cursor.skip(options.skip)
    if (options.limit) cursor = cursor.limit(options.limit)
    else               cursor = cursor.limit(5)       // limite par défaut
    return cursor.toArray()
  }

  if (operation === 'findOne') {
    return col.findOne(args[0] || {}, { projection: args[1] || {} })
  }

  // aggregate
  if (operation === 'aggregate') {
    return col.aggregate(args[0] || []).toArray()
  }

  // updateOne
  if (operation === 'updateOne') {
    const r = await col.updateOne(args[0], args[1], args[2] || {})
    // retourne le document modifié pour voir le résultat
    return col.findOne(args[0])
  }

  // updateMany
  if (operation === 'updateMany') {
    const r = await col.updateMany(args[0], args[1], args[2] || {})
    return { matchedCount: r.matchedCount, modifiedCount: r.modifiedCount }
  }

  // deleteMany
  if (operation === 'deleteMany') {
    const r = await col.deleteMany(args[0] || {})
    return { deletedCount: r.deletedCount }
  }

  // countDocuments
  if (operation === 'countDocuments') {
    const count = await col.countDocuments(args[0] || {})
    return { count }
  }

  // createIndex
  if (operation === 'createIndex') {
    const name = await col.createIndex(args[0], args[1] || {})
    return { indexName: name }
  }

  throw new Error(`Opération non supportée : ${operation}`)
}

/**
 * GET /api/lessons
 *
 * Retourne toutes les leçons de la collection `lessons`.
 * Projection _id:0 par sécurité pour simplifier la consommation front.
 *
 * @returns {object} { ok: true, lessons: Array }
 */
app.get('/api/lessons', async (req, res) => {
  try {
    await connect()
    const lessons = await db.collection('lessons')
      .find({}, { projection: { _id: 0 } })
      .toArray()
    res.json({ ok: true, lessons })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * GET /api/lessons/:id
 *
 * Retourne une leçon spécifique par identifiant de niveau.
 *
 * @param {string} req.params.id
 * @returns {object} { ok: true, lesson }
 */
app.get('/api/lessons/:id', async (req, res) => {
  try {
    await connect()
    const lesson = await db.collection('lessons').findOne(
      { id: req.params.id },
      { projection: { _id: 0 } }
    )
    if (!lesson) return res.status(404).json({ ok: false, error: 'Leçon introuvable' })
    res.json({ ok: true, lesson })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * @route POST /api/data/export/json
 * @description Exporte une collection MongoDB vers backup/<collection>.json.
 * Utile pour génération de sauvegarde/export avant téléchargement.
 * @body {string} collection - users/products/orders/lessons
 * @returns {{ok: boolean, count?: number, path?: string, error?: string}}
 */
app.post('/api/data/export/json', async (req, res) => {
  const { collection } = req.body
  const allowed = ['users', 'products', 'orders', 'lessons']

  if (!collection || !allowed.includes(collection)) {
    return res.status(400).json({ ok: false, error: `Collection invalide : ${collection}` })
  }

  try {
    await connect()
    const docs = await db.collection(collection).find({}).toArray()

    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })

    const outPath = join(BACKUP_DIR, `${collection}.json`)
    writeFileSync(outPath, JSON.stringify(docs, null, 2), 'utf8')

    res.json({ ok: true, count: docs.length, path: outPath })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/**
 * @route GET /api/data/download/:collection
 * @description Retourne le JSON de /data/<collection>.json (source prioritaire),
 * puis fallback sur MongoDB si le fichier n'existe pas.
 * @param {string} req.params.collection - users/products/orders/lessons
 * @returns {{ok: boolean, data?: Array<any>, error?: string}}
 */
app.get('/api/data/download/:collection', async (req, res) => {
  const collection = req.params.collection
  const allowed = ['users', 'products', 'orders', 'lessons']

  if (!allowed.includes(collection)) {
    return res.status(400).json({ ok: false, error: `Collection invalide : ${collection}` })
  }

  const filePath = join(DATA_DIR, `${collection}.json`)
  if (existsSync(filePath)) {
    try {
      const docs = JSON.parse(readFileSync(filePath, 'utf8'))
      return res.json({ ok: true, data: docs })
    } catch (e) {
      return res.status(500).json({ ok: false, error: `Lecture /data échouée : ${e.message}` })
    }
  }

  try {
    await connect()
    const docs = await db.collection(collection).find({}).toArray()
    res.json({ ok: true, data: docs })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.listen(PORT, () => {
  console.log(`✓ Mongolingo backend → http://localhost:${PORT}`)
})
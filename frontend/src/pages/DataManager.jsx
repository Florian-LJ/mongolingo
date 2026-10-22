import { useState, useEffect } from 'react'
import './DataManager.css'

/**
 * @component DataManager
 * @description Page de gestion des données MongoDB.
 * Permet de charger les données de démo, d'exporter en JSON,
 * de faire des sauvegardes BSON (mongodump/mongorestore) et de
 * réinitialiser la base. Affiche un terminal de log en temps réel.
 *
 * @param {Object}   props
 * @param {Function} props.goTo - Fonction de navigation fournie par App.jsx.
 *                                Signature : goTo(screenName: string, data?: any)
 */
export default function DataManager({ goTo }) {

  /**
   * @state log
   * @type {Array<string|{msg: string, type: 'ok'|'warn'|'err'}>}
   * @description Tableau de lignes affichées dans le terminal en bas de page.
   * Les premières lignes sont des strings simples (messages d'accueil).
   * Les lignes suivantes sont des objets { msg, type } pour coloriser selon le résultat.
   *
   * Couleurs :
   *   - 'ok'   → vert  (#a8ffca) — succès
   *   - 'warn' → jaune (#ffc929) — en cours ou avertissement
   *   - 'err'  → rouge (#ff8a8a) — erreur
   */
  const [log, setLog] = useState(['// Mongolingo Data Manager', '// En attente…'])

  /**
   * @state stats
   * @type {{ users: number, products: number, orders: number } | null}
   * @description Nombre de documents par collection.
   */
  const [stats, setStats] = useState(null)

  /**
   * @state connected
   * @type {boolean | null}
   * @description État de la connexion au backend/MongoDB.
   */
  const [connected, setConnected] = useState(null)

  /**
   * @effect vérification de connexion au montage
   * @description Ping le backend via GET /api/health dès que le composant
   */
  useEffect(() => {
    fetch('http://localhost:3001/api/health')
      .then(r => r.json())
      .then(d => {
        setConnected(d.ok)
        addLog(d.ok ? '✓ MongoDB connecté' : '✗ MongoDB hors ligne', d.ok ? 'ok' : 'err')
        if (d.ok) refreshStats()
      })
      .catch(() => {
        setConnected(false)
        addLog('✗ Backend non disponible', 'err')
      })
  }, [])

  /**
   * @function addLog
   * @description Ajoute une ligne colorisée dans le terminal.
   *
   * @param {string}              msg  - Texte à afficher
   * @param {'ok'|'warn'|'err'}  type - Couleur de la ligne (défaut: 'ok')
   */
  function addLog(msg, type = 'ok') {
    setLog(prev => [...prev, { msg, type }])
  }

  /**
   * @function refreshStats
   * @description Interroge GET /api/stats pour mettre à jour le compteur
   * de documents affiché à côté du statut de connexion.
   * Appelée automatiquement après chaque opération qui modifie la base
   * (load, restore, drop).
   *
   * @returns {Promise<void>}
   */
  async function refreshStats() {
    const data = await fetch('http://localhost:3001/api/stats').then(r => r.json())
    if (data.ok) setStats(data.stats)
  }

  /**
   * @function handleLoad
   * @description Charge les données de démo depuis les fichiers JSON
   * du dossier /data vers MongoDB via POST /api/data/load.
   * Le backend vide d'abord la collection (deleteMany) puis insère
   * les documents (insertMany) — idempotent, safe à relancer.
   *
   * @param {'all'|'users'|'products'|'orders'} collection
   * @returns {Promise<void>}
   *
   * @example
   * handleLoad('all')     // charge les 3 collections
   * handleLoad('users')   // charge uniquement users
   */
  async function handleLoad(collection) {
    addLog(`⬇ Chargement de '${collection}'…`, 'warn')
    const data = await fetch('http://localhost:3001/api/data/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection })
    }).then(r => r.json())

    // Vérifier que la requête a réussi avant d'accéder à report
    if (!data.ok) {
      addLog(`✗ Erreur : ${data.error}`, 'err')
      return
    }

    // data.report est un tableau de résultats par collection
    // ex: [{ collection: 'users', inserted: 15 }, { collection: 'products', inserted: 10 }]
    data.report.forEach(r =>
      addLog(r.error
        ? `✗ ${r.collection}: ${r.error}`
        : `✓ ${r.inserted} docs → ${r.collection}`, r.error ? 'err' : 'ok')
    )
    refreshStats()
  }

  /**
   * @function handleFileUpload
   * @description Lit un fichier JSON sélectionné par l'utilisateur, valide sa structure,
   * et envoie les documents vers le backend via POST /api/data/upload.
   * - le nom de fichier (users.json/products.json/orders.json/lessons.json)
   *   est utilisé pour déterminer la collection cible.
   * - le corps doit être un tableau OR { docs: [] } ou { data: [] }.
   * @param {Event} e - évènement onChange du champ <input type="file" />
   */
  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    addLog(`⬆ Lecture de ${file.name}…`, 'warn')

    let content
    try {
      content = await file.text()
    } catch (err) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted') || err?.message?.includes('aborted')) {
        addLog('⚠ Lecture annulée par le navigateur ; recharge le fichier et réessaie.', 'warn')
      } else {
        addLog(`✗ Impossible de lire le fichier : ${err?.message || err}`, 'err')
      }
      return
    }

    let docs
    try {
      docs = JSON.parse(content)
    } catch (err) {
      addLog(`✗ JSON invalide : ${err.message}`, 'err')
      return
    }

    const normalizedDocs = Array.isArray(docs) ? docs : docs.docs || docs.data || null
    if (!Array.isArray(normalizedDocs)) {
      addLog('✗ Le fichier doit être un tableau JSON ou contenir une propriété "docs"/"data".', 'err')
      return
    }

    const collection = file.name.toLowerCase().replace(/\.(json)$/i, '')
    const allowed = ['users', 'products', 'orders', 'lessons']
    if (!allowed.includes(collection)) {
      addLog(`✗ Nom de fichier non supporté : ${file.name}. Doit être users.json/products.json/orders.json/lessons.json`, 'err')
      return
    }

    try {
      const result = await fetch('http://localhost:3001/api/data/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, docs: normalizedDocs })
      }).then(r => r.json())

      if (!result.ok) {
        addLog(`✗ Upload échoué : ${result.error}`, 'err')
      } else {
        addLog(`✓ Fichier ${file.name} importé. ${result.inserted} docs → ${collection}`, 'ok')
        if (result.path) addLog(`🗄  Fichier écrit : ${result.path}`, 'ok')
        refreshStats()
      }
    } catch (err) {
      addLog(`✗ Erreur upload : ${err.message}`, 'err')
    }
  }

  /**
   * @function handleExport
   * @description Force l'export d'une collection MongoDB vers un fichier JSON
   * dans le dossier de backup (POST /api/data/export/json) et log le résultat.
   * @param {'users'|'products'|'orders'|'lessons'} collection
   * @returns {Promise<void>}
   */
  async function handleExport(collection) {
    addLog(`mongoexport → ${collection}.json…`, 'ok')
    const data = await fetch('http://localhost:3001/api/data/export/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection })
    }).then(r => r.json())
    addLog(data.ok
      ? `✓ ${data.count} docs → backup/${collection}.json`
      : `✗ ${data.error}`, data.ok ? 'ok' : 'err')
    }

    /**
     * @function handleDownload
     * @description Télécharge une collection en JSON via l'API ;
     * la procédure est :
     * 1) POST /api/data/export/json (pour garder un backup à jour)
     * 2) GET /api/data/download/:collection
     * 3) création d'un Blob + déclenchement du download browser
     * @param {'users'|'products'|'orders'|'lessons'} collection
    * @returns {Promise<void>}
    */
    async function handleDownload(collection) {
      fetch(`http://localhost:3001/api/data/download/${collection}`)
        .then(r => r.json())
        .then(data => {
          if (!data.ok) {
            addLog(`✗ Erreur téléchargement : ${data.error}`, 'err')
            return
          }

          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${collection}.json`
          a.click()
          URL.revokeObjectURL(url)
          addLog(`✓ ${collection}.json téléchargé`, 'ok')
        })
        .catch((err) => addLog(`✗ Erreur téléchargement : ${err.message || err}`, 'err'))
    }

  /**
   * @function handleDump
   * @description Lance une sauvegarde BSON complète de la base via
   * POST /api/data/dump. Le backend exécute mongodump en shell.
   * Les fichiers sont écrits dans /backup/bson/mongolingo/.
   *
   * @returns {Promise<void>}
   */
  async function handleDump() {
    addLog('mongodump --db mongolingo --out backup/bson/…', 'ok')
    const data = await fetch('http://localhost:3001/api/data/dump', { method: 'POST' }).then(r => r.json())
    addLog(data.ok ? '✓ Dump BSON terminé → backup/bson/' : `✗ ${data.error}`, data.ok ? 'ok' : 'err')
  }

  /**
   * @function handleRestore
   * @description Restaure la base depuis une sauvegarde BSON existante via
   * POST /api/data/restore. Le backend exécute mongorestore avec --drop
   * (supprime les collections avant de restaurer pour éviter les doublons).
   * Nécessite qu'un dump ait été fait au préalable.
   *
   * @returns {Promise<void>}
   */
  async function handleRestore() {
    addLog('mongorestore --db mongolingo backup/bson/ --drop…', 'warn')
    const data = await fetch('http://localhost:3001/api/data/restore', { method: 'POST' }).then(r => r.json())
    addLog(data.ok ? '✓ Restauration terminée' : `✗ ${data.error}`, data.ok ? 'ok' : 'err')
    refreshStats()
  }

  /**
   * @function handleDrop
   * @description Supprime toutes les collections MongoDB après confirmation
   * de l'utilisateur via window.confirm(). Remet les stats à null.
   *
   * @returns {Promise<void>}
   */
  async function handleDrop() {
    // window.confirm() bloque l'exécution et retourne true/false
    if (!window.confirm('Supprimer toutes les collections ?')) return
    addLog('⚠ Suppression en cours…', 'warn')
    const data = await fetch('http://localhost:3001/api/data/drop', { method: 'POST' }).then(r => r.json())
    data.dropped.forEach(col => addLog(`db.${col}.drop() → true`, 'warn'))
    addLog('✓ Base vidée', 'ok')
    setStats(null)
  }

  /**
   * Couleur du point de statut dérivée de l'état `connected`.
   * @type {string} - Valeur CSS hex
   */
  const statusColor = connected === null ? '#888' : connected ? '#3b9c52' : '#e83a3a'

  return (
    <div className="datamanager">
      <div className="topbar">
        <button className="btn-back-top" onClick={() => goTo('path')}>← Retour</button>
        <div className="topbar-title">Données</div>
        <div style={{ width: 80 }} />
      </div>

      <div className="dm-content">

        {/* Indicateur de statut + compteurs de documents */}
        <div className="dm-status">
          <span className="status-dot" style={{ background: statusColor }} />
          <span style={{ color: statusColor, fontSize: '0.82rem', fontWeight: 600 }}>
            {connected === null ? 'Vérification…' : connected ? 'MongoDB connecté' : 'Hors ligne'}
          </span>
          {/* stats est null tant que /api/stats n'a pas répondu — rendu conditionnel */}
          {stats && (
            <span className="dm-counts">
              users: {stats.users} · products: {stats.products} · orders: {stats.orders}
            </span>
          )}
        </div>

        <div className="dm-section">
          <h3>⬆ Déposer un fichier JSON</h3>
          <p>Sélectionne un fichier JSON pour l'importer dans la collection associée (users/products/orders/lessons).</p>
          <div className="dm-actions" style={{ display: 'flex', gap: '0.5rem' }}>
            <label className="btn-action" style={{ cursor: 'pointer' }}>
              Choisir un fichier
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        {/*
          Sections générées dynamiquement depuis un tableau de config.
          Chaque section a : un titre, une description, et un tableau d'actions.
          Chaque action a : un label affiché et une fonction fn() à appeler au clic.
          Cette approche évite de dupliquer la structure JSX pour chaque section.
        */}
        {[
          {
            titre: '📥 Charger les données de démo',
            desc: 'Importe les fichiers JSON de démonstration dans MongoDB, à partir du dossier /data.',
            actions: [
              { label: '⬇ Tout charger', fn: () => handleLoad('all') },
              { label: 'users',          fn: () => handleLoad('users') },
              { label: 'products',       fn: () => handleLoad('products') },
              { label: 'orders',         fn: () => handleLoad('orders') },
              { label: 'lessons',        fn: () => handleLoad('lessons') },
            ]
          },
          {
            titre: '📤 Export JSON',
            desc: 'Exporte une collection au format JSON dans /backup.',
            actions: [
              { label: 'users.json',    fn: () => handleExport('users') },
              { label: 'products.json', fn: () => handleExport('products') },
              { label: 'orders.json',   fn: () => handleExport('orders') },
              { label: 'lessons.json',  fn: () => handleExport('lessons') },
            ]
          },
          {
            titre: '⬇ Télécharger sur le PC',
            desc: 'Télécharge une collection en JSON directement dans ton navigateur.',
            actions: [
              { label: 'users.json',    fn: () => handleDownload('users') },
              { label: 'products.json', fn: () => handleDownload('products') },
              { label: 'orders.json',   fn: () => handleDownload('orders') },
              { label: 'lessons.json',  fn: () => handleDownload('lessons') },
            ]
          },
          {
            titre: '💽 BSON — mongodump / mongorestore',
            desc: 'Sauvegarde complète au format natif MongoDB.',
            actions: [
              { label: '🗜 mongodump',    fn: handleDump },
              { label: '♻ mongorestore', fn: handleRestore },
            ]
          },
          {
            titre: '🗑 Réinitialiser',
            desc: 'Supprime toutes les collections.',
            actions: [
              { label: '⚠ Drop all', fn: handleDrop, danger: true },
            ]
          },
        ].map(section => (
          <div key={section.titre} className="dm-section">
            <h3>{section.titre}</h3>
            <p>{section.desc}</p>
            <div className="dm-actions">
              {section.actions.map(a => (
                <button
                  key={a.label}
                  className={`btn-action ${a.danger ? 'danger' : ''}`}
                  onClick={a.fn}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/*
          Terminal de log.
          Chaque ligne peut être :
            - une string simple (messages initiaux) → classe 'muted' (vert foncé)
            - un objet { msg, type } → classe 'ok', 'warn' ou 'err'
        */}
        <div className="dm-log">
          {log.map((line, i) => (
            <div key={i} className={`log-line ${typeof line === 'string' ? 'muted' : line.type}`}>
              {typeof line === 'string' ? line : line.msg}
            </div>
          ))}
        </div>

      </div>

      {/* Barre de navigation partagée entre Path, Schema et DataManager */}
      <div className="navbar">
        <button className="nav-item" onClick={() => goTo('path')}>🗺 Parcours</button>
        <button className="nav-item" onClick={() => goTo('schema')}>📋 Collections</button>
        <button className="nav-item active">💾 Données</button>
      </div>
    </div>
  )
}

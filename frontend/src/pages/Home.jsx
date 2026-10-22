import { useState, useEffect } from 'react'
/**
 * frontend/src/pages/Home.jsx
 *
 * Page d'accueil du jeu
 * - affichage du score global
 * - navigation principale
 */
import './Home.css'

export default function Home({ goTo }) {
  const [connected, setConnected] = useState(null)

  useEffect(() => {
    fetch('http://localhost:3001/api/health')
      .then(r => r.json())
      .then(d => setConnected(d.ok))
      .catch(() => setConnected(false))
  }, [])

  return (
    <div className="home">
      <div className="home-content">

        {/* Logo */}
        <div className="home-logo">
          Mongo<span>lingo</span>
        </div>
        <div className="home-tagline">
          Maîtrise MongoDB — une requête à la fois
        </div>

        {/* Statut MongoDB */}
        <div className="home-status">
          <span className={`status-dot ${connected === null ? 'pending' : connected ? 'ok' : 'err'}`} />
          <span className="status-text">
            {connected === null && 'Connexion...'}
            {connected === true && 'MongoDB connecté'}
            {connected === false && 'MongoDB hors ligne — lance docker compose up'}
          </span>
        </div>

        {/* Boutons */}
        <button className="btn-primary" onClick={() => goTo('path')}>
          Commencer →
        </button>
        <button className="btn-secondary" onClick={() => goTo('schema')}>
          📋 Voir les collections
        </button>
        <button className="btn-secondary" onClick={() => goTo('data')}>
          💾 Gérer les données
        </button>

      </div>
    </div>
  )
}
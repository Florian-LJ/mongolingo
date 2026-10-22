/**
 * frontend/src/pages/Path.jsx
 *
 * Page du parcours MongoDB
 * - sélection des niveaux et leçons
 * - gestion du verrouillage/déblocage des niveaux
 */
import { useState, useEffect } from 'react'
import './Path.css'

const NIVEAUX = [
  { id: 'easy',   label: '🟢 Bases',        subtitle: 'find, filtres, projections' },
  { id: 'medium', label: '🟡 Intermédiaire', subtitle: 'update, sort, tableaux' },
  { id: 'hard',   label: '🟠 Avancé',        subtitle: 'agrégation, lookup' },
  { id: 'expert', label: '🔴 Expert',         subtitle: 'index, transactions, design' },
]

export default function Path({ goTo }) {
  const [lessons, setLessons]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [completed, setCompleted] = useState(() => {
    const saved = localStorage.getItem('mongolingo_completed')
    return saved ? JSON.parse(saved) : []
  })
  const [xp, setXp] = useState(() => {
    return parseInt(localStorage.getItem('mongolingo_xp') || '0')
  })

  // Charger les leçons depuis MongoDB au montage
  useEffect(() => {
    fetch('http://localhost:3001/api/lessons')
      .then(r => r.json())
      .then(d => {
        if (d.ok) setLessons(d.lessons)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  /**
   * Savoir si un niveau est débloqué
   * @param {*} niveau niveau à débloquer
   * @returns True si moitié des questions du niveau précédent réalisées
   */
  function isUnlocked(niveau) {
    const order = ['easy', 'medium', 'hard', 'expert']
    const idx = order.indexOf(niveau)
    if (idx === 0) return true // easy débloqué dès le début

    // Si on a perdu toute l'XP, on bloque les niveaux avancés
    if (xp === 0) return false // Permet de débloquer easy même en cas de perte totale d'XP

    const prevNiveau = order[idx - 1]
    const prevLessons = lessons.filter(l => l.niveau === prevNiveau) // récupère toutes les lessons du niveau précédent
    const donePrev = prevLessons.filter(l => completed.includes(l.id)).length // compte le nombre de lessons du niveau précédent complétées
    return donePrev >= Math.ceil(prevLessons.length / 2)
  }

  /**
   * Récupération des catégories du niveau
   * @param {*} niveau niveau pour lequel récupérer les catégories
   * @returns les catégories du niveau
   */
  function getLessonsForNiveau(niveau) {
    return lessons.filter(l => l.niveau === niveau)
  }

  function handleReset() {
    if (!window.confirm('Réinitialiser toute ta progression ? (XP, leçons complétées)')) return
    localStorage.removeItem('mongolingo_completed')
    localStorage.removeItem('mongolingo_xp')
    setCompleted([])
    setXp(0)
  }

  return (
    <div className="path">

      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-logo">Mongo<span>lingo</span></div>
        <div className="topbar-stats">
          <span className="stat">⚡ {xp} XP</span>
          <button className="btn-reset" onClick={handleReset} title="Réinitialiser la progression">↺</button>
          <button className="btn-home" onClick={() => goTo('home')}>⌂</button>
        </div>
      </div>

      {loading && (
        <div className="path-loading">
          Chargement des leçons…
        </div>
      )}

      {/* Contenu */}
      <div className="path-content">
        {NIVEAUX.map(niveau => (
          <div key={niveau.id} className="niveau-section">

            <div className="niveau-header">
              <span className="niveau-label">{niveau.label}</span>
              <span className="niveau-subtitle">{niveau.subtitle}</span>
            </div>

            <div className="lessons-grid">
              {getLessonsForNiveau(niveau.id).map(lesson => {
                const done    = completed.includes(lesson.id)
                const locked  = !isUnlocked(niveau.id)
                return (
                  <div
                    key={lesson.id}
                    className={`lesson-card ${done ? 'done' : ''} ${locked ? 'locked' : ''}`}
                    onClick={() => !locked && goTo('quiz', lesson)}
                  >
                    <div className="lesson-icon">{lesson.icon}</div>
                    <div className="lesson-titre">{lesson.titre}</div>
                    <div className="lesson-desc">{lesson.desc}</div>
                    <span className={`lesson-badge badge-${niveau.id}`}>
                      {niveau.id}
                    </span>
                    {done && <div className="lesson-check">✓</div>}
                    {locked && <div className="lesson-lock">🔒</div>}
                  </div>
                )
              })}
            </div>

          </div>
        ))}
      </div>

      {/* Navbar */}
      <div className="navbar">
        <button className="nav-item active">🗺 Parcours</button>
        <button className="nav-item" onClick={() => goTo('schema')}>📋 Collections</button>
        <button className="nav-item" onClick={() => goTo('data')}>💾 Données</button>
      </div>

    </div>
  )
}
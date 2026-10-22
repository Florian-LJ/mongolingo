/**
 * frontend/src/pages/Result.jsx
 *
 * Page de résultat du quiz
 * - affichage du score de la séance
 * - retour au parcours ou nouvelle tentative
 */
import './Result.css'

/**
 * Composant de la page de résultats du quiz.
 * Affiche le score, les statistiques et permet de naviguer vers d'autres pages.
 * @param {Function} goTo - Fonction pour naviguer vers un autre écran.
 * @param {Object} result - Résultat du quiz contenant les données à afficher.
 * @param {Object} result.lesson - La leçon jouée.
 * @param {number} result.xp - XP gagnés.
 * @param {number} result.correct - Nombre de réponses correctes.
 * @param {number} result.total - Nombre total de questions.
 * @param {number} result.accuracy - Pourcentage de précision.
 * @param {boolean} result.dejaComplete - Si la leçon était déjà complétée.
 * @returns {JSX.Element} La page de résultats rendue.
 */
export default function Result({ goTo, result }) {
  const { lesson, xp, correct, total, accuracy, dejaComplete} = result

  const emoji = accuracy === 100 ? '🏆'
    : accuracy >= 70 ? '🎉'
    : accuracy >= 40 ? '😅'
    : '💪'

  const message = accuracy === 100 ? 'Score parfait !'
    : accuracy >= 70 ? 'Bien joué !'
    : accuracy >= 40 ? 'Continue comme ça !'
    : 'Il faut s\'entraîner !'

  return (
    <div className="result">
      <div className="result-content">

        <div className="result-emoji">{emoji}</div>
        <div className="result-titre">{message}</div>

        {/* Message si déjà complété */}
        {dejaComplete && (
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginBottom: '0.5rem' }}>
            Leçon déjà complétée — pas d'XP gagné
          </div>
        )}

        <div className="result-subtitle">{lesson.titre} — {lesson.niveau}</div>

        {/* Stats */}
        <div className="result-stats">
          <div className="result-stat">
            <div className="stat-val xp">+{xp}</div>
            <div className="stat-label">XP gagnés</div>
          </div>
          <div className="result-stat">
            <div className="stat-val">{correct}/{total}</div>
            <div className="stat-label">Correctes</div>
          </div>
          <div className="result-stat">
            <div className="stat-val">{accuracy}%</div>
            <div className="stat-label">Précision</div>
          </div>
        </div>

        {/* Boutons */}
        <button className="btn-result-primary" onClick={() => goTo('path')}>
          Continuer →
        </button>
        <button className="btn-result-secondary" onClick={() => goTo('quiz', lesson)}>
          Recommencer
        </button>

      </div>
    </div>
  )
}
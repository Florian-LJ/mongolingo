/**
 * frontend/src/pages/Quiz.jsx
 *
 * Composant de quiz pour une leçon donnée
 * - choix de réponses et feedback
 * - exécution de requêtes MongoDB simulée
 * - calcul de la XP et des coeurs
 */
import { useState } from 'react'
import './Quiz.css'

const XP_PAR_NIVEAU = { easy: 10, medium: 20, hard: 35, expert: 50 }

export default function Quiz({ goTo, lesson }) {
  const [qIndex, setQIndex]       = useState(0)
  const [answered, setAnswered]   = useState(false)
  const [selected, setSelected]   = useState(null)
  const [execResult, setExecResult] = useState(null)
  const [execLoading, setExecLoading] = useState(false)
  const [sessionXP, setSessionXP] = useState(0)
  const [correct, setCorrect]     = useState(0)
  const [hearts, setHearts]       = useState(5)

  const questions = lesson.questions
  const question  = questions[qIndex]
  const total     = questions.length
  const progress  = (qIndex / total) * 100
  const letters   = ['A', 'B', 'C', 'D']

  /**
   * Validation de la réponse choisie
   * @param {*} idx Indice de la réponse choisie
   * @returns 
   */
  async function handleSelect(idx) {
    if (answered) return
    setAnswered(true)
    setSelected(idx)

    const isCorrect = question.options[idx].correct // Vérifie si c'est la bonne réponse

    // Gain ou perte
    if (isCorrect) {
      const gain = XP_PAR_NIVEAU[lesson.niveau]
      setSessionXP(prev => prev + gain)
      setCorrect(prev => prev + 1)
    } else {
      setHearts(prev => Math.max(0, prev - 1))
    }

    // Exécution réelle sur MongoDB
    if (question.query) {
      setExecLoading(true)
      try {
        const res = await fetch('http://localhost:3001/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: question.query })
        })
        const data = await res.json()
        if (data.ok) setExecResult(JSON.stringify(data.result, null, 2))
        else setExecResult('// Erreur : ' + data.error)
      } catch {
        setExecResult('// Backend non disponible')
      } finally {
        setExecLoading(false)
      }
    }
  }

  /**
   * Gestion de l'enchainement des questions
   */
  function handleContinue() {
    if (qIndex + 1 >= total || hearts === 0) {
      const shouldClearXP = hearts === 0

      // Calculer dejaComplete AVANT de modifier le localStorage
      const completedBefore = JSON.parse(localStorage.getItem('mongolingo_completed') || '[]')
      const dejaComplete = completedBefore.includes(lesson.id)

      if (shouldClearXP) {
        setSessionXP(0)
      } else {
        if (!dejaComplete) {
          completedBefore.push(lesson.id)
          localStorage.setItem('mongolingo_completed', JSON.stringify(completedBefore))
        }
      }

      const currentXP = parseInt(localStorage.getItem('mongolingo_xp') || '0')
      if (shouldClearXP) {
        localStorage.clear()
      } else if (!dejaComplete) { // N'ajoute l'XP que si la leçon n'était pas déjà complétée
        localStorage.setItem('mongolingo_xp', currentXP + sessionXP)
      }

      goTo('result', {
        lesson,
        xp: shouldClearXP || dejaComplete ? 0 : sessionXP,
        correct,
        total,
        accuracy: Math.round((correct / total) * 100),
        dejaComplete
      })
    } else {
      setQIndex(prev => prev + 1)
      setAnswered(false)
      setSelected(null)
      setExecResult(null)
    }
  }

  return (
    <div className="quiz">

      {/* Header */}
      <div className="quiz-header">
        <button className="btn-back" onClick={() => goTo('path')}>✕</button>
        <div className="progress-wrap">
          <div className="progress-fill" style={{ width: progress + '%' }} />
        </div>
        <div className="quiz-hearts">
          {[...Array(5)].map((_, i) => (
            <span key={i} className={`heart ${i >= hearts ? 'lost' : ''}`}>❤</span> // Met le coeur en transparant si son id est supérieur au nombre de vie restante
          ))}
        </div>
        <div className="quiz-xp">+{sessionXP} XP</div>
      </div>

      {/* Corps */}
      <div className="quiz-body">

        <div className="q-number">
          Question {qIndex + 1} / {total} — {lesson.titre}
        </div>

        <div className="q-enonce">{question.enonce}</div>

        {/* Options */}
        <div className="options">
          {question.options.map((opt, i) => {
            let cls = 'option'
            if (answered) {
              if (opt.correct)                cls += ' correct'
              else if (i === selected)        cls += ' wrong'
            } else if (i === selected) {
              cls += ' selected'
            }
            return (
              <button
                key={i}
                className={cls}
                disabled={answered}
                onClick={() => handleSelect(i)}
              >
                <span className="option-letter">{letters[i]}</span>
                <code className="option-code">{opt.code}</code>
              </button>
            )
          })}
        </div>

        {/* Feedback */}
        {answered && (
          <div className={`feedback ${question.options[selected].correct ? 'feedback-correct' : 'feedback-wrong'}`}>
            <div className="feedback-titre">
              {question.options[selected].correct ? '✓ Correct !' : '✗ Pas tout à fait…'}
            </div>
            <div className="feedback-explication">{question.explication}</div>

            {/* Résultat MongoDB */}
            {question.query && (
              <div className="exec-result">
                <div className="exec-label">
                  {execLoading ? 'Exécution en cours…' : '↳ Résultat MongoDB réel'}
                </div>
                <pre className="exec-code">
                  {execLoading
                    ? '...'
                    : execResult
                      ? execResult.slice(0, 500) + (execResult.length > 500 ? '\n...' : '')
                      : '// Pas de résultat'}
                </pre>
              </div>
            )}

            <button
              className={`btn-continue ${question.options[selected].correct ? 'btn-correct' : 'btn-wrong'}`}
              onClick={handleContinue}
            >
              {qIndex + 1 < total ? 'Continuer →' : 'Terminer la leçon →'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
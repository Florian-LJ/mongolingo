import { useState } from 'react'
import Home from './pages/Home'
import Path from './pages/Path'
import Quiz from './pages/Quiz'
import Result from './pages/Result'
import Schema from './pages/Schema'
import DataManager from './pages/DataManager'

/**
 * Composant principal de l'application qui gère la navigation entre les écrans et l'état global.
 * @returns {JSX.Element} L'application rendue.
 */
export default function App() {
  /** @type {string} Écran actuellement affiché */
  const [screen, setScreen] = useState('home')
  /** @type {Object|null} Leçon actuellement sélectionnée pour le quiz */
  const [currentLesson, setCurrentLesson] = useState(null)
  /** @type {Object|null} Dernier résultat du quiz */
  const [lastResult, setLastResult] = useState(null)

  /**
   * Navigue vers un nouvel écran et définit optionnellement des données.
   * @param {string} screenName - Le nom de l'écran vers lequel naviguer.
   * @param {Object|null} data - Données optionnelles à passer à l'écran.
   */
  function goTo(screenName, data = null) {
    if (screenName === 'quiz' && data) setCurrentLesson(data)
    if (screenName === 'result' && data) setLastResult(data)
    setScreen(screenName)
  }

  return (
    <div>
      {screen === 'home'    && <Home       goTo={goTo} />}
      {screen === 'path'    && <Path       goTo={goTo} />}
      {screen === 'quiz'    && <Quiz       goTo={goTo} lesson={currentLesson} />}
      {screen === 'result'  && <Result     goTo={goTo} result={lastResult} />}
      {screen === 'schema'  && <Schema     goTo={goTo} />}
      {screen === 'data'    && <DataManager goTo={goTo} />}
    </div>
  )
}
import { BlocksPage } from './pages/BlocksPage'
import { HomePage } from './pages/HomePage'

function App() {
  return window.location.pathname === '/blocks' ? <BlocksPage /> : <HomePage />
}

export default App

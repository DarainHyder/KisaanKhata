import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { I18nProvider } from './i18n/I18nProvider'
import FarmerLogin from './pages/FarmerLogin'
import Dashboard from './pages/Dashboard'
import VoiceEntry from './pages/VoiceEntry'
import EntryHistory from './pages/EntryHistory'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

export default function App() {
  const [farmer, setFarmer] = useState(() => {
    try {
      const saved = localStorage.getItem('kk_farmer')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  function handleLogin(farmerData) {
    localStorage.setItem('kk_farmer', JSON.stringify(farmerData))
    setFarmer(farmerData)
    window.scrollTo(0, 0)
  }

  function handleLogout() {
    localStorage.removeItem('kk_farmer')
    setFarmer(null)
  }

  return (
    <I18nProvider>
      <BrowserRouter>
        <Navbar farmer={farmer} onLogout={handleLogout} />
        {farmer ? (
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard farmer={farmer} />} />
              <Route path="/voice" element={<VoiceEntry farmer={farmer} />} />
              <Route path="/history" element={<EntryHistory farmer={farmer} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        ) : (
          <>
            <main>
              <FarmerLogin onLogin={handleLogin} />
            </main>
            <Footer />
          </>
        )}
      </BrowserRouter>
    </I18nProvider>
  )
}

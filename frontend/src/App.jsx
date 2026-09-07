import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { I18nProvider } from './i18n/I18nProvider'
import FarmerLogin from './pages/FarmerLogin'
import Dashboard from './pages/Dashboard'
import VoiceEntry from './pages/VoiceEntry'
import EntryHistory from './pages/EntryHistory'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import './index.css'

export default function App() {
  const [farmer, setFarmer] = useState(() => {
    const saved = localStorage.getItem('kk_farmer')
    return saved ? JSON.parse(saved) : null
  })

  function handleLogin(farmerData) {
    localStorage.setItem('kk_farmer', JSON.stringify(farmerData))
    setFarmer(farmerData)
  }

  function handleLogout() {
    localStorage.removeItem('kk_farmer')
    setFarmer(null)
  }

  if (!farmer) {
    return (
      <I18nProvider>
        <BrowserRouter>
          <Navbar farmer={null} onLogout={handleLogout} />
          <main>
            <FarmerLogin onLogin={handleLogin} />
          </main>
          <Footer />
        </BrowserRouter>
      </I18nProvider>
    )
  }

  return (
    <I18nProvider>
      <BrowserRouter>
        <Navbar farmer={farmer} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard farmer={farmer} />} />
            <Route path="/voice" element={<VoiceEntry farmer={farmer} />} />
            <Route path="/history" element={<EntryHistory farmer={farmer} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </BrowserRouter>
    </I18nProvider>
  )
}

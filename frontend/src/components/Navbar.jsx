import { useState, useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Wheat, Menu, X, LayoutDashboard, Mic, History, LogOut } from 'lucide-react'

export default function Navbar({ farmer, onLogout }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    function handleScroll() {
      if (window.scrollY > 20) {
        setScrolled(true)
      } else {
        setScrolled(false)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      {/* Top Persistent Bar */}
      <nav className={`navbar${scrolled || farmer ? ' scrolled' : ''}`}>
        <Link to="/" className="navbar-brand">
          <Wheat size={24} color="var(--accent-gold)" />
          <span>KisaanKhata</span>
        </Link>

        {/* Desktop Links & CTA */}
        {farmer ? (
          <div className="navbar-links">
            <div style={{ fontSize: '0.88rem', color: 'rgba(237, 234, 224, 0.85)', fontWeight: 500 }}>
              Farmer: <strong style={{ color: 'var(--accent-gold)' }}>{farmer.name}</strong>
            </div>
            <button className="btn-logout" onClick={onLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <div className="navbar-links">
            <a href="#hero" className="nav-link">Home</a>
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#contact" className="nav-link">Contact</a>
            <a href="#khata-form" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.88rem', width: 'auto' }}>
              Access Ledger
            </a>
          </div>
        )}

        {/* Mobile Hamburger Button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open Navigation Menu"
        >
          <Menu size={26} />
        </button>
      </nav>

      {/* Mobile Slide-In Panel Overlay */}
      <div
        className={`mobile-menu-overlay${mobileMenuOpen ? ' open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Slide-In Panel */}
      <aside className={`mobile-menu-panel${mobileMenuOpen ? ' open' : ''}`}>
        <div className="mobile-menu-header">
          <div className="navbar-brand" style={{ color: 'var(--text)' }}>
            <Wheat size={22} color="var(--accent-gold)" />
            <span>KisaanKhata</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Navigation Menu"
            style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 4 }}
          >
            <X size={24} />
          </button>
        </div>

        <div className="mobile-menu-links">
          {farmer ? (
            <>
              <div style={{ fontSize: '0.9rem', color: 'var(--soil-brown)', paddingBottom: 12, borderBottom: 'var(--ledger-line)' }}>
                LoggedIn as <strong>{farmer.name}</strong> ({farmer.location})
              </div>
              <NavLink to="/" end className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                Dashboard
              </NavLink>
              <NavLink to="/voice" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                Add Voice Entry
              </NavLink>
              <NavLink to="/history" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                Ledger History
              </NavLink>
              <button
                className="btn btn-outline"
                style={{ marginTop: 20 }}
                onClick={() => { onLogout(); setMobileMenuOpen(false); }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <a href="#hero" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>Home</a>
              <a href="#how-it-works" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
              <a href="#features" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#contact" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>Contact Us</a>
              <a
                href="#khata-form"
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Access Ledger
              </a>
            </>
          )}
        </div>
      </aside>

      {/* Bottom tab navigation for App Screens when logged in */}
      {farmer && (
        <nav className="tab-nav">
          <NavLink to="/" end className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/voice" className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}>
            <Mic size={20} />
            <span>Add Entry</span>
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}>
            <History size={20} />
            <span>History</span>
          </NavLink>
        </nav>
      )}
    </>
  )
}

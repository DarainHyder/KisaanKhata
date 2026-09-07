import { useState, useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Wheat, Menu, X, LayoutDashboard, Mic, History, LogOut } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'
import LanguageSwitcher from './LanguageSwitcher'

export default function Navbar({ farmer, onLogout }) {
  const { t } = useI18n()
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
          <span>{t('brand')}</span>
        </Link>

        {/* Desktop Links & CTA */}
        {farmer ? (
          <div className="navbar-links">
            <LanguageSwitcher />
            <div style={{ fontSize: '0.88rem', color: 'rgba(237, 234, 224, 0.85)', fontWeight: 500 }}>
              {t('nav.farmer')}: <strong style={{ color: 'var(--accent-gold)' }}>{farmer.name}</strong>
            </div>
            <button className="btn-logout" onClick={onLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <LogOut size={16} />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        ) : (
          <div className="navbar-links">
            <a href="#hero" className="nav-link">{t('nav.home')}</a>
            <a href="#how-it-works" className="nav-link">{t('nav.howItWorks')}</a>
            <a href="#features" className="nav-link">{t('nav.features')}</a>
            <a href="#contact" className="nav-link">{t('nav.contact')}</a>
            <LanguageSwitcher />
            <a href="#khata-form" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.88rem', width: 'auto' }}>
              {t('nav.accessLedger')}
            </a>
          </div>
        )}

        {/* Mobile Hamburger Button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(true)}
          aria-label={t('nav.openMenu')}
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
            <span>{t('brand')}</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            aria-label={t('nav.closeMenu')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 4 }}
          >
            <X size={24} />
          </button>
        </div>

        <div className="mobile-menu-links">
          <LanguageSwitcher variant="compact" />
          {farmer ? (
            <>
              <div style={{ fontSize: '0.9rem', color: 'var(--soil-brown)', paddingBottom: 12, borderBottom: 'var(--ledger-line)' }}>
                {t('nav.loggedInAs')} <strong>{farmer.name}</strong> ({farmer.location})
              </div>
              <NavLink to="/" end className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                {t('nav.dashboard')}
              </NavLink>
              <NavLink to="/voice" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                {t('nav.addVoiceEntry')}
              </NavLink>
              <NavLink to="/history" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                {t('nav.ledgerHistory')}
              </NavLink>
              <button
                className="btn btn-outline"
                style={{ marginTop: 20 }}
                onClick={() => { onLogout(); setMobileMenuOpen(false); }}
              >
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <a href="#hero" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>{t('nav.home')}</a>
              <a href="#how-it-works" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>{t('nav.howItWorks')}</a>
              <a href="#features" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>{t('nav.features')}</a>
              <a href="#contact" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>{t('nav.contact')}</a>
              <a
                href="#khata-form"
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.accessLedger')}
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
            <span>{t('nav.dashboard')}</span>
          </NavLink>
          <NavLink to="/voice" className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}>
            <Mic size={20} />
            <span>{t('nav.addVoiceEntry')}</span>
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}>
            <History size={20} />
            <span>{t('nav.ledgerHistory')}</span>
          </NavLink>
        </nav>
      )}
    </>
  )
}

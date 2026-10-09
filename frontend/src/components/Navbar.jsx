import { useState, useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Wheat, Menu, X, LayoutDashboard, Mic, History, LogOut } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'
import LanguageSwitcher from './LanguageSwitcher'

const SECTIONS = [
  ['hero', 'nav.home'],
  ['features', 'nav.features'],
  ['how-it-works', 'nav.howItWorks'],
  ['price-check', 'nav.priceCheck'],
  ['contact', 'nav.contact'],
]

export default function Navbar({ farmer, onLogout }) {
  const { t } = useI18n()
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [active, setActive] = useState('hero')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Highlight the landing section currently in view.
  useEffect(() => {
    if (farmer) return
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id) })
    }, { rootMargin: '-45% 0px -50% 0px' })
    // Sections without a nav link still need observing so the highlight clears over them.
    ;[...SECTIONS.map(([id]) => id), 'integrity', 'khata-form'].forEach(id => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [farmer])

  const close = () => setMobileMenuOpen(false)
  const appLinks = [
    ['/', 'nav.dashboard', LayoutDashboard],
    ['/voice', 'nav.addVoiceEntry', Mic],
    ['/history', 'nav.ledgerHistory', History],
  ]

  return (
    <>
      <nav className={`navbar${scrolled || farmer ? ' scrolled' : ''}`}>
        <Link to="/" className="navbar-brand">
          <span className="brand-mark"><Wheat size={19} /></span>
          <span>KisaanKhata</span>
          <span className="brand-ur" lang="ur">کسان کھاتہ</span>
        </Link>

        {farmer ? (
          <div className="navbar-links">
            <div className="app-links">
              {appLinks.map(([to, key, Icon]) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `app-link${isActive ? ' active' : ''}`}>
                  <Icon size={16} /><span>{t(key)}</span>
                </NavLink>
              ))}
            </div>
            <LanguageSwitcher />
            <div className="nav-farmer">{t('nav.farmer')}: <strong>{farmer.name}</strong></div>
            <button className="btn-logout" onClick={onLogout}>
              <LogOut size={15} /><span>{t('nav.logout')}</span>
            </button>
          </div>
        ) : (
          <div className="navbar-links">
            {SECTIONS.map(([id, key]) => (
              <a key={id} href={`#${id}`} className={`nav-link${active === id ? ' active' : ''}`}>{t(key)}</a>
            ))}
            <LanguageSwitcher />
            <a href="#khata-form" className="btn btn-primary btn-inline" style={{ padding: '9px 18px', fontSize: '0.88rem' }}>
              {t('nav.accessLedger')}
            </a>
          </div>
        )}

        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)} aria-label={t('nav.openMenu')}>
          <Menu size={22} />
        </button>
      </nav>

      <div className={`mobile-menu-overlay${mobileMenuOpen ? ' open' : ''}`} onClick={close} />

      <aside className={`mobile-menu-panel${mobileMenuOpen ? ' open' : ''}`} aria-hidden={!mobileMenuOpen}>
        <div className="mobile-menu-header">
          <div className="navbar-brand">
            <span className="brand-mark"><Wheat size={19} /></span>
            <span>{t('brand')}</span>
          </div>
          <button className="icon-btn" onClick={close} aria-label={t('nav.closeMenu')}><X size={24} /></button>
        </div>

        <div className="mobile-menu-links">
          <LanguageSwitcher variant="compact" />
          {farmer ? (
            <>
              <div className="mobile-farmer">{t('nav.loggedInAs')} <strong>{farmer.name}</strong>{farmer.location ? ` (${farmer.location})` : ''}</div>
              {appLinks.map(([to, key]) => (
                <NavLink key={to} to={to} end={to === '/'} className="mobile-nav-link" onClick={close}>{t(key)}</NavLink>
              ))}
              <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={() => { onLogout(); close() }}>
                <LogOut size={16} />{t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              {SECTIONS.map(([id, key]) => (
                <a key={id} href={`#${id}`} className="mobile-nav-link" onClick={close}>{t(key)}</a>
              ))}
              <a href="#khata-form" className="btn btn-primary" style={{ marginTop: 16 }} onClick={close}>{t('nav.accessLedger')}</a>
            </>
          )}
        </div>
      </aside>

      {farmer && (
        <nav className="tab-nav" aria-label={t('nav.dashboard')}>
          {appLinks.map(([to, , Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}>
              <Icon size={18} /><span>{t(`nav.short.${to === '/' ? 'home' : to.slice(1)}`)}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </>
  )
}

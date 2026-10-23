import { useState, useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Wheat, Menu, X, LayoutDashboard, Mic, History, LogOut } from 'lucide-react'
import { rootApi } from '../api'
import { useI18n } from '../i18n/useI18n'
import { scrollToSection, lockScroll } from '../hooks/smoothScroll'
import LanguageSwitcher from './LanguageSwitcher'
import { CHAPTERS } from './landing/chapters'

export default function Navbar({ farmer, onLogout }) {
  const { t } = useI18n()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [preview, setPreview] = useState(0)
  const [liveRows, setLiveRows] = useState(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // How many live mandi rates the API holds right now.
  useEffect(() => {
    if (farmer) return
    let alive = true
    rootApi.get('/admin/scrape-status', { timeout: 25000 })
      .then(r => {
        // Older API builds only report the cumulative total across scrapes.
        const n = r.data.current_price_rows ?? r.data.live_price_rows
        if (alive && n > 0) setLiveRows(n)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [farmer])

  useEffect(() => {
    lockScroll(menuOpen)
    if (!menuOpen) return
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const close = () => setMenuOpen(false)
  const go = id => e => {
    e.preventDefault()
    close()
    // Let the menu start closing before the page glides.
    setTimeout(() => scrollToSection(id), menuOpen ? 120 : 0)
  }

  const appLinks = [
    ['/', 'nav.dashboard', LayoutDashboard],
    ['/voice', 'nav.addVoiceEntry', Mic],
    ['/history', 'nav.ledgerHistory', History],
  ]

  return (
    <>
      <nav className={`navbar${scrolled || farmer ? ' solid' : ' on-photo'}${menuOpen ? ' menu-open' : ''}`}>
        <Link to="/" className="navbar-brand" onClick={e => { if (!farmer) { e.preventDefault(); close(); scrollToSection('hero', { offset: 0 }) } }}>
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
          <div className="navbar-links landing-links">
            {liveRows && (
              <a href="#price-check" className="live-badge" onClick={go('price-check')}>
                <i className="live-dot" />
                <span>{t('v4.nav.live', { n: liveRows.toLocaleString('en-US') })}</span>
              </a>
            )}
            <LanguageSwitcher />
            <a href="#khata-form" className="btn btn-primary btn-inline nav-cta" onClick={go('khata-form')}>
              {t('nav.accessLedger')}
            </a>
          </div>
        )}

        <button className={`menu-btn${farmer ? ' app-only' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}>
          <span className="menu-word">{menuOpen ? t('v4.nav.close') : t('v4.nav.menu')}</span>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {farmer ? (
        <>
          <div className={`mobile-menu-overlay${menuOpen ? ' open' : ''}`} onClick={close} />
          <aside className={`mobile-menu-panel${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
            <div className="mobile-menu-header">
              <div className="navbar-brand">
                <span className="brand-mark"><Wheat size={19} /></span>
                <span>{t('brand')}</span>
              </div>
              <button className="icon-btn" onClick={close} aria-label={t('nav.closeMenu')}><X size={24} /></button>
            </div>
            <div className="mobile-menu-links">
              <LanguageSwitcher variant="compact" />
              <div className="mobile-farmer">{t('nav.loggedInAs')} <strong>{farmer.name}</strong>{farmer.location ? ` (${farmer.location})` : ''}</div>
              {appLinks.map(([to, key]) => (
                <NavLink key={to} to={to} end={to === '/'} className="mobile-nav-link" onClick={close}>{t(key)}</NavLink>
              ))}
              <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={() => { onLogout(); close() }}>
                <LogOut size={16} />{t('nav.logout')}
              </button>
            </div>
          </aside>
          <nav className="tab-nav" aria-label={t('nav.dashboard')}>
            {appLinks.map(([to, , Icon]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}>
                <Icon size={18} /><span>{t(`nav.short.${to === '/' ? 'home' : to.slice(1)}`)}</span>
              </NavLink>
            ))}
          </nav>
        </>
      ) : (
        <div className={`fullmenu t-dark${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen} inert={!menuOpen}>
          <div className="fm-photos" aria-hidden="true">
            {CHAPTERS.map(([id, , src], i) => (
              <img key={id} src={src} alt="" loading="lazy" className={i === preview ? 'on' : ''} />
            ))}
          </div>
          <div className="fm-inner">
            <ol className="fm-list">
              {CHAPTERS.map(([id, key], i) => (
                <li key={id} style={{ '--i': i }}>
                  <a href={`#${id}`} onClick={go(id)} onMouseEnter={() => setPreview(i)} onFocus={() => setPreview(i)}>
                    <b>{String(i + 1).padStart(2, '0')}</b>
                    <span>{t(key)}</span>
                  </a>
                </li>
              ))}
            </ol>
            <div className="fm-side">
              <p className="fm-slogan" lang="ur" dir="rtl">{t('hero.slogan')}</p>
              <LanguageSwitcher variant="compact" />
              <a href="#contact" className="link-under" onClick={go('contact')}>{t('nav.contact')}</a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

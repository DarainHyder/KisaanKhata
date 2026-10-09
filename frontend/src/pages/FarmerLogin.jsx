import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import api from '../api'
import { useI18n } from '../i18n/useI18n'
import { useReveal, prefersReducedMotion } from '../hooks/motion'
import Hero from '../components/landing/Hero'
import LiveStats from '../components/landing/LiveStats'
import KhataBurst from '../components/landing/KhataBurst'
import HowItWorks from '../components/landing/HowItWorks'
import FairPriceChecker from '../components/landing/FairPriceChecker'
import HashChain from '../components/landing/HashChain'
import {
  Phone, MapPin, User, CheckCircle2, Send, HelpCircle, ShieldCheck, MessageSquareText, Hash,
} from 'lucide-react'

export default function FarmerLogin({ onLogin }) {
  const { t, lang } = useI18n()
  const pageRef = useRef(null)
  const formRef = useRef(null)
  const [mode, setMode] = useState('login') // 'login' | 'find'
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [directId, setDirectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [contactName, setContactName] = useState('')
  const [contactContact, setContactContact] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [contactSuccess, setContactSuccess] = useState('')
  const [contactError, setContactError] = useState('')
  const [contactSubmitting, setContactSubmitting] = useState(false)

  useReveal(pageRef, [lang])

  // Inertial smooth scrolling for the landing page only.
  useEffect(() => {
    if (prefersReducedMotion()) return
    const lenis = new Lenis({ autoRaf: true, anchors: { offset: -68 }, lerp: 0.1 })
    return () => lenis.destroy()
  }, [])

  function scrollToForm(e) {
    e.preventDefault()
    formRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!phone.trim()) return setError(t('login.errors.phoneRequired'))
    setLoading(true)
    try {
      const res = await api.post('/ledger/farmers', {
        name: name || 'Unknown',
        phone_number: phone.trim(),
        location: location || 'Unknown',
      })
      onLogin(res.data)
    } catch (err) {
      if (err.response?.status === 409) {
        setError(t('login.errors.phoneRegistered'))
        setMode('find')
      } else {
        setError(err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || t('login.errors.somethingWrong'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleFind(e) {
    e.preventDefault()
    setError('')
    if (!phone.trim()) return setError(t('login.errors.phoneRequired'))
    setLoading(true)
    try {
      const res = await api.get('/ledger/farmers/by-phone', { params: { phone: phone.trim() } })
      onLogin(res.data)
    } catch (err) {
      setError(err.response?.status === 404 ? t('login.errors.farmerNotFound') : t('login.errors.somethingWrong'))
    } finally {
      setLoading(false)
    }
  }

  async function handleDirectId() {
    setError('')
    const id = parseInt(directId, 10)
    if (!(id > 0)) return setError(t('login.errors.invalidId'))
    setLoading(true)
    try {
      const res = await api.get(`/ledger/farmers/${id}`)
      onLogin(res.data)
    } catch {
      setError(t('login.errors.farmerNotFound'))
    } finally {
      setLoading(false)
    }
  }

  function handleContactSubmit(e) {
    e.preventDefault()
    setContactError('')
    setContactSuccess('')
    if (!contactName.trim()) return setContactError(t('login.errors.nameRequired'))
    if (!contactContact.trim()) return setContactError(t('login.errors.contactRequired'))
    if (!contactMessage.trim()) return setContactError(t('login.errors.messageRequired'))
    setContactSubmitting(true)
    setTimeout(() => {
      setContactSubmitting(false)
      setContactSuccess(t('contact.success'))
      setContactName('')
      setContactContact('')
      setContactMessage('')
    }, 600)
  }

  const switchMode = m => { setMode(m); setError('') }

  return (
    <div ref={pageRef}>
      <Hero onCta={scrollToForm} />
      <LiveStats />
      <KhataBurst />
      <HowItWorks />
      <FairPriceChecker />
      <HashChain />

      {/* ---------- Open your khata ---------- */}
      <section id="khata-form" ref={formRef} className="section">
        <div className="container access">
          <div className="access-copy reveal">
            <span className="eyebrow">{t('access.eyebrow')}</span>
            <h2 className="section-title">{t('login.title')}</h2>
            <p className="section-lead">{t('login.subtitle')}</p>
            <ul className="access-points">
              <li><CheckCircle2 size={18} /><span>{t('access.p1')}</span></li>
              <li><CheckCircle2 size={18} /><span>{t('access.p2')}</span></li>
              <li><CheckCircle2 size={18} /><span>{t('access.p3')}</span></li>
            </ul>
          </div>

          <div className="card access-card reveal reveal-d1">
            <div className="segmented" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
                {t('login.newAccount')}
              </button>
              <button type="button" role="tab" aria-selected={mode === 'find'} className={mode === 'find' ? 'active' : ''} onClick={() => switchMode('find')}>
                {t('login.findAccount')}
              </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {mode === 'login' ? (
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label htmlFor="phone"><Phone size={14} />{t('login.phoneLabel')}</label>
                  <input id="phone" type="tel" inputMode="tel" placeholder={t('login.phonePlaceholder')} value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="name"><User size={14} />{t('login.nameLabel')}</label>
                  <input id="name" type="text" placeholder={t('login.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} required minLength={2} />
                </div>
                <div className="form-group">
                  <label htmlFor="location"><MapPin size={14} />{t('login.locationLabel')}</label>
                  <input id="location" type="text" placeholder={t('login.locationPlaceholder')} value={location} onChange={e => setLocation(e.target.value)} required />
                </div>
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? t('login.registering') : t('login.openLedger')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleFind}>
                <div className="form-group">
                  <label htmlFor="find-phone"><Phone size={14} />{t('login.phoneLabel')}</label>
                  <input id="find-phone" type="tel" inputMode="tel" placeholder={t('login.phonePlaceholder')} value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? t('login.searching') : t('login.findMyKhata')}
                </button>

                <hr className="divider" />
                <p className="helper">{t('login.directId')}</p>
                <div className="id-row">
                  <input type="number" inputMode="numeric" min={1} placeholder={t('login.farmerIdPlaceholder')} value={directId} onChange={e => setDirectId(e.target.value)} aria-label={t('login.farmerIdPlaceholder')} />
                  <button type="button" className="btn btn-secondary" onClick={handleDirectId} disabled={loading}>
                    <Hash size={16} />{t('login.enter')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Contact ---------- */}
      <section id="contact" className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow">{t('nav.contact')}</span>
            <h2 className="section-title">{t('contact.title')}</h2>
            <p className="section-lead">{t('contact.subtitle')}</p>
          </div>

          <div className="contact-grid">
            <div className="card reveal" style={{ marginBottom: 0 }}>
              {contactSuccess && <div className="alert alert-success"><CheckCircle2 size={18} /><span>{contactSuccess}</span></div>}
              {contactError && <div className="alert alert-error">{contactError}</div>}
              <form onSubmit={handleContactSubmit}>
                <div className="form-group">
                  <label htmlFor="c-name">{t('contact.nameLabel')}</label>
                  <input id="c-name" type="text" placeholder={t('contact.namePlaceholder')} value={contactName} onChange={e => setContactName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="c-contact">{t('contact.contactLabel')}</label>
                  <input id="c-contact" type="text" placeholder={t('contact.contactPlaceholder')} value={contactContact} onChange={e => setContactContact(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="c-msg">{t('contact.messageLabel')}</label>
                  <textarea id="c-msg" rows={4} placeholder={t('contact.messagePlaceholder')} value={contactMessage} onChange={e => setContactMessage(e.target.value)} required />
                </div>
                <button className="btn btn-primary" type="submit" disabled={contactSubmitting}>
                  <Send size={16} />
                  <span>{contactSubmitting ? t('contact.sending') : t('contact.send')}</span>
                </button>
              </form>
            </div>

            <div className="contact-info">
              <div className="contact-info-item reveal">
                <div className="ci-icon"><MessageSquareText size={20} /></div>
                <div><strong>{t('contact.smsHelpline')}</strong><span>{t('contact.smsHelpText')}</span></div>
              </div>
              <div className="contact-info-item reveal reveal-d1">
                <div className="ci-icon"><ShieldCheck size={20} /></div>
                <div><strong>{t('contact.institutional')}</strong><span>{t('contact.institutionalText')}</span></div>
              </div>
              <div className="contact-info-item reveal reveal-d2">
                <div className="ci-icon"><HelpCircle size={20} /></div>
                <div><strong>{t('contact.supportHours')}</strong><span>{t('contact.supportHoursText')}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

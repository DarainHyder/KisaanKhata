import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { CheckCircle2 } from 'lucide-react'
import api from '../api'
import { useI18n } from '../i18n/useI18n'
import { useReveal, prefersReducedMotion } from '../hooks/motion'
import Hero from '../components/landing/Hero'
import LiveStats from '../components/landing/LiveStats'
import ExplodedKhata from '../components/landing/ExplodedKhata'
import ParseSentence from '../components/landing/ParseSentence'
import FairPriceChecker from '../components/landing/FairPriceChecker'
import HashChain from '../components/landing/HashChain'

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
    const lenis = new Lenis({ autoRaf: true, anchors: { offset: -64 }, lerp: 0.1 })
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
      <ExplodedKhata />
      <ParseSentence />
      <FairPriceChecker />
      <HashChain />

      {/* ---------- Open your khata ---------- */}
      <section id="khata-form" ref={formRef} className="section access-section theme-mustard">
        <div className="container access">
          <div className="access-copy reveal">
            <span className="kicker">{t('access.eyebrow')}</span>
            <h2 className="display-lg">{t('login.title')}</h2>
            <p className="lead">{t('login.subtitle')}</p>
            <ol className="access-points">
              <li><span>i.</span>{t('access.p1')}</li>
              <li><span>ii.</span>{t('access.p2')}</li>
              <li><span>iii.</span>{t('access.p3')}</li>
            </ol>
          </div>

          <div className="ledger-form reveal reveal-d1">
            <div className="tabs" role="tablist">
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
                <div className="field">
                  <label htmlFor="phone">{t('login.phoneLabel')}</label>
                  <input id="phone" type="tel" inputMode="tel" placeholder={t('login.phonePlaceholder')} value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="name">{t('login.nameLabel')}</label>
                  <input id="name" type="text" placeholder={t('login.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} required minLength={2} />
                </div>
                <div className="field">
                  <label htmlFor="location">{t('login.locationLabel')}</label>
                  <input id="location" type="text" placeholder={t('login.locationPlaceholder')} value={location} onChange={e => setLocation(e.target.value)} required />
                </div>
                <button className="btn btn-solid btn-block" type="submit" disabled={loading}>
                  {loading ? t('login.registering') : t('login.openLedger')} <span className="arrow" aria-hidden="true">→</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleFind}>
                <div className="field">
                  <label htmlFor="find-phone">{t('login.phoneLabel')}</label>
                  <input id="find-phone" type="tel" inputMode="tel" placeholder={t('login.phonePlaceholder')} value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
                <button className="btn btn-solid btn-block" type="submit" disabled={loading}>
                  {loading ? t('login.searching') : t('login.findMyKhata')} <span className="arrow" aria-hidden="true">→</span>
                </button>

                <p className="helper">{t('login.directId')}</p>
                <div className="id-row">
                  <div className="field">
                    <input type="number" inputMode="numeric" min={1} placeholder={t('login.farmerIdPlaceholder')} value={directId} onChange={e => setDirectId(e.target.value)} aria-label={t('login.farmerIdPlaceholder')} />
                  </div>
                  <button type="button" className="btn btn-line" onClick={handleDirectId} disabled={loading}>{t('login.enter')}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Contact ---------- */}
      <section id="contact" className="section contact-section theme-soil">
        <div className="container contact-grid">
          <div className="reveal">
            <span className="kicker">{t('nav.contact')}</span>
            <h2 className="display-md">{t('contact.title')}</h2>
            <p className="lead">{t('contact.subtitle')}</p>
            <dl className="contact-list">
              <div><dt>{t('contact.smsHelpline')}</dt><dd>{t('contact.smsHelpText')}</dd></div>
              <div><dt>{t('contact.institutional')}</dt><dd>{t('contact.institutionalText')}</dd></div>
              <div><dt>{t('contact.supportHours')}</dt><dd>{t('contact.supportHoursText')}</dd></div>
            </dl>
          </div>

          <div className="ledger-form reveal reveal-d1">
            <div className="form-title">{t('contact.or')}</div>
            {contactSuccess && <div className="alert alert-success"><CheckCircle2 size={18} /><span>{contactSuccess}</span></div>}
            {contactError && <div className="alert alert-error">{contactError}</div>}
            <form onSubmit={handleContactSubmit}>
              <div className="field">
                <label htmlFor="c-name">{t('contact.nameLabel')}</label>
                <input id="c-name" type="text" placeholder={t('contact.namePlaceholder')} value={contactName} onChange={e => setContactName(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="c-contact">{t('contact.contactLabel')}</label>
                <input id="c-contact" type="text" placeholder={t('contact.contactPlaceholder')} value={contactContact} onChange={e => setContactContact(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="c-msg">{t('contact.messageLabel')}</label>
                <textarea id="c-msg" rows={3} placeholder={t('contact.messagePlaceholder')} value={contactMessage} onChange={e => setContactMessage(e.target.value)} required />
              </div>
              <button className="btn btn-line btn-block" type="submit" disabled={contactSubmitting}>
                {contactSubmitting ? t('contact.sending') : t('contact.send')} <span className="arrow" aria-hidden="true">→</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}

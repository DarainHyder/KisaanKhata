import { useState, useRef } from 'react'
import api from '../api'
import { useI18n } from '../i18n/useI18n'
import {
  Mic,
  TrendingUp,
  Lock,
  MessageSquare,
  Phone,
  MapPin,
  User,
  CheckCircle2,
  Send,
  HelpCircle,
  ShieldCheck,
  ArrowRight
} from 'lucide-react'

export default function FarmerLogin({ onLogin }) {
  const { t } = useI18n()
  const [mode, setMode] = useState('login') // 'login' | 'find'
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Contact section state
  const [contactName, setContactName] = useState('')
  const [contactContact, setContactContact] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [contactSuccess, setContactSuccess] = useState('')
  const [contactError, setContactError] = useState('')
  const [contactSubmitting, setContactSubmitting] = useState(false)

  const formRef = useRef(null)

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
      } else {
        setError(err.response?.data?.detail || t('login.errors.somethingWrong'))
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
      const res = await api.get('/ledger/farmers/by-phone', {
        params: { phone: phone.trim() }
      }).catch(() => null)

      if (!res) {
        setError(t('login.errors.farmerNotFound'))
      } else {
        onLogin(res.data)
      }
    } catch (err) {
      setError(err.response?.data?.detail || t('login.errors.farmerNotFound'))
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

  return (
    <div style={{ backgroundColor: 'var(--bg)', width: '100%' }}>
      {/* ---------- 1. HERO BACKGROUND IMAGE SECTION ---------- */}
      <section id="hero" className="hero-wrapper">
        <img
          src="/images/hero-farm.jpg"
          alt={t('hero.headline')}
          className="hero-bg-img"
        />
        <div className="hero-overlay" />

        <div className="hero-content">
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            color: 'var(--accent-gold)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '14px',
            fontWeight: 600
          }}>
            {t('hero.eyebrow')}
          </div>

          {/* Exactly one H1 per page */}
          <h1 className="hero-headline">
            {t('hero.headline')}
          </h1>

          <a
            href="#khata-form"
            className="btn btn-primary hero-cta"
            onClick={scrollToForm}
          >
            <span>{t('hero.cta')}</span>
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* ---------- 2. FEATURES LEDGER SECTION ---------- */}
      <section id="how-it-works" className="features-ledger-section">
        <h2 className="features-ledger-header">{t('features.header')}</h2>

        <div className="ledger-feature-row">
          <div className="ledger-feature-num">01</div>
          <div>
            <div className="ledger-feature-title">
              <Mic size={18} color="var(--accent-gold)" />
              <span>{t('features.voiceFirst.title')}</span>
            </div>
            <div className="ledger-feature-desc">
              {t('features.voiceFirst.desc')}
            </div>
          </div>
        </div>

        <div className="ledger-feature-row">
          <div className="ledger-feature-num">02</div>
          <div>
            <div className="ledger-feature-title">
              <TrendingUp size={18} color="var(--accent-gold)" />
              <span>{t('features.priceVerify.title')}</span>
            </div>
            <div className="ledger-feature-desc">
              {t('features.priceVerify.desc')}
            </div>
          </div>
        </div>

        <div className="ledger-feature-row">
          <div className="ledger-feature-num">03</div>
          <div>
            <div className="ledger-feature-title">
              <Lock size={18} color="var(--accent-gold)" />
              <span>{t('features.integrity.title')}</span>
            </div>
            <div className="ledger-feature-desc">
              {t('features.integrity.desc')}
            </div>
          </div>
        </div>

        <div className="ledger-feature-row">
          <div className="ledger-feature-num">04</div>
          <div>
            <div className="ledger-feature-title">
              <MessageSquare size={18} color="var(--accent-gold)" />
              <span>{t('features.sms.title')}</span>
            </div>
            <div className="ledger-feature-desc">
              {t('features.sms.desc')}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 3. ACCOUNT FORM SECTION ---------- */}
      <section id="khata-form" ref={formRef} style={{ padding: '40px 20px 60px', maxWidth: '560px', margin: '0 auto' }}>
        <div className="card" style={{ background: '#F5F3EC', border: '1px solid var(--soil-brown)', padding: '32px 24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', marginBottom: '6px', textAlign: 'center' }}>
            {t('login.title')}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--soil-brown)', textAlign: 'center', marginBottom: '24px' }}>
            {t('login.subtitle')}
          </p>

          {/* Mode Toggle Buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <button
              type="button"
              className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1, padding: '10px' }}
              onClick={() => { setMode('login'); setError('') }}
            >
              {t('login.newAccount')}
            </button>
            <button
              type="button"
              className={`btn ${mode === 'find' ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1, padding: '10px' }}
              onClick={() => { setMode('find'); setError('') }}
            >
              {t('login.findAccount')}
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={16} color="var(--soil-brown)" />
                  <span>{t('login.phoneLabel')}</span>
                </label>
                <input
                  type="tel"
                  placeholder={t('login.phonePlaceholder')}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={16} color="var(--soil-brown)" />
                  <span>{t('login.nameLabel')}</span>
                </label>
                <input
                  type="text"
                  placeholder={t('login.namePlaceholder')}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={16} color="var(--soil-brown)" />
                  <span>{t('login.locationLabel')}</span>
                </label>
                <input
                  type="text"
                  placeholder={t('login.locationPlaceholder')}
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  required
                />
              </div>

              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? t('login.registering') : t('login.openLedger')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleFind}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={16} color="var(--soil-brown)" />
                  <span>{t('login.phoneLabel')}</span>
                </label>
                <input
                  type="tel"
                  placeholder={t('login.phonePlaceholder')}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={16} color="var(--soil-brown)" />
                  <span>{t('login.verifyNameLabel')}</span>
                </label>
                <input
                  type="text"
                  placeholder={t('login.namePlaceholder')}
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? t('login.searching') : t('login.findMyKhata')}
              </button>

              <hr className="divider" />
              <p style={{ fontSize: '.85rem', color: 'var(--soil-brown)', textAlign: 'center', marginBottom: 12 }}>
                {t('login.directId')}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  placeholder={t('login.farmerIdPlaceholder')}
                  min={1}
                  id="direct-id"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '12px 16px' }}
                  onClick={() => {
                    const id = parseInt(document.getElementById('direct-id').value)
                    if (id > 0) onLogin({ id, name: name || 'Farmer', phone_number: phone })
                    else setError(t('login.errors.invalidId'))
                  }}
                >
                  {t('login.enter')}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ---------- 4. REBUILT CONTACT SECTION ---------- */}
      <section id="contact" className="contact-section">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', textAlign: 'center', marginBottom: '8px' }}>
          {t('contact.title')}
        </h2>
        <p style={{ fontSize: '0.95rem', color: 'var(--soil-brown)', textAlign: 'center', maxWidth: '640px', margin: '0 auto 28px', lineHeight: 1.55 }}>
          {t('contact.subtitle')}
        </p>

        <div className="contact-grid">
          {/* Form Side */}
          <div className="card" style={{ background: '#F5F3EC', border: '1px solid var(--soil-brown)', padding: '28px 24px' }}>
            {contactSuccess && (
              <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} />
                <span>{contactSuccess}</span>
              </div>
            )}
            {contactError && <div className="alert alert-error">{contactError}</div>}

            <form onSubmit={handleContactSubmit}>
              <div className="form-group">
                <label>{t('contact.nameLabel')}</label>
                <input
                  type="text"
                  placeholder={t('contact.namePlaceholder')}
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>{t('contact.contactLabel')}</label>
                <input
                  type="text"
                  placeholder={t('contact.contactPlaceholder')}
                  value={contactContact}
                  onChange={e => setContactContact(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>{t('contact.messageLabel')}</label>
                <textarea
                  rows={4}
                  placeholder={t('contact.messagePlaceholder')}
                  value={contactMessage}
                  onChange={e => setContactMessage(e.target.value)}
                  required
                />
              </div>

              <button className="btn btn-primary" type="submit" disabled={contactSubmitting}>
                <Send size={16} />
                <span>{contactSubmitting ? t('contact.sending') : t('contact.send')}</span>
              </button>
            </form>
          </div>

          {/* Info Side */}
          <div className="contact-info-panel">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: '16px' }}>
              {t('contact.supportInfo')}
            </h3>

            <div className="contact-info-item">
              <Phone size={20} color="var(--accent-gold)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem' }}>{t('contact.smsHelpline')}</strong>
                <span style={{ fontSize: '0.88rem', color: 'var(--soil-brown)' }}>
                  {t('contact.smsHelpText')}
                </span>
              </div>
            </div>

            <div className="contact-info-item">
              <ShieldCheck size={20} color="var(--accent-gold)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem' }}>{t('contact.institutional')}</strong>
                <span style={{ fontSize: '0.88rem', color: 'var(--soil-brown)' }}>
                  {t('contact.institutionalText')}
                </span>
              </div>
            </div>

            <div className="contact-info-item">
              <HelpCircle size={20} color="var(--accent-gold)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem' }}>{t('contact.supportHours')}</strong>
                <span style={{ fontSize: '0.88rem', color: 'var(--soil-brown)' }}>
                  {t('contact.supportHoursText')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

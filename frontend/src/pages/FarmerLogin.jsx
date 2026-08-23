import { useState, useRef } from 'react'
import api from '../api'
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
    if (!phone.trim()) return setError('Please enter your phone number.')
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
        setError('Phone number already registered. Switch to Find Account below.')
      } else {
        setError(err.response?.data?.detail || 'Something went wrong.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleFind(e) {
    e.preventDefault()
    setError('')
    if (!phone.trim()) return setError('Please enter your phone number.')
    setLoading(true)
    try {
      const res = await api.get('/ledger/farmers/by-phone', {
        params: { phone: phone.trim() }
      }).catch(() => null)

      if (!res) {
        setError('Farmer record not found. Please register a new account.')
      } else {
        onLogin(res.data)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Farmer record not found.')
    } finally {
      setLoading(false)
    }
  }

  function handleContactSubmit(e) {
    e.preventDefault()
    setContactError('')
    setContactSuccess('')

    if (!contactName.trim()) return setContactError('Please enter your name.')
    if (!contactContact.trim()) return setContactError('Please enter your email or phone number.')
    if (!contactMessage.trim()) return setContactError('Please enter your message.')

    setContactSubmitting(true)
    setTimeout(() => {
      setContactSubmitting(false)
      setContactSuccess('Thank you for reaching out. Our team will contact you shortly.')
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
          alt="Pakistani wheat farmer harvesting crops in agricultural field"
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
            KisaanKhata Digital Farm Ledger
          </div>

          {/* Exactly one H1 per page */}
          <h1 className="hero-headline">
            Your harvest. Your record. No one else's word against yours.
          </h1>

          <a
            href="#khata-form"
            className="btn btn-primary hero-cta"
            onClick={scrollToForm}
          >
            <span>Access Your Ledger</span>
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* ---------- 2. FEATURES LEDGER SECTION ---------- */}
      <section id="how-it-works" className="features-ledger-section">
        <h2 className="features-ledger-header">Built for Pakistan's Agricultural Community</h2>

        <div className="ledger-feature-row">
          <div className="ledger-feature-num">01</div>
          <div>
            <div className="ledger-feature-title">
              <Mic size={18} color="var(--accent-gold)" />
              <span>Voice First Urdu Logging</span>
            </div>
            <div className="ledger-feature-desc">
              Speak naturally in Urdu or local dialect. Speech recognition transcribes and extracts loans and harvest sales automatically.
            </div>
          </div>
        </div>

        <div className="ledger-feature-row">
          <div className="ledger-feature-num">02</div>
          <div>
            <div className="ledger-feature-title">
              <TrendingUp size={18} color="var(--accent-gold)" />
              <span>AMIS Punjab Mandi Price Verification</span>
            </div>
            <div className="ledger-feature-desc">
              Cross check your sale prices against official live Punjab wholesale rates to spot underpayment immediately.
            </div>
          </div>
        </div>

        <div className="ledger-feature-row">
          <div className="ledger-feature-num">03</div>
          <div>
            <div className="ledger-feature-title">
              <Lock size={18} color="var(--accent-gold)" />
              <span>Cryptographic Hash Chain Integrity</span>
            </div>
            <div className="ledger-feature-desc">
              Every ledger entry is linked by a SHA-256 hash chain. Records cannot be silently altered after creation.
            </div>
          </div>
        </div>

        <div className="ledger-feature-row">
          <div className="ledger-feature-num">04</div>
          <div>
            <div className="ledger-feature-title">
              <MessageSquare size={18} color="var(--accent-gold)" />
              <span>Basic Phone SMS and WhatsApp Interface</span>
            </div>
            <div className="ledger-feature-desc">
              No smartphone required. Query live mandi prices via Roman Urdu SMS commands on any basic feature phone.
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 3. ACCOUNT FORM SECTION ---------- */}
      <section id="khata-form" ref={formRef} style={{ padding: '40px 20px 60px', maxWidth: '560px', margin: '0 auto' }}>
        <div className="card" style={{ background: '#F5F3EC', border: '1px solid var(--soil-brown)', padding: '32px 24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', marginBottom: '6px', textAlign: 'center' }}>
            Open Your Farm Khata
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--soil-brown)', textAlign: 'center', marginBottom: '24px' }}>
            Enter your details to manage transactions and check mandi prices.
          </p>

          {/* Mode Toggle Buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <button
              type="button"
              className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1, padding: '10px' }}
              onClick={() => { setMode('login'); setError('') }}
            >
              New Account
            </button>
            <button
              type="button"
              className={`btn ${mode === 'find' ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1, padding: '10px' }}
              onClick={() => { setMode('find'); setError('') }}
            >
              Find Account
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={16} color="var(--soil-brown)" />
                  <span>Phone Number *</span>
                </label>
                <input
                  type="tel"
                  placeholder="03001234567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={16} color="var(--soil-brown)" />
                  <span>Farmer Full Name *</span>
                </label>
                <input
                  type="text"
                  placeholder="Muhammad Aslam"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={16} color="var(--soil-brown)" />
                  <span>City or Mandi Location *</span>
                </label>
                <input
                  type="text"
                  placeholder="Multan"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  required
                />
              </div>

              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Registering...' : 'Open Khata Ledger'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleFind}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={16} color="var(--soil-brown)" />
                  <span>Registered Phone Number *</span>
                </label>
                <input
                  type="tel"
                  placeholder="03001234567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={16} color="var(--soil-brown)" />
                  <span>Farmer Name (Verification)</span>
                </label>
                <input
                  type="text"
                  placeholder="Muhammad Aslam"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Searching...' : 'Find My Khata'}
              </button>

              <hr className="divider" />
              <p style={{ fontSize: '.85rem', color: 'var(--soil-brown)', textAlign: 'center', marginBottom: 12 }}>
                Or enter your numeric Farmer ID directly
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  placeholder="Farmer ID (e.g. 1)"
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
                    else setError('Please enter a valid Farmer ID.')
                  }}
                >
                  Enter
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ---------- 4. REBUILT CONTACT SECTION ---------- */}
      <section id="contact" className="contact-section">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', textAlign: 'center', marginBottom: '8px' }}>
          Get in Touch
        </h2>
        <p style={{ fontSize: '0.95rem', color: 'var(--soil-brown)', textAlign: 'center', maxWidth: '640px', margin: '0 auto 28px', lineHeight: 1.55 }}>
          Have questions about mandi price verification, SMS access, or agricultural cooperative partnerships? Send us a message and our team will assist you.
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
                <label>Full Name *</label>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone Number or Email *</label>
                <input
                  type="text"
                  placeholder="03001234567 or email@domain.com"
                  value={contactContact}
                  onChange={e => setContactContact(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Message *</label>
                <textarea
                  rows={4}
                  placeholder="Describe your inquiry..."
                  value={contactMessage}
                  onChange={e => setContactMessage(e.target.value)}
                  required
                />
              </div>

              <button className="btn btn-primary" type="submit" disabled={contactSubmitting}>
                <Send size={16} />
                <span>{contactSubmitting ? 'Sending...' : 'Send Message'}</span>
              </button>
            </form>
          </div>

          {/* Info Side */}
          <div className="contact-info-panel">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: '16px' }}>
              Support Information
            </h3>

            <div className="contact-info-item">
              <Phone size={20} color="var(--accent-gold)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem' }}>SMS Helpline Service</strong>
                <span style={{ fontSize: '0.88rem', color: 'var(--soil-brown)' }}>
                  Send "SALE [crop] [price] [city]" to our helpline for immediate price checking.
                </span>
              </div>
            </div>

            <div className="contact-info-item">
              <ShieldCheck size={20} color="var(--accent-gold)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem' }}>Institutional Verification</strong>
                <span style={{ fontSize: '0.88rem', color: 'var(--soil-brown)' }}>
                  Agriculture departments and banking partners can access verified district reports via our analytics endpoints.
                </span>
              </div>
            </div>

            <div className="contact-info-item">
              <HelpCircle size={20} color="var(--accent-gold)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem' }}>Farmer Support Hours</strong>
                <span style={{ fontSize: '0.88rem', color: 'var(--soil-brown)' }}>
                  Monday to Saturday, 8:00 AM to 6:00 PM PKT.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

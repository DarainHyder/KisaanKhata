import { useState, useRef } from 'react'
import api from '../api'
import { useI18n } from '../i18n/useI18n'
import {
  Mic,
  SquareCheck,
  Volume2,
  Plus,
  ArrowLeft,
  Save,
  RotateCcw,
  Edit3,
  Loader2,
  HelpCircle,
  Wheat,
  Wallet
} from 'lucide-react'

const EMPTY_FORM = {
  entry_type: '',
  amount: '',
  crop_name: '',
  unit: '',
  reported_price_per_unit: '',
  date: new Date().toISOString().slice(0, 10),
}

const UNITS = ['40kg','maund','kg','quintal','tonne','dozen','PKR']

export default function VoiceEntry({ farmer }) {
  const { lang, t } = useI18n()
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [confidenceNote, setConfidenceNote] = useState('')
  const [step, setStep] = useState('record') // 'record' | 'confirm' | 'done'
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState('')
  const mediaRef = useRef(null)
  const chunksRef = useRef([])

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = handleStop
      mediaRef.current = mr
      mr.start()
      setRecording(true)
    } catch {
      setError(t('voice.errors.micDenied'))
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
    mediaRef.current?.stream?.getTracks().forEach(t => t.stop())
    setRecording(false)
  }

  async function handleStop() {
    setProcessing(true)
    setError('')
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const fd = new FormData()
      fd.append('audio', blob, 'recording.webm')
      const res = await api.post(`/ledger/voice-entry?language=${lang}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = res.data
      setTranscript(data.transcript || '')
      setConfidenceNote(data.parsed?.confidence_note || '')
      setForm({
        entry_type:              data.parsed?.entry_type || '',
        amount:                  data.parsed?.amount ?? '',
        crop_name:               data.parsed?.crop_name || '',
        unit:                    data.parsed?.unit || '',
        reported_price_per_unit: data.parsed?.reported_price_per_unit ?? '',
        date:                    new Date().toISOString().slice(0, 10),
      })
      setStep('confirm')
    } catch (e) {
      setError(e.response?.data?.detail || t('voice.errors.transcriptionFailed'))
    } finally {
      setProcessing(false)
    }
  }

  async function handleConfirm(e) {
    e.preventDefault()
    setError('')
    if (!form.entry_type) return setError(t('voice.errors.selectType'))
    if (!form.amount)     return setError(t('voice.errors.amountRequired'))
    if (!form.unit)       return setError(t('voice.errors.unitRequired'))
    if (form.entry_type === 'sale' && !form.crop_name) return setError(t('voice.errors.cropRequired'))
    if (form.entry_type === 'sale' && !form.reported_price_per_unit) return setError(t('voice.errors.priceRequired'))

    setProcessing(true)
    try {
      await api.post('/ledger/voice-entry/confirm', {
        farmer_id:               farmer.id,
        entry_type:              form.entry_type,
        amount:                  parseFloat(form.amount),
        unit:                    form.unit,
        date:                    new Date(form.date).toISOString(),
        crop_name:               form.crop_name || null,
        reported_price_per_unit: form.reported_price_per_unit ? parseFloat(form.reported_price_per_unit) : null,
      })
      setSuccess(t('voice.success'))
      setStep('done')
    } catch (e) {
      setError(e.response?.data?.detail || t('voice.errors.saveFailed'))
    } finally {
      setProcessing(false)
    }
  }

  function reset() {
    setStep('record')
    setTranscript('')
    setForm(EMPTY_FORM)
    setConfidenceNote('')
    setError('')
    setSuccess('')
  }

  // ---- STEP 1: Record ----
  if (step === 'record') {
    return (
      <div>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mic size={24} color="var(--accent-gold)" />
          <span>{t('voice.title')}</span>
        </h1>
        <p className="page-subtitle">{t('voice.subtitle')}</p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="card" style={{ background: '#F5F3EC', border: '1px solid var(--soil-brown)' }}>
          <div className="mic-wrap">
            <div className="mic-btn-container">
              <div className={`mic-ring${recording ? ' active' : ''}`} />
              <button
                className={`mic-btn${recording ? ' recording' : ''}`}
                onClick={recording ? stopRecording : startRecording}
                disabled={processing}
                title={recording ? t('voice.stopRecording') : t('voice.startRecording')}
              >
                {processing ? <Loader2 size={36} className="spinner" style={{ margin: 0 }} /> : <Mic size={36} />}
              </button>
            </div>
            <div className="mic-label">
              {processing ? t('voice.transcribing') : recording ? t('voice.recording') : t('voice.startRecording')}
            </div>
          </div>

          <div className="alert alert-info" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
              <HelpCircle size={16} />
              <span>{t('voice.examples')}</span>
            </div>
            <div>{t('voice.example1')}</div>
            <div>{t('voice.example2')}</div>
          </div>
        </div>

        <hr className="divider" />
        <p style={{ textAlign: 'center', color: 'var(--soil-brown)', fontSize: '.9rem', marginBottom: 12 }}>
          {t('voice.manualEntryHint')}
        </p>
        <button className="btn btn-outline" onClick={() => { setStep('confirm'); setTranscript('') }}>
          <Edit3 size={18} />
          <span>{t('voice.manualEntry')}</span>
        </button>
      </div>
    )
  }

  // ---- STEP 2: Confirm ----
  if (step === 'confirm') {
    return (
      <div>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SquareCheck size={24} color="var(--status-fair)" />
          <span>{t('voice.reviewTitle')}</span>
        </h1>
        <p className="page-subtitle">{t('voice.reviewSubtitle')}</p>

        {transcript && (
          <div className="card" style={{ background: '#F5F3EC', border: '1px solid var(--soil-brown)' }}>
            <label style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--soil-brown)' }}>
              <Volume2 size={16} />
              <span>{t('voice.transcription')}</span>
            </label>
            <div className="transcript-box">{transcript}</div>
            {confidenceNote && (
              <div className="alert alert-info" style={{ marginBottom: 0 }}>{confidenceNote}</div>
            )}
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleConfirm}>
          <div className="card" style={{ background: '#F5F3EC', border: '1px solid var(--soil-brown)' }}>
            <div className="form-group">
              <label>{t('voice.transactionType')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['loan', 'sale'].map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`btn ${form.entry_type === t ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1, padding: '12px', gap: 6 }}
                    onClick={() => setForm(f => ({ ...f, entry_type: t }))}
                  >
                    {t === 'loan' ? <Wallet size={16} /> : <Wheat size={16} />}
                    <span>{t === 'loan' ? t('voice.loan') : t('voice.sale')}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>{t('voice.amountLabel')}</label>
              <input
                type="number"
                min="1"
                placeholder={t('voice.amountPlaceholder')}
                className="num-mono"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>{t('voice.unitLabel')}</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                <option value="">{t('voice.unitPlaceholder')}</option>
                {UNITS.map(u => (
                  <option key={u} value={u}>{t(`voice.units.${u}`)}</option>
                ))}
              </select>
            </div>

            {form.entry_type === 'sale' && (
              <>
                <div className="form-group">
                  <label>{t('voice.cropLabel')}</label>
                  <input
                    type="text"
                    placeholder={t('voice.cropPlaceholder')}
                    value={form.crop_name}
                    onChange={e => setForm(f => ({ ...f, crop_name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>{t('voice.priceLabel')}</label>
                  <input
                    type="number"
                    min="1"
                    placeholder={t('voice.pricePlaceholder')}
                    className="num-mono"
                    value={form.reported_price_per_unit}
                    onChange={e => setForm(f => ({ ...f, reported_price_per_unit: e.target.value }))}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label>{t('voice.dateLabel')}</label>
              <input
                type="date"
                className="num-mono"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={processing}>
            <Save size={18} />
            <span>{processing ? t('voice.saving') : t('voice.save')}</span>
          </button>

          <button type="button" className="btn btn-outline" style={{ marginTop: 10 }} onClick={reset}>
            <RotateCcw size={18} />
            <span>{t('voice.recordAgain')}</span>
          </button>
        </form>
      </div>
    )
  }

  // ---- STEP 3: Done ----
  return (
    <div>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SquareCheck size={24} color="var(--status-fair)" />
        <span>{t('voice.doneTitle')}</span>
      </h1>
      <div className="alert alert-success">{success}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        <button className="btn btn-primary" onClick={reset}>
          <Plus size={18} />
          <span>{t('voice.recordAnother')}</span>
        </button>
        <button className="btn btn-outline" onClick={() => window.location.href = '/'}>
          <ArrowLeft size={18} />
          <span>{t('voice.backToDashboard')}</span>
        </button>
      </div>
    </div>
  )
}

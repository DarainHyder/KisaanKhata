import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n/useI18n'
import {
  Mic, Square, Volume2, Plus, ArrowLeft, Save, RotateCcw, Edit3, Loader2, Lightbulb, Wheat, Wallet, CheckCircle2,
} from 'lucide-react'

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY_FORM = {
  entry_type: '',
  amount: '',
  crop_name: '',
  unit: '',
  reported_price_per_unit: '',
  date: today(),
}

const UNITS = ['40kg', 'maund', 'kg', 'quintal', 'tonne', 'dozen', 'PKR']
const BAR_COUNT = 24

function Stepper({ step, t }) {
  const steps = [['record', t('voice.stepRecord')], ['confirm', t('voice.stepReview')], ['done', t('voice.stepSaved')]]
  const idx = steps.findIndex(([k]) => k === step)
  return (
    <div className="stepper" aria-hidden="true">
      {steps.map(([k, label], i) => (
        <span key={k} style={{ display: 'contents' }}>
          <span className={`st${i <= idx ? ' on' : ''}`}><b>{i + 1}</b>{label}</span>
          {i < steps.length - 1 && <span className="sep" />}
        </span>
      ))}
    </div>
  )
}

export default function VoiceEntry({ farmer }) {
  const { lang, t } = useI18n()
  const navigate = useNavigate()
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [confidenceNote, setConfidenceNote] = useState('')
  const [step, setStep] = useState('record') // 'record' | 'confirm' | 'done'
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const audioRef = useRef(null) // { ctx, raf }
  const barRefs = useRef([])

  useEffect(() => () => stopMeter(), [])

  function startMeter(stream) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const loop = () => {
        analyser.getByteFrequencyData(data)
        barRefs.current.forEach((bar, i) => {
          if (!bar) return
          const v = data[Math.floor((i / BAR_COUNT) * data.length * 0.8)] / 255
          bar.style.transform = `scaleY(${Math.max(0.12, v)})`
        })
        audioRef.current.raf = requestAnimationFrame(loop)
      }
      audioRef.current = { ctx, raf: requestAnimationFrame(loop) }
    } catch {
      // The meter is decorative; recording still works without it.
    }
  }

  function stopMeter() {
    if (!audioRef.current) return
    cancelAnimationFrame(audioRef.current.raf)
    audioRef.current.ctx.close().catch(() => {})
    audioRef.current = null
    barRefs.current.forEach(bar => { if (bar) bar.style.transform = 'scaleY(0.12)' })
  }

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
      startMeter(stream)
      setRecording(true)
    } catch {
      setError(t('voice.errors.micDenied'))
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
    mediaRef.current?.stream?.getTracks().forEach(track => track.stop())
    stopMeter()
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
        timeout: 120000,
      })
      const data = res.data
      setTranscript(data.transcript || '')
      setConfidenceNote(data.parsed?.confidence_note || '')
      setForm({
        entry_type: data.parsed?.entry_type || '',
        amount: data.parsed?.amount ?? '',
        crop_name: data.parsed?.crop_name || '',
        unit: data.parsed?.unit || '',
        reported_price_per_unit: data.parsed?.reported_price_per_unit ?? '',
        date: today(),
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
    if (!form.amount) return setError(t('voice.errors.amountRequired'))
    if (!form.unit) return setError(t('voice.errors.unitRequired'))
    if (form.entry_type === 'sale' && !form.crop_name) return setError(t('voice.errors.cropRequired'))
    if (form.entry_type === 'sale' && !form.reported_price_per_unit) return setError(t('voice.errors.priceRequired'))

    setProcessing(true)
    try {
      await api.post('/ledger/voice-entry/confirm', {
        farmer_id: farmer.id,
        entry_type: form.entry_type,
        amount: parseFloat(form.amount),
        unit: form.unit,
        date: new Date(form.date).toISOString(),
        crop_name: form.crop_name || null,
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
    setForm({ ...EMPTY_FORM, date: today() })
    setConfidenceNote('')
    setError('')
    setSuccess('')
  }

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  if (step === 'record') {
    return (
      <div>
        <Stepper step={step} t={t} />
        <div className="page-head">
          <h1 className="page-title">{t('voice.title')}</h1>
          <p className="page-subtitle">{t('voice.subtitle')}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <div className="mic-stage">
            <div className="mic-btn-container">
              <div className={`mic-ring${recording ? ' active' : ''}`} />
              <div className={`mic-ring r2${recording ? ' active' : ''}`} />
              <div className={`mic-ring r3${recording ? ' active' : ''}`} />
              <button
                className={`mic-btn${recording ? ' recording' : ''}`}
                onClick={recording ? stopRecording : startRecording}
                disabled={processing}
                aria-label={recording ? t('voice.stopRecording') : t('voice.startRecording')}
              >
                {processing ? <Loader2 size={40} className="spin" /> : recording ? <Square size={34} fill="currentColor" /> : <Mic size={42} />}
              </button>
            </div>
            <div className={`level-bars${recording ? '' : ' idle'}`} aria-hidden="true">
              {Array.from({ length: BAR_COUNT }, (_, i) => <i key={i} ref={el => { barRefs.current[i] = el }} />)}
            </div>
            <div className="mic-label" aria-live="polite">
              {processing ? t('voice.transcribing') : recording ? t('voice.recording') : t('voice.startRecording')}
            </div>
          </div>

          <div className="alert alert-info" style={{ marginBottom: 0, flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <Lightbulb size={16} /><span>{t('voice.examples')}</span>
            </div>
            <div className="examples">
              <div>{t('voice.example1')}</div>
              <div>{t('voice.example2')}</div>
            </div>
          </div>
        </div>

        <p className="helper" style={{ marginTop: 22 }}>{t('voice.manualEntryHint')}</p>
        <button className="btn btn-outline" onClick={() => { setStep('confirm'); setTranscript('') }}>
          <Edit3 size={18} /><span>{t('voice.manualEntry')}</span>
        </button>
      </div>
    )
  }

  if (step === 'confirm') {
    return (
      <div>
        <Stepper step={step} t={t} />
        <div className="page-head">
          <h1 className="page-title">{t('voice.reviewTitle')}</h1>
          <p className="page-subtitle">{t('voice.reviewSubtitle')}</p>
        </div>

        {transcript && (
          <div className="card">
            <label><Volume2 size={14} />{t('voice.transcription')}</label>
            <div className="transcript-box">{transcript}</div>
            {confidenceNote && <div className="alert alert-info" style={{ marginBottom: 0 }}>{confidenceNote}</div>}
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleConfirm}>
          <div className="card">
            <label>{t('voice.transactionType')}</label>
            <div className="segmented">
              {['loan', 'sale'].map(type => (
                <button
                  key={type}
                  type="button"
                  className={form.entry_type === type ? 'active' : ''}
                  onClick={() => setForm(f => ({ ...f, entry_type: type }))}
                >
                  {type === 'loan' ? <Wallet size={16} /> : <Wheat size={16} />}
                  <span>{type === 'loan' ? t('voice.loan') : t('voice.sale')}</span>
                </button>
              ))}
            </div>

            <div className="form-group">
              <label htmlFor="amount">{t('voice.amountLabel')}</label>
              <input id="amount" type="number" min="1" inputMode="decimal" placeholder={t('voice.amountPlaceholder')} className="num-mono" value={form.amount} onChange={set('amount')} />
            </div>

            <div className="form-group">
              <label htmlFor="unit">{t('voice.unitLabel')}</label>
              <select id="unit" value={form.unit} onChange={set('unit')}>
                <option value="">{t('voice.unitPlaceholder')}</option>
                {UNITS.map(u => <option key={u} value={u}>{t(`voice.units.${u}`)}</option>)}
              </select>
            </div>

            {form.entry_type === 'sale' && (
              <>
                <div className="form-group">
                  <label htmlFor="crop">{t('voice.cropLabel')}</label>
                  <input id="crop" type="text" placeholder={t('voice.cropPlaceholder')} value={form.crop_name} onChange={set('crop_name')} />
                </div>
                <div className="form-group">
                  <label htmlFor="price">{t('voice.priceLabel')}</label>
                  <input id="price" type="number" min="1" inputMode="decimal" placeholder={t('voice.pricePlaceholder')} className="num-mono" value={form.reported_price_per_unit} onChange={set('reported_price_per_unit')} />
                </div>
              </>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="date">{t('voice.dateLabel')}</label>
              <input id="date" type="date" className="num-mono" value={form.date} onChange={set('date')} />
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={processing}>
            {processing ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
            <span>{processing ? t('voice.saving') : t('voice.save')}</span>
          </button>
          <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }} onClick={reset}>
            <RotateCcw size={18} /><span>{t('voice.recordAgain')}</span>
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <Stepper step={step} t={t} />
      <div className="done-burst"><CheckCircle2 size={48} /></div>
      <h1 className="page-title" style={{ justifyContent: 'center' }}>{t('voice.doneTitle')}</h1>
      <p className="page-subtitle" style={{ marginBottom: 26 }}>{success}</p>
      <div style={{ display: 'grid', gap: 12 }}>
        <button className="btn btn-primary" onClick={reset}><Plus size={18} /><span>{t('voice.recordAnother')}</span></button>
        <button className="btn btn-outline" onClick={() => navigate('/history')}><ArrowLeft size={18} className="flip-rtl" /><span>{t('voice.viewInLedger')}</span></button>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { rootApi } from '../../api'
import { useI18n } from '../../i18n/useI18n'

/*
 * A feature phone wired to the live SMS endpoint (the same one Twilio
 * calls). Messages typed here get the real reply a farmer would receive.
 */
const EXAMPLES = ['SALE gandum 3400 Multan', 'PRICE kapas', 'PRICE aloo', 'SALE makkai 2200 Okara']
const KEYS = [['1', '.,?'], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', '+'], ['0', '␣'], ['#', '⇧']]

async function sendSms(body) {
  const form = new URLSearchParams({ From: 'web-demo', Body: body })
  const res = await rootApi.post('/sms/incoming', form, { responseType: 'text', timeout: 30000 })
  const doc = new DOMParser().parseFromString(res.data, 'application/xml')
  return doc.querySelector('Message')?.textContent?.trim() || ''
}

export default function SmsPhone() {
  const { t } = useI18n()
  const [thread, setThread] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const screenRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const el = screenRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread, busy])

  async function send(text) {
    const body = text.trim()
    if (!body || busy) return
    setDraft('')
    setThread(th => [...th, { from: 'me', text: body }])
    setBusy(true)
    try {
      const reply = await sendSms(body)
      setThread(th => [...th, { from: 'kk', text: reply || t('v4.sms.empty') }])
    } catch {
      setThread(th => [...th, { from: 'kk', text: t('v4.sms.noSignal'), error: true }])
    } finally {
      setBusy(false)
    }
  }

  function press(k) {
    if (k === '0') setDraft(d => d + '0')
    else if (k === '#' || k === '*') setDraft(d => d + ' ')
    else setDraft(d => d + k)
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <section id="sms" className="section t-dark sms-section" aria-labelledby="sms-title">
      <div className="container sms-grid">
        <div className="sms-copy reveal">
          <p className="eyebrow">{t('v4.sms.eyebrow')}</p>
          <h2 id="sms-title" className="h2">{t('v4.sms.title')}</h2>
          <p className="lead">{t('v4.sms.lead')}</p>

          <dl className="sms-legend">
            <div>
              <dt><code>SALE</code> <var>{t('v4.sms.crop')}</var> <var>{t('v4.sms.price')}</var> <var>[{t('v4.sms.city')}]</var></dt>
              <dd>{t('v4.sms.saleDesc')}</dd>
            </div>
            <div>
              <dt><code>PRICE</code> <var>{t('v4.sms.crop')}</var></dt>
              <dd>{t('v4.sms.priceDesc')}</dd>
            </div>
          </dl>

          <p className="sms-try">{t('v4.sms.try')}</p>
          <div className="sms-chips">
            {EXAMPLES.map(x => (
              <button key={x} type="button" onClick={() => send(x)} disabled={busy}><code>{x}</code></button>
            ))}
          </div>
        </div>

        <div className="phone-wrap reveal reveal-d1">
          <div className="phone" dir="ltr">
            <div className="phone-ear" />
            <div className="phone-screen">
              <div className="ps-status"><span>KisaanKhata</span><span>▮▮▮▯ 8070</span></div>
              <div className="ps-thread" ref={screenRef} aria-live="polite">
                {thread.length === 0 && <p className="ps-hint">{t('v4.sms.hint')}</p>}
                {thread.map((m, i) => (
                  <p key={i} className={`ps-msg ${m.from}${m.error ? ' err' : ''}`}>{m.text}</p>
                ))}
                {busy && <p className="ps-msg kk typing"><i /><i /><i /></p>}
              </div>
              <form className="ps-compose" onSubmit={e => { e.preventDefault(); send(draft) }}>
                <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder={t('v4.sms.placeholder')} aria-label={t('v4.sms.placeholder')} maxLength={160} />
                <span className="ps-count">{160 - draft.length}</span>
              </form>
            </div>
            <div className="phone-soft">
              <button type="button" className="soft" onClick={() => setThread([])}>{t('v4.sms.clear')}</button>
              <button type="button" className="call" onClick={() => send(draft)} disabled={busy || !draft.trim()} aria-label={t('v4.sms.send')}><Send size={16} /></button>
              <button type="button" className="soft" onClick={() => setDraft(d => d.slice(0, -1))}>{t('v4.sms.back')}</button>
            </div>
            <div className="phone-keys">
              {KEYS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => press(k)} tabIndex={-1}>
                  <b>{k}</b><small>{l}</small>
                </button>
              ))}
            </div>
            <div className="phone-brand">KK · 2G</div>
          </div>
          <p className="phone-note">{t('v4.sms.note')}</p>
        </div>
      </div>
    </section>
  )
}

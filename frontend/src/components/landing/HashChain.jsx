import { useEffect, useRef, useState } from 'react'
import { Lock, Sprout, ShieldCheck, ShieldAlert, Pencil, RotateCcw } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import { useReveal } from '../../hooks/motion'

// Mirrors backend/services/integrity.py: each entry hashes its own fields plus
// the previous entry's hash, so editing one entry breaks every link after it.
const ENTRIES = [
  { id: 1, type: 'loan', amount: 50000, crop: '', unit: 'PKR', date: '2026-03-02', price: '' },
  { id: 2, type: 'sale', amount: 136000, crop: 'wheat', unit: '40kg', date: '2026-04-18', price: 3400 },
  { id: 3, type: 'sale', amount: 84000, crop: 'cotton', unit: '40kg', date: '2026-09-07', price: 8400 },
]
const TAMPERED_AMOUNT = 80000

async function sha256(text) {
  if (window.crypto?.subtle) {
    const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
  }
  // Non-secure contexts have no SubtleCrypto; fall back to a visual stand-in.
  let h = 2166136261
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0).toString(16).padStart(8, '0').repeat(8)
}
const canonical = (e, prev) => [1, e.type, e.amount, e.crop, e.unit, e.date, e.price, prev].join('|')
const short = h => (h ? `${h.slice(0, 4)}…${h.slice(-4)}` : '…')

export default function HashChain() {
  const { t } = useI18n()
  const rootRef = useRef(null)
  const [stored, setStored] = useState([])     // hashes written when the entries were created
  const [current, setCurrent] = useState([])   // hashes recomputed from what is in the table now
  const [tampered, setTampered] = useState(false)
  const [shake, setShake] = useState(false)

  useReveal(rootRef)

  useEffect(() => {
    (async () => {
      const hs = []
      let prev = 'GENESIS'
      for (const e of ENTRIES) { prev = await sha256(canonical(e, prev)); hs.push(prev) }
      setStored(hs)
      setCurrent(hs)
    })()
  }, [])

  async function toggle() {
    if (tampered) { setCurrent(stored); setTampered(false); return }
    const forged = { ...ENTRIES[0], amount: TAMPERED_AMOUNT }
    const recomputed = [await sha256(canonical(forged, 'GENESIS')), ...stored.slice(1)]
    setCurrent(recomputed)
    setTampered(true)
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const brokenFrom = tampered ? 1 : null

  return (
    <section id="integrity" className="section" ref={rootRef}>
      <div className="container">
        <div className="section-head center reveal">
          <span className="eyebrow">{t('chain.eyebrow')}</span>
          <h2 className="section-title">{t('chain.title')}</h2>
          <p className="section-lead">{t('chain.lead')}</p>
        </div>

        <div className="chain reveal">
          <div className="chain-cell">
            <div className="chain-block">
              <div className="cb-head">
                <span className="cb-title">{t('chain.genesis')}</span>
                <Sprout size={18} className="cb-icon" />
              </div>
              <div className="cb-meta">{t('chain.genesisMeta')}</div>
              <div className="cb-hash"><span>prev </span>GENESIS</div>
            </div>
            <div className="chain-link" />
          </div>

          {ENTRIES.map((e, i) => {
            const isSrc = tampered && i === 0
            const isBroken = brokenFrom !== null && e.id > brokenFrom
            const cls = isSrc ? ' tampered-src' : isBroken ? ' broken' : ''
            return (
              <div key={e.id} className="chain-cell">
                <div className={`chain-block${cls}${isSrc && shake ? ' shake' : ''}`}>
                  <div className="cb-head">
                    <span className="cb-title">{t('chain.entry')} {e.id}</span>
                    {isSrc ? <Pencil size={18} className="cb-icon" style={{ color: 'var(--wheat)' }} /> : <Lock size={18} className="cb-icon" />}
                  </div>
                  <div className="cb-meta">
                    {e.type === 'loan' ? t('chain.loan') : `${t('chain.sale')} · ${t(`chain.crops.${e.crop}`)}`}
                    {' · '}
                    <span className="num-mono">
                      {isSrc
                        ? <><s style={{ opacity: 0.6 }}>{e.amount.toLocaleString('en-US')}</s> {TAMPERED_AMOUNT.toLocaleString('en-US')}</>
                        : e.amount.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="cb-hash">
                    <span>hash </span>{short(current[i])}
                    {isSrc && <div style={{ color: 'var(--faint)', marginTop: 4 }}>{t('chain.stored')} {short(stored[i])}</div>}
                  </div>
                </div>
                {i < ENTRIES.length - 1 && <div className={`chain-link${tampered ? ' broken' : ''}`} />}
              </div>
            )
          })}
        </div>

        <div className={`chain-status reveal ${tampered ? 'bad' : 'ok'}`} aria-live="polite">
          <div className="cs-text">
            {tampered ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
            <span>{tampered ? t('chain.broken') : t('chain.intact', { count: ENTRIES.length })}</span>
          </div>
          <button type="button" className={`btn ${tampered ? 'btn-outline' : 'btn-primary'}`} onClick={toggle} disabled={!stored.length}>
            {tampered ? <RotateCcw size={16} /> : <Pencil size={16} />}
            <span>{tampered ? t('chain.restore') : t('chain.tamper')}</span>
          </button>
        </div>
      </div>
    </section>
  )
}

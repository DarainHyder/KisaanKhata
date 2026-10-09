import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

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
const short = h => (h ? `${h.slice(0, 6)}…${h.slice(-4)}` : '……')

export default function HashChain() {
  const { t } = useI18n()
  const [stored, setStored] = useState([])
  const [current, setCurrent] = useState([])
  const [tampered, setTampered] = useState(false)

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
    setCurrent([await sha256(canonical(forged, 'GENESIS')), ...stored.slice(1)])
    setTampered(true)
  }

  return (
    <section id="integrity" className="section">
      <div className="container">
        <div className="split-head reveal">
          <div>
            <span className="kicker">{t('chain.eyebrow')}</span>
            <h2 className="display-md">{t('chain.title')}</h2>
          </div>
          <p className="lead">{t('chain.lead')}</p>
        </div>

        <div className="reveal">
        <div className={`ledger-table${tampered ? ' is-tampered' : ''}`} role="table">
          <div className="lt-row lt-head" role="row">
            <span role="columnheader">{t('chain.col.no')}</span>
            <span role="columnheader">{t('chain.col.entry')}</span>
            <span role="columnheader" className="num">{t('chain.col.amount')}</span>
            <span role="columnheader">{t('chain.col.prev')}</span>
            <span role="columnheader">{t('chain.col.hash')}</span>
            <span role="columnheader">{t('chain.col.status')}</span>
          </div>

          <div className="lt-row lt-genesis" role="row">
            <span>0</span>
            <span>{t('chain.genesis')}</span>
            <span className="num">—</span>
            <span className="mono">—</span>
            <span className="mono">GENESIS</span>
            <span className="lt-status ok">{t('chain.ok')}</span>
          </div>

          {ENTRIES.map((e, i) => {
            const edited = tampered && i === 0
            const broken = tampered && i > 0
            return (
              <div key={e.id} className={`lt-row${edited ? ' edited' : ''}${broken ? ' broken' : ''}`} role="row">
                <span>{e.id}</span>
                <span>{e.type === 'loan' ? t('chain.loan') : `${t('chain.sale')} · ${t(`chain.crops.${e.crop}`)}`}</span>
                <span className="num">
                  {edited ? (
                    <><s>{e.amount.toLocaleString('en-US')}</s><em className="ink">{TAMPERED_AMOUNT.toLocaleString('en-US')}</em></>
                  ) : e.amount.toLocaleString('en-US')}
                </span>
                <span className="mono prev">{i === 0 ? 'GENESIS' : short(stored[i - 1])}</span>
                <span className="mono hash">{short(current[i])}</span>
                <span className={`lt-status ${edited ? 'edited' : broken ? 'bad' : 'ok'}`}>
                  {edited ? t('chain.edited') : broken ? t('chain.bad') : t('chain.ok')}
                </span>
              </div>
            )
          })}

          {tampered && <div className="stamp stamp-underpaid table-stamp"><span className="stamp-main">{t('chain.stamp')}</span><span className="stamp-sub">#1 → #3</span></div>}
        </div>
        </div>

        <div className="chain-foot">
          <p className={`chain-verdict ${tampered ? 'bad' : 'ok'}`} aria-live="polite">
            {tampered ? t('chain.broken') : t('chain.intact', { count: ENTRIES.length })}
          </p>
          <button type="button" className={`btn ${tampered ? 'btn-line' : 'btn-solid'}`} onClick={toggle} disabled={!stored.length}>
            {tampered ? t('chain.restore') : t('chain.tamper')}
          </button>
        </div>
      </div>
    </section>
  )
}

import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

// Same rule as backend/services/price_matcher.py: within ±10% of the reference is fair.
const THRESHOLD = 0.10
const REFERENCE = 3900 // sample wheat reference, PKR per 40 kg
const MIN = 2400
const MAX = 5400
const STEP = 50

const fmt = n => Math.round(n).toLocaleString('en-US')
const pos = v => ((v - MIN) / (MAX - MIN)) * 100
const TICKS = Array.from({ length: (MAX - MIN) / 100 + 1 }, (_, i) => MIN + i * 100)

export default function FairPriceChecker() {
  const { t } = useI18n()
  const [paid, setPaid] = useState(3400)

  const diff = (paid - REFERENCE) / REFERENCE
  const status = diff < -THRESHOLD ? 'underpaid' : diff > THRESHOLD ? 'overpaid' : 'fair'
  const pct = Math.abs(diff * 100).toFixed(1)

  return (
    <section id="price-check" className="section t-dark price-section">
      <div className="container">
        <header className="section-head reveal">
          <div>
            <p className="eyebrow">{t('checker.eyebrow')}</p>
            <h2 className="h2">{t('checker.title')}</h2>
          </div>
          <p className="lead">{t('checker.lead')}</p>
        </header>

        <div className="price-grid">
          <figure className="photo-card reveal">
            <img src="/images/mandi.jpg" alt="" loading="lazy" />
            <figcaption>{t('checker.photoCaption')}</figcaption>
          </figure>


          <div className="instrument reveal reveal-d1">
          <div className="inst-readout">
            <div>
              <div className="inst-label">{t('checker.paid')} · {t('checker.perUnit')}</div>
              <div className="inst-value">
                <span className="inst-currency">PKR</span>{fmt(paid)}
              </div>
              <div className={`inst-delta tone-${status}`}>
                {diff >= 0 ? '+' : '−'}{pct}% <span>{t('checker.against', { ref: fmt(REFERENCE) })}</span>
              </div>
            </div>
            <div className="stamp-slot" aria-live="polite">
              <div key={status} className={`stamp stamp-${status}`}>
                <span className="stamp-main">{t(`checker.${status}.title`)}</span>
                <span className="stamp-sub">{diff >= 0 ? '+' : '−'}{pct}%</span>
              </div>
            </div>
          </div>

          <div className="ruler" dir="ltr">
            <div className="ruler-zones" aria-hidden="true">
              <i className="z-under" style={{ left: 0, width: `${pos(REFERENCE * (1 - THRESHOLD))}%` }} />
              <i className="z-fair" style={{ left: `${pos(REFERENCE * (1 - THRESHOLD))}%`, width: `${pos(REFERENCE * (1 + THRESHOLD)) - pos(REFERENCE * (1 - THRESHOLD))}%` }} />
              <i className="z-over" style={{ left: `${pos(REFERENCE * (1 + THRESHOLD))}%`, right: 0 }} />
            </div>
            <div className="ruler-ticks" aria-hidden="true">
              {TICKS.map(v => (
                <i key={v} className={v % 500 === 0 ? 'major' : ''} style={{ left: `${pos(v)}%` }}>
                  {v % 500 === 0 && <span>{fmt(v)}</span>}
                </i>
              ))}
            </div>
            <div className="ruler-ref" style={{ left: `${pos(REFERENCE)}%` }} aria-hidden="true">
              <span>{t('checker.mandi')} {fmt(REFERENCE)}</span>
            </div>
            <div className={`ruler-needle tone-${status}`} style={{ left: `${pos(paid)}%` }} aria-hidden="true">
              <span>{fmt(paid)}</span>
            </div>
            <input
              type="range"
              className="ruler-input"
              min={MIN}
              max={MAX}
              step={STEP}
              value={paid}
              onChange={e => setPaid(Number(e.target.value))}
              aria-label={t('checker.youGot')}
              aria-valuetext={`PKR ${fmt(paid)}`}
            />
          </div>

          <div className="inst-foot">
            <p>{t(`checker.${status}.desc`, { gap: fmt(Math.abs(paid - REFERENCE)), pct })}</p>
            <span className="inst-hint">↔ {t('checker.drag')}</span>
          </div>
            <p className="footnote">{t('checker.note')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

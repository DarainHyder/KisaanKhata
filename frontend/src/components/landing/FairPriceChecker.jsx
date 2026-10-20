import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useMandiBoard, fmtPKR, cityName } from '../../hooks/useMandi'

// Same rule as backend/services/price_matcher.py: within ±10% of the reference is fair.
const THRESHOLD = 0.10
const SAMPLE = { crop: 'wheat', avg: 3900, cities: [] } // used only if the live API is unreachable
const CHECK_CROPS = ['wheat', 'maize', 'cotton', 'potato', 'onion']

// Smallest round step at least n, so the ruler gets roughly 30 ticks.
const nice = n => [10, 25, 50, 100, 250, 500, 1000, 2500].find(s => s >= n) || 5000

export default function FairPriceChecker() {
  const { t } = useI18n()
  const board = useMandiBoard()
  const available = CHECK_CROPS.filter(c => board.crops[c])
  const [crop, setCrop] = useState('wheat')
  const data = board.crops[crop] || (board.status === 'live' ? board.crops[available[0]] : null) || SAMPLE
  const live = data !== SAMPLE
  const REF = data.avg

  // Ruler spans roughly ±45% around today's reference.
  const { MIN, MAX, STEP, ticks } = useMemo(() => {
    const step = nice((REF * 0.9) / 30)
    const min = Math.floor((REF * 0.55) / step) * step
    const max = Math.ceil((REF * 1.45) / step) * step
    const ticks = []
    for (let v = min; v <= max; v += step) ticks.push(v)
    return { MIN: min, MAX: max, STEP: Math.max(10, step / 5), ticks }
  }, [REF])
  const pos = v => ((Math.min(MAX, Math.max(MIN, v)) - MIN) / (MAX - MIN)) * 100

  const [paid, setPaid] = useState(3400)
  // Each new crop starts with an underpaid sale, the common case.
  useEffect(() => { setPaid(Math.round((REF * 0.78) / STEP) * STEP) }, [REF, STEP])

  const diff = (paid - REF) / REF
  const status = diff < -THRESHOLD ? 'underpaid' : diff > THRESHOLD ? 'overpaid' : 'fair'
  const pct = Math.abs(diff * 100).toFixed(1)
  // Label every round thousand (or the nearest round step for small prices).
  const major = ticks.length > 1 ? nice((ticks[1] - ticks[0]) * 4) : 1
  const age = data.ageHours

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
            {available.length > 1 && (
              <div className="crop-chips" role="tablist" aria-label={t('v4.checker.pick')}>
                {available.map(c => (
                  <button key={c} type="button" role="tab" aria-selected={c === data.crop} className={c === data.crop ? 'on' : ''} onClick={() => setCrop(c)}>
                    {t(`v4.crops.${c}`)}
                  </button>
                ))}
              </div>
            )}

            <div className="inst-readout">
              <div>
                <div className="inst-label">{t('checker.paid')} · {t('checker.perUnit')}</div>
                <div className="inst-value">
                  <span className="inst-currency">PKR</span>{fmtPKR(paid)}
                </div>
                <div className={`inst-delta tone-${status}`}>
                  {diff >= 0 ? '+' : '−'}{pct}% <span>{t('checker.against', { ref: fmtPKR(REF) })}</span>
                </div>
              </div>
              <div className="stamp-slot" aria-live="polite">
                <div key={status + data.crop} className={`stamp stamp-${status}`}>
                  <span className="stamp-main">{t(`checker.${status}.title`)}</span>
                  <span className="stamp-sub">{diff >= 0 ? '+' : '−'}{pct}%</span>
                </div>
              </div>
            </div>

            <div className="ruler" dir="ltr">
              <div className="ruler-zones" aria-hidden="true">
                <i className="z-under" style={{ left: 0, width: `${pos(REF * (1 - THRESHOLD))}%` }} />
                <i className="z-fair" style={{ left: `${pos(REF * (1 - THRESHOLD))}%`, width: `${pos(REF * (1 + THRESHOLD)) - pos(REF * (1 - THRESHOLD))}%` }} />
                <i className="z-over" style={{ left: `${pos(REF * (1 + THRESHOLD))}%`, right: 0 }} />
              </div>
              <div className="ruler-ticks" aria-hidden="true">
                {ticks.map(v => (
                  <i key={v} className={v % major === 0 ? 'major' : ''} style={{ left: `${pos(v)}%` }}>
                    {v % major === 0 && <span>{fmtPKR(v)}</span>}
                  </i>
                ))}
              </div>
              <div className="ruler-cities" aria-hidden="true">
                {data.cities.map(c => <i key={c.city} style={{ left: `${pos(c.fqp)}%` }} />)}
              </div>
              <div className="ruler-ref" style={{ left: `${pos(REF)}%` }} aria-hidden="true">
                <span>{t('checker.mandi')} {fmtPKR(REF)}</span>
              </div>
              <div className={`ruler-needle tone-${status}`} style={{ left: `${pos(paid)}%` }} aria-hidden="true">
                <span>{fmtPKR(paid)}</span>
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
                aria-valuetext={`PKR ${fmtPKR(paid)}`}
              />
            </div>

            {data.cities.length > 1 && (
              <p className="ruler-range">
                {t('v4.checker.range', {
                  lo: `${cityName(data.cities[data.cities.length - 1].city)} ${fmtPKR(data.cities[data.cities.length - 1].fqp)}`,
                  hi: `${cityName(data.cities[0].city)} ${fmtPKR(data.cities[0].fqp)}`,
                })}
              </p>
            )}

            <div className="inst-foot">
              <p>{t(`checker.${status}.desc`, { gap: fmtPKR(Math.abs(paid - REF)), pct })}</p>
              <span className="inst-hint">↔ {t('checker.drag')}</span>
            </div>
            <p className="footnote">
              {live ? (
                <><i className="live-dot" /> {t('v4.checker.live', { n: data.cities.length, h: age < 1 ? '<1' : Math.round(age) })} {data.cities.length > 0 && t('v4.checker.dots')}</>
              ) : t('checker.note')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

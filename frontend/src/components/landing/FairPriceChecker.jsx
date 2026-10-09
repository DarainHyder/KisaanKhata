import { useState } from 'react'
import { CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

// Same rule as backend/services/price_matcher.py: within ±10% of the reference is fair.
const THRESHOLD = 10
const REFERENCE = 3900 // sample wheat reference, PKR per 40 kg
const MIN = 2400
const MAX = 5400

const CX = 200, CY = 200, R = 160, SPAN = 40 // gauge covers -40% … +40%

function point(d, r = R) {
  const theta = (Math.max(-SPAN, Math.min(SPAN, d)) / SPAN) * (Math.PI / 2)
  return [CX + r * Math.sin(theta), CY - r * Math.cos(theta)]
}
function arc(d1, d2) {
  const [x1, y1] = point(d1)
  const [x2, y2] = point(d2)
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`
}

const fmt = n => Math.round(n).toLocaleString('en-US')

export default function FairPriceChecker() {
  const { t } = useI18n()
  const [paid, setPaid] = useState(3400)

  const diff = ((paid - REFERENCE) / REFERENCE) * 100
  const status = diff < -THRESHOLD ? 'underpaid' : diff > THRESHOLD ? 'overpaid' : 'fair'
  const Icon = status === 'fair' ? CheckCircle2 : status === 'underpaid' ? AlertTriangle : TrendingUp
  const angle = (Math.max(-SPAN, Math.min(SPAN, diff)) / SPAN) * 90

  const lo = ((REFERENCE * 0.9 - MIN) / (MAX - MIN)) * 100
  const hi = ((REFERENCE * 1.1 - MIN) / (MAX - MIN)) * 100

  return (
    <section id="price-check" className="section" style={{ background: 'linear-gradient(180deg, var(--bg), var(--bg-2) 50%, var(--bg))' }}>
      <div className="container checker">
        <div>
          <div className="section-head reveal" style={{ marginBottom: 28 }}>
            <span className="eyebrow">{t('checker.eyebrow')}</span>
            <h2 className="section-title">{t('checker.title')}</h2>
            <p className="section-lead">{t('checker.lead')}</p>
          </div>

          <div className="card checker-panel reveal reveal-d1">
            <div className="checker-ref">
              <span>{t('checker.reference')}</span>
              <strong className="num-mono">PKR {fmt(REFERENCE)} / 40 kg</strong>
            </div>

            <div className="checker-paid">
              <label htmlFor="paid-range" style={{ margin: 0 }}>{t('checker.youGot')}</label>
              <small>{t('checker.perUnit')}</small>
            </div>
            <div className="checker-paid">
              <span className="amount num-mono">PKR {fmt(paid)}</span>
              <span className={`status-chip status-${status}`}>
                {diff >= 0 ? '+' : '−'}{Math.abs(diff).toFixed(1)}%
              </span>
            </div>

            <input
              id="paid-range"
              type="range"
              className="price-range"
              min={MIN}
              max={MAX}
              step={50}
              value={paid}
              onChange={e => setPaid(Number(e.target.value))}
              style={{ '--fair-lo': `${lo}%`, '--fair-hi': `${hi}%` }}
              aria-valuetext={`PKR ${fmt(paid)}`}
            />
            <div className="range-scale"><span>PKR {fmt(MIN)}</span><span>PKR {fmt(MAX)}</span></div>

            <div className={`verdict-card verdict-${status}`} aria-live="polite">
              <Icon size={26} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div className="v-title">{t(`checker.${status}.title`)}</div>
                <p>{t(`checker.${status}.desc`, { gap: fmt(Math.abs(paid - REFERENCE)), pct: Math.abs(diff).toFixed(1) })}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="reveal reveal-d2">
          <svg className="gauge" viewBox="0 0 400 250" role="img" aria-label={t(`checker.${status}.title`)}>
            <path d={arc(-SPAN, SPAN)} stroke="rgba(206,226,190,0.08)" strokeWidth="34" fill="none" />
            <path d={arc(-SPAN, -THRESHOLD)} stroke="#FF6B4A" strokeWidth="22" fill="none" opacity={status === 'underpaid' ? 1 : 0.35} />
            <path d={arc(-THRESHOLD, THRESHOLD)} stroke="#7EDB6E" strokeWidth="22" fill="none" opacity={status === 'fair' ? 1 : 0.35} />
            <path d={arc(THRESHOLD, SPAN)} stroke="#F2B441" strokeWidth="22" fill="none" opacity={status === 'overpaid' ? 1 : 0.35} />
            {[-40, -20, -10, 0, 10, 20, 40].map(d => {
              const [x1, y1] = point(d, R - 22)
              const [x2, y2] = point(d, R - 34)
              const [tx, ty] = point(d, R - 54)
              const labelled = d === -40 || d === -10 || d === 10 || d === 40
              return (
                <g key={d}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(237,242,228,0.35)" strokeWidth="2" />
                  {labelled && (
                    <text x={tx} y={ty + 4} textAnchor="middle" fill="#9DAE98" fontSize="12" fontFamily="JetBrains Mono, monospace">
                      {d > 0 ? `+${d}` : d}%
                    </text>
                  )}
                </g>
              )
            })}
            <g className="gauge-needle" style={{ transform: `rotate(${angle}deg)` }}>
              <line x1={CX} y1={CY} x2={CX} y2={CY - R + 6} stroke="#EDF2E4" strokeWidth="4" strokeLinecap="round" />
            </g>
            <circle cx={CX} cy={CY} r="13" fill="#EDF2E4" />
            <circle cx={CX} cy={CY} r="5" fill="#08100B" />
            <text x={CX} y={CY + 42} textAnchor="middle" fill="#EDF2E4" fontSize="15" fontWeight="700" fontFamily="Manrope, sans-serif">
              {t('checker.gaugeLabel')}
            </text>
          </svg>
          <p className="checker-note">{t('checker.note')}</p>
        </div>
      </div>
    </section>
  )
}

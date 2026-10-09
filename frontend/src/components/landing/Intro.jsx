import { useEffect, useState } from 'react'
import { rootApi } from '../../api'
import { useI18n } from '../../i18n/useI18n'
import { useCountUp } from '../../hooks/motion'

function LiveNumber({ value, label }) {
  const v = useCountUp(value)
  return (
    <div className="live-item">
      <strong>{Math.round(v).toLocaleString('en-US')}</strong>
      <span>{label}</span>
    </div>
  )
}

export default function Intro() {
  const { t, raw } = useI18n()
  const [live, setLive] = useState(null)
  const facts = raw('intro.facts') || []

  useEffect(() => {
    let alive = true
    rootApi.get('/analytics/summary-report', { timeout: 20000 })
      .then(r => { if (alive) setLive(r.data) })
      .catch(() => { if (alive) setLive(false) })
    return () => { alive = false }
  }, [])

  return (
    <section className="section t-light intro" aria-labelledby="intro-title">
      <div className="container">
        <div className="intro-grid">
          <div className="intro-copy reveal">
            <p className="eyebrow">{t('intro.eyebrow')}</p>
            <h2 id="intro-title" className="h2">{t('intro.title')}</h2>
            <p className="lead">{t('intro.lead')}</p>
          </div>

          <div className="fact-grid">
            {facts.map((f, i) => (
              <div key={i} className={`fact reveal reveal-d${i % 4}`}>
                <span className="fact-value">{f.value}</span>
                <span className="fact-label">{f.label}</span>
              </div>
            ))}
            <p className="fact-source">{t('intro.sources')}</p>
          </div>
        </div>

        {live && (
          <div className="live-row">
            <span className="live-title"><i className="live-dot" />{t('intro.live')}</span>
            <LiveNumber value={live.total_farmers} label={t('stats.farmers')} />
            <LiveNumber value={live.total_ledger_entries} label={t('stats.entries')} />
            <LiveNumber value={live.sales_with_price_check} label={t('stats.checked')} />
            <LiveNumber value={live.sms_total_queries} label={t('stats.sms')} />
          </div>
        )}
      </div>
    </section>
  )
}

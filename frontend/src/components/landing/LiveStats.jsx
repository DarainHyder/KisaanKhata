import { useEffect, useState } from 'react'
import { rootApi } from '../../api'
import { useI18n } from '../../i18n/useI18n'
import { useCountUp } from '../../hooks/motion'

function Stat({ value, suffix = '', label, index }) {
  const v = useCountUp(value)
  return (
    <div className="stat">
      <span className="stat-index">{String(index + 1).padStart(2, '0')}</span>
      <div className="stat-value">{Math.round(v).toLocaleString('en-US')}<small>{suffix}</small></div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export default function LiveStats() {
  const { t } = useI18n()
  const [live, setLive] = useState(null)

  useEffect(() => {
    let alive = true
    rootApi.get('/analytics/summary-report', { timeout: 20000 })
      .then(r => { if (alive) setLive(r.data) })
      .catch(() => { if (alive) setLive(false) })
    return () => { alive = false }
  }, [])

  // Live numbers from the API when it is reachable; otherwise how the engine works.
  const items = live
    ? [
        { value: live.total_farmers, label: t('stats.farmers') },
        { value: live.total_ledger_entries, label: t('stats.entries') },
        { value: live.sales_with_price_check, label: t('stats.checked') },
        { value: live.sms_total_queries, label: t('stats.sms') },
      ]
    : [
        { value: 3, label: t('stats.tiers') },
        { value: 10, suffix: '%', label: t('stats.band') },
        { value: 6, suffix: 'h', label: t('stats.refresh') },
        { value: 256, label: t('stats.sha') },
      ]

  return (
    <section className="stats-band" aria-label={t('stats.aria')}>
      <div className="container">
        <div className="stats-grid">
          {items.map((it, i) => <Stat key={it.label} index={i} {...it} />)}
        </div>
        <div className="stats-note">
          {live ? <><span className="live-dot" />{t('stats.liveNote')}</> : t('stats.engineNote')}
        </div>
      </div>
    </section>
  )
}

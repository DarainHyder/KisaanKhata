import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n/useI18n'
import { useCountUp } from '../hooks/motion'
import { Wallet, Wheat, FileText, Mic, History, ArrowUpRight } from 'lucide-react'

function formatPKR(n) {
  const v = Number(n) || 0
  return `${v < 0 ? '−' : ''}PKR ${Math.abs(v).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
}

export default function Dashboard({ farmer }) {
  const { t } = useI18n()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    api.get(`/ledger/${farmer.id}/summary`)
      .then(r => setSummary(r.data))
      .catch(e => setError(e.response?.data?.detail || t('dashboard.loadError')))
      .finally(() => setLoading(false))
  }, [farmer.id, t])

  const net = useCountUp(summary ? summary.net_balance : null)
  const loans = summary?.total_loans || 0
  const sales = summary?.total_sales || 0
  const flow = loans + sales || 1
  const positive = (summary?.net_balance ?? 0) >= 0

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">{t('dashboard.title')}</span>
        <h1 className="page-title" style={{ marginTop: 10 }}>{t('dashboard.greeting', { name: farmer.name })}</h1>
        {farmer.location && (
          <p className="page-subtitle">{t('dashboard.location')}: <strong>{farmer.location}</strong> · {t('history.farmerId')} <strong>#{farmer.id}</strong></p>
        )}
      </div>

      {loading && <div className="spinner" />}
      {error && <div className="alert alert-error">{error}</div>}

      {summary && (
        <>
          <div className="card balance-card" style={{ '--balance-glow': positive ? 'rgba(126,219,110,0.22)' : 'rgba(255,107,74,0.22)' }}>
            <div className="balance-label">{t('dashboard.netBalance')}</div>
            <div className={`balance-value num-mono ${positive ? 'positive' : 'negative'}`}>{formatPKR(net)}</div>
            <p className="balance-msg">{summary.message}</p>
          </div>

          <div className="summary-grid">
            <div className="summary-tile">
              <div className="tile-label"><Wallet size={16} color="var(--brick)" />{t('dashboard.totalLoans')}</div>
              <div className="tile-value negative">{formatPKR(loans)}</div>
            </div>
            <div className="summary-tile">
              <div className="tile-label"><Wheat size={16} color="var(--sprout)" />{t('dashboard.salesIncome')}</div>
              <div className="tile-value positive">{formatPKR(sales)}</div>
            </div>
            <div className="summary-tile full">
              <div className="tile-label"><FileText size={16} color="var(--wheat)" />{t('dashboard.totalEntries')}</div>
              <div className="tile-value neutral">{summary.entry_count} {t('dashboard.entriesRecorded')}</div>
              <div className="tile-bar" aria-hidden="true">
                <span style={{ width: `${(loans / flow) * 100}%`, background: 'var(--brick)' }} />
                <span style={{ width: `${(sales / flow) * 100}%`, background: 'var(--sprout)' }} />
              </div>
            </div>
          </div>
        </>
      )}

      <div className="action-grid">
        <button className="action-card primary" onClick={() => navigate('/voice')}>
          <div className="ac-icon"><Mic size={22} /></div>
          <strong>{t('dashboard.recordVoice')}</strong>
          <span>{t('dashboard.recordVoiceHint')}</span>
        </button>
        <button className="action-card" onClick={() => navigate('/history')}>
          <div className="ac-icon"><History size={22} /></div>
          <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t('dashboard.viewHistory')}<ArrowUpRight size={18} /></strong>
          <span>{t('dashboard.viewHistoryHint')}</span>
        </button>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n/useI18n'
import { BarChart3, Wallet, Wheat, FileText, Mic, History } from 'lucide-react'

function formatPKR(n) {
  if (n === null || n === undefined) return '0'
  return `PKR ${Number(n).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
}

export default function Dashboard({ farmer }) {
  const { t } = useI18n()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    api.get(`/ledger/${farmer.id}/summary`)
      .then(r => setSummary(r.data))
      .catch(e => setError(e.response?.data?.detail || t('dashboard.loadError')))
      .finally(() => setLoading(false))
  }, [farmer.id, t])

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BarChart3 size={24} color="var(--accent-gold)" />
          <span>{t('dashboard.title')}</span>
        </h1>
        <p className="page-subtitle">
          {t('dashboard.farmer')}: <strong>{farmer.name}</strong>. {t('dashboard.location')}: <strong>{farmer.location}</strong>
        </p>
      </div>

      {loading && <div className="spinner" />}
      {error   && <div className="alert alert-error">{error}</div>}

      {summary && (
        <>
          {/* Net balance section */}
          <div
            className="card"
            style={{
              backgroundColor: summary.net_balance >= 0 ? 'rgba(63, 107, 63, 0.12)' : 'rgba(168, 50, 50, 0.12)',
              borderLeft: `6px solid ${summary.net_balance >= 0 ? "var(--status-fair)" : "var(--status-underpaid)"}`,
              borderTop: '1px solid var(--soil-brown)',
              borderRight: '1px solid var(--soil-brown)',
              borderBottom: '1px solid var(--soil-brown)',
            }}
          >
            <div className="tile-label" style={{ color: 'var(--soil-brown)' }}>{t('dashboard.netBalance')}</div>
            <div className={`tile-value ${summary.net_balance >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '2rem', marginTop: 4 }}>
              {formatPKR(summary.net_balance)}
            </div>
            <p style={{ fontSize: '.88rem', marginTop: 8, color: 'var(--text)', fontWeight: 500 }}>
              {summary.message}
            </p>
          </div>

          {/* Summary ledger grid */}
          <div className="summary-grid">
            <div className="summary-tile">
              <div className="tile-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wallet size={16} color="var(--status-underpaid)" />
                <span>{t('dashboard.totalLoans')}</span>
              </div>
              <div className="tile-value negative">{formatPKR(summary.total_loans)}</div>
            </div>

            <div className="summary-tile">
              <div className="tile-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wheat size={16} color="var(--status-fair)" />
                <span>{t('dashboard.salesIncome')}</span>
              </div>
              <div className="tile-value positive">{formatPKR(summary.total_sales)}</div>
            </div>

            <div className="summary-tile full">
              <div className="tile-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={16} color="var(--accent-dusk)" />
                <span>{t('dashboard.totalEntries')}</span>
              </div>
              <div className="tile-value neutral">{summary.entry_count} {t('dashboard.entriesRecorded')}</div>
            </div>
          </div>
        </>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => navigate('/voice')}>
          <Mic size={18} />
          <span>{t('dashboard.recordVoice')}</span>
        </button>
        <button className="btn btn-outline" onClick={() => navigate('/history')}>
          <History size={18} />
          <span>{t('dashboard.viewHistory')}</span>
        </button>
      </div>
    </div>
  )
}

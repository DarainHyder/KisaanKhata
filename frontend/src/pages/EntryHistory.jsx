import { useEffect, useState } from 'react'
import api from '../api'
import { useI18n } from '../i18n/useI18n'
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  HelpCircle,
  ShieldCheck,
  Wallet,
  Wheat
} from 'lucide-react'

function formatPKR(n) {
  if (!n && n !== 0) return '0'
  return `PKR ${Number(n).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
}

function formatDate(d) {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PriceCheckIndicator({ entryId, t }) {
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.get(`/price-check/${entryId}`)
      .then(r => setResult(r.data))
      .catch(() => setResult({ status: 'no_data' }))
  }, [entryId])

  if (!result) return null

  const statusKey = result.status || 'no_data'
  const map = {
    fair:      { statusCls: 'status-bar-fair',      textCls: 'status-text-fair',      label: t('history.status.fair'), Icon: CheckCircle2 },
    underpaid: { statusCls: 'status-bar-underpaid', textCls: 'status-text-underpaid', label: t('history.status.underpaid'), Icon: AlertTriangle },
    overpaid:  { statusCls: 'status-bar-overpaid',  textCls: 'status-text-overpaid',  label: t('history.status.overpaid'), Icon: TrendingUp },
    no_data:   { statusCls: 'status-bar-nodata',    textCls: 'status-text-nodata',    label: t('history.status.noData'), Icon: HelpCircle },
  }
  const { statusCls, textCls, label, Icon } = map[statusKey] || map.no_data

  return (
    <>
      <div className={`status-bar-indicator ${statusCls}`} />

      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span className={`status-text-mono ${textCls}`}>
          <Icon size={14} />
          <span>{label}</span>
        </span>
        {result.reference_price && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.78rem', color: 'var(--soil-brown)' }}>
            Ref: {formatPKR(result.reference_price)} ({result.data_freshness})
          </span>
        )}
      </div>
    </>
  )
}

export default function EntryHistory({ farmer }) {
  const { t } = useI18n()
  const [entries, setEntries] = useState([])
  const [integrity, setIntegrity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filter, setFilter]   = useState('all') // 'all' | 'loan' | 'sale'

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/ledger/${farmer.id}`),
      api.get(`/ledger/${farmer.id}/verify`).catch(() => null)
    ])
      .then(([entriesRes, verifyRes]) => {
        setEntries(entriesRes.data)
        if (verifyRes) setIntegrity(verifyRes.data)
      })
      .catch(e => setError(e.response?.data?.detail || t('history.loadError')))
      .finally(() => setLoading(false))
  }, [farmer.id, t])

  const filtered = entries.filter(e => filter === 'all' || e.entry_type === filter)

  const filterLabels = {
    all: t('history.allEntries'),
    loan: t('history.loans'),
    sale: t('history.sales'),
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={24} color="var(--accent-gold)" />
          <span>{t('history.title')}</span>
        </h1>
        <p className="page-subtitle">
          {t('history.farmerId')}: <strong>#{farmer.id}</strong>. {farmer.name}
        </p>
      </div>

      {/* Integrity Chain Status Stamp */}
      {integrity && (
        <div
          className="alert"
          style={{
            backgroundColor: integrity.verified ? 'rgba(63, 107, 63, 0.12)' : 'rgba(168, 50, 50, 0.12)',
            borderColor: integrity.verified ? 'var(--status-fair)' : 'var(--status-underpaid)',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            padding: '10px 14px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}
        >
          {integrity.verified ? (
            <>
              <ShieldCheck size={20} color="var(--status-fair)" style={{ flexShrink: 0 }} />
              <div>
                <strong>{t('history.hashIntact')}</strong>. {t('history.hashIntactDetail', { count: integrity.total_entries })}
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={20} color="var(--status-underpaid)" style={{ flexShrink: 0 }} />
              <div>
                <strong>{t('history.tamperDetected', { id: integrity.broken_at_entry })}</strong>. {integrity.detail}
              </div>
            </>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'loan', 'sale'].map(f => (
          <button
            key={f}
            type="button"
            className={`btn ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '10px', fontSize: '.9rem' }}
            onClick={() => setFilter(f)}
          >
            <span>{filterLabels[f]}</span>
          </button>
        ))}
      </div>

      {loading && <div className="spinner" />}
      {error   && <div className="alert alert-error">{error}</div>}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
            <FileText size={40} color="var(--soil-brown)" />
          </div>
          <div style={{ marginTop: 8 }}>{t('history.noEntries', { type: filter === 'all' ? '' : filterLabels[filter].toLowerCase() })}</div>
        </div>
      )}

      {/* Ruled Notebook Ledger Lines */}
      <div style={{ borderTop: 'var(--ledger-line-strong)', borderBottom: 'var(--ledger-line-strong)', marginBottom: 24 }}>
        {filtered.map(entry => (
          <div key={entry.id} className="ledger-row">
            {entry.entry_type === 'sale' && entry.reported_price_per_unit ? (
              <PriceCheckIndicator entryId={entry.id} t={t} />
            ) : (
              <div className="status-bar-indicator status-bar-nodata" />
            )}

            <div style={{ flex: 1, paddingLeft: 8 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {entry.entry_type === 'loan' ? (
                  <>
                    <Wallet size={16} color="var(--status-underpaid)" />
                    <span>{t('history.loanReceived')}</span>
                  </>
                ) : (
                  <>
                    <Wheat size={16} color="var(--status-fair)" />
                    <span>{t('history.harvestSale')}: {entry.crop_name || t('history.cropFallback')}</span>
                  </>
                )}
              </div>

              <div style={{ fontSize: '.84rem', color: 'var(--soil-brown)', marginTop: 2 }}>
                {formatDate(entry.date)} . {t('history.unit')}: {entry.unit}
                {entry.reported_price_per_unit && (
                  <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
                    (@{formatPKR(entry.reported_price_per_unit)}/{entry.unit})
                  </span>
                )}
              </div>
            </div>

            <div
              className="num-mono"
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: entry.entry_type === 'loan' ? 'var(--status-underpaid)' : 'var(--status-fair)',
                textAlign: 'right',
                whiteSpace: 'nowrap',
                paddingLeft: 12
              }}
            >
              {entry.entry_type === 'loan' ? '−' : '+'}{formatPKR(entry.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

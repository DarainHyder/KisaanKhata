import { useEffect, useState } from 'react'
import api from '../api'
import { useI18n } from '../i18n/useI18n'
import {
  FileText, CheckCircle2, AlertTriangle, TrendingUp, HelpCircle, ShieldCheck, ShieldAlert, Wallet, Wheat, Link2,
} from 'lucide-react'

function formatPKR(n) {
  if (!n && n !== 0) return '0'
  return `PKR ${Number(n).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
}

function formatDate(d) {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
}

const short = h => (h && h !== 'GENESIS' ? `${h.slice(0, 6)}…${h.slice(-4)}` : h || '—')

function PriceCheck({ entryId, t }) {
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.get(`/price-check/${entryId}`)
      .then(r => setResult(r.data))
      .catch(() => setResult({ status: 'no_data' }))
  }, [entryId])

  if (!result) return <span className="status-chip status-nodata">…</span>

  const map = {
    fair: { cls: 'status-fair', label: t('history.status.fair'), Icon: CheckCircle2 },
    underpaid: { cls: 'status-underpaid', label: t('history.status.underpaid'), Icon: AlertTriangle },
    overpaid: { cls: 'status-overpaid', label: t('history.status.overpaid'), Icon: TrendingUp },
    no_data: { cls: 'status-nodata', label: t('history.status.noData'), Icon: HelpCircle },
  }
  const { cls, label, Icon } = map[result.status] || map.no_data

  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <span className={`status-chip ${cls}`}>
        <Icon size={13} />{label}
        {result.difference_percent != null && result.status !== 'no_data' && (
          <> {result.difference_percent > 0 ? '+' : ''}{result.difference_percent}%</>
        )}
      </span>
      {result.reference_price && (
        <span className="ref-price">{t('history.ref')}: {formatPKR(result.reference_price)} ({result.data_freshness})</span>
      )}
    </span>
  )
}

export default function EntryHistory({ farmer }) {
  const { t } = useI18n()
  const [entries, setEntries] = useState([])
  const [integrity, setIntegrity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'loan' | 'sale'

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/ledger/${farmer.id}`),
      api.get(`/ledger/${farmer.id}/verify`).catch(() => null),
    ])
      .then(([entriesRes, verifyRes]) => {
        setEntries(entriesRes.data)
        if (verifyRes) setIntegrity(verifyRes.data)
      })
      .catch(e => setError(e.response?.data?.detail || t('history.loadError')))
      .finally(() => setLoading(false))
  }, [farmer.id, t])

  const filtered = entries.filter(e => filter === 'all' || e.entry_type === filter)
  const filterLabels = { all: t('history.allEntries'), loan: t('history.loans'), sale: t('history.sales') }

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">{t('history.farmerId')} #{farmer.id}</span>
        <h1 className="page-title" style={{ marginTop: 10 }}>{t('history.title')}</h1>
        <p className="page-subtitle">{farmer.name}</p>
      </div>

      {integrity && (
        <div className={`integrity-stamp ${integrity.verified ? 'ok' : 'bad'}`}>
          {integrity.verified
            ? <ShieldCheck size={22} color="var(--sprout)" style={{ flexShrink: 0 }} />
            : <ShieldAlert size={22} color="var(--brick)" style={{ flexShrink: 0 }} />}
          <div>
            {integrity.verified ? (
              <><strong style={{ color: 'var(--sprout)' }}>{t('history.hashIntact')}</strong><br />{t('history.hashIntactDetail', { count: integrity.total_entries })}</>
            ) : (
              <><strong style={{ color: 'var(--brick)' }}>{t('history.tamperDetected', { id: integrity.broken_at_entry })}</strong><br />{integrity.detail}</>
            )}
          </div>
        </div>
      )}

      <div className="segmented">
        {['all', 'loan', 'sale'].map(f => (
          <button key={f} type="button" className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {loading && <div className="spinner" />}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <FileText size={40} />
          <div>{t('history.noEntries', { type: filter === 'all' ? '' : filterLabels[filter].toLowerCase() })}</div>
        </div>
      )}

      <div className="ledger-list">
        {filtered.map((entry, i) => {
          const isLoan = entry.entry_type === 'loan'
          return (
            <div key={entry.id} className="ledger-row" style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}>
              <div className={`lr-icon ${isLoan ? 'loan' : 'sale'}`}>{isLoan ? <Wallet size={20} /> : <Wheat size={20} />}</div>
              <div style={{ minWidth: 0 }}>
                <div className="lr-title">
                  {isLoan ? t('history.loanReceived') : `${t('history.harvestSale')}: ${entry.crop_name || t('history.cropFallback')}`}
                </div>
                <div className="lr-meta">
                  {formatDate(entry.date)} · {t('history.unit')}: {entry.unit}
                  {entry.reported_price_per_unit && <span className="num-mono"> · @{formatPKR(entry.reported_price_per_unit)}</span>}
                </div>
              </div>
              <div className={`lr-amount ${isLoan ? 'negative' : 'positive'}`}>{isLoan ? '−' : '+'}{formatPKR(entry.amount)}</div>

              <div className="lr-foot">
                {!isLoan && entry.reported_price_per_unit
                  ? <PriceCheck entryId={entry.id} t={t} />
                  : <span className="status-chip status-nodata">{t('history.noPriceCheck')}</span>}
                <span className="lr-hash"><Link2 size={11} style={{ verticalAlign: '-1px' }} /> <b>{short(entry.entry_hash)}</b> ← {short(entry.previous_hash)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

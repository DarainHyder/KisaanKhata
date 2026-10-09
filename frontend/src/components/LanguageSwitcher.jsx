import { useI18n } from '../i18n/useI18n'
import { Globe } from 'lucide-react'

export default function LanguageSwitcher({ variant = 'default' }) {
  const { lang, setLang, t, languages } = useI18n()
  const isCompact = variant === 'compact'

  return (
    <div className={`language-switcher${isCompact ? ' compact' : ''}`} style={isCompact ? { alignSelf: 'flex-start', marginBottom: 8 } : undefined}>
      <Globe size={16} />
      <select value={lang} onChange={e => setLang(e.target.value)} aria-label={t('language.select')}>
        {Object.entries(languages).map(([code, meta]) => (
          <option key={code} value={code}>{meta.label}</option>
        ))}
      </select>
    </div>
  )
}

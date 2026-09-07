import { useI18n } from '../i18n/useI18n'
import { Globe } from 'lucide-react'

export default function LanguageSwitcher({ variant = 'default' }) {
  const { lang, setLang, t, languages } = useI18n()
  const isCompact = variant === 'compact'

  return (
    <div className={`language-switcher ${isCompact ? 'compact' : ''}`}>
      <Globe size={isCompact ? 16 : 18} />
      {!isCompact && <span className="language-label">{t('language.label')}</span>}
      <select
        value={lang}
        onChange={e => setLang(e.target.value)}
        aria-label={t('language.select')}
      >
        {Object.entries(languages).map(([code, meta]) => (
          <option key={code} value={code}>
            {meta.label}
          </option>
        ))}
      </select>
    </div>
  )
}

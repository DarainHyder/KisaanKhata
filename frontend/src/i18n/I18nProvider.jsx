import { useState, useEffect, useCallback, useMemo } from 'react'
import translations, { LANGUAGES, DEFAULT_LANGUAGE } from './translations'
import { I18nContext } from './I18nContext'

const STORAGE_KEY = 'kk_language'

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_LANGUAGE
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE
  })

  useEffect(() => {
    if (typeof document === 'undefined') return
    const meta = LANGUAGES[lang]
    document.documentElement.lang = lang
    document.documentElement.dir = meta.dir
    localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const t = useCallback(
    function translate(key, vars = {}) {
      const keys = key.split('.')
      let value = translations[lang]
      for (const k of keys) {
        if (value === undefined || value === null) break
        value = value[k]
      }
      if (value === undefined || value === null) {
        value = translations[DEFAULT_LANGUAGE]
        for (const k of keys) {
          if (value === undefined || value === null) break
          value = value[k]
        }
      }
      if (typeof value !== 'string') return key
      return value.replace(/\{\{(\w+)\}\}/g, (_, name) =>
        vars[name] !== undefined ? String(vars[name]) : `{{${name}}}`
      )
    },
    [lang]
  )

  const value = useMemo(
    () => ({ lang, setLang, t, dir: LANGUAGES[lang].dir, languages: LANGUAGES }),
    [lang, t]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

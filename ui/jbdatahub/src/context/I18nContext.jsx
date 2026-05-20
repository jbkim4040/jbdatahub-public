import { createContext, useContext, useState, useCallback } from 'react'
import { translations, LANGS } from '../i18n/translations'

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('lang')
    return LANGS.includes(saved) ? saved : 'ko'
  })

  const t = useCallback(
    (key) => translations[lang]?.[key] ?? translations.ko[key] ?? key,
    [lang]
  )

  const changeLang = useCallback((l) => {
    if (!LANGS.includes(l)) return
    setLang(l)
    localStorage.setItem('lang', l)
    document.documentElement.lang = l
  }, [])

  return (
    <I18nContext.Provider value={{ lang, t, changeLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

import { useRef } from 'react'
import { HandCoins, Smartphone, Mic } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import { useScrollTimeline } from '../../hooks/motion'

export default function Hero({ onCta }) {
  const { t, lang } = useI18n()
  const sectionRef = useRef(null)
  const photoRef = useRef(null)
  const bodyRef = useRef(null)

  // Slow parallax on the photograph; the copy lifts away as you scroll.
  useScrollTimeline(sectionRef, p => {
    const q = Math.max(0, (p - 0.5) * 2)
    if (photoRef.current) photoRef.current.style.transform = `translateY(${q * 12}%) scale(${1.06 + q * 0.04})`
    if (bodyRef.current) {
      bodyRef.current.style.transform = `translateY(${-q * 40}px)`
      bodyRef.current.style.opacity = String(1 - q * 1.2)
    }
  }, { smoothing: 0.18 })

  // First sentence in white, the promise in italic amber.
  const [first, ...rest] = t('hero.headline').split(/(?<=[.。۔])\s*/).filter(Boolean)

  const facts = [
    ['free', HandCoins],
    ['phone', Smartphone],
    ['voice', Mic],
  ]

  return (
    <section id="hero" className="hero" ref={sectionRef}>
      <div className="hero-photo">
        <picture>
          <source media="(max-width: 800px)" srcSet="/images/hero-tractor-1200.jpg" />
          <img ref={photoRef} src="/images/hero-tractor.jpg" alt="" fetchPriority="high" />
        </picture>
      </div>
      <div className="hero-scrim" />

      <div className="container hero-body" ref={bodyRef} key={lang}>
        <p className="eyebrow eyebrow-light">{t('hero.eyebrow')}</p>
        <h1 className="hero-title">
          <span className="line">{first}</span>
          {rest.length > 0 && <em className="line">{rest.join(' ')}</em>}
        </h1>
        <p className="hero-ur" lang="ur" dir="rtl">{t('hero.slogan')}</p>
        <p className="hero-sub">{t('hero.sub')}</p>
        <div className="hero-actions">
          <a href="#khata-form" className="btn btn-amber" onClick={onCta}>
            {t('hero.cta')} <span className="arrow" aria-hidden="true">→</span>
          </a>
          <a href="#features" className="btn btn-glass">{t('hero.secondary')}</a>
        </div>
      </div>

      <div className="container hero-foot">
        <ul className="hero-facts">
          {facts.map(([k, Icon]) => (
            <li key={k}>
              <Icon size={20} strokeWidth={1.75} />
              <div>
                <strong>{t(`hero.facts.${k}.title`)}</strong>
                <span>{t(`hero.facts.${k}.desc`)}</span>
              </div>
            </li>
          ))}
        </ul>
        <span className="hero-credit">{t('hero.credit')}</span>
      </div>
    </section>
  )
}

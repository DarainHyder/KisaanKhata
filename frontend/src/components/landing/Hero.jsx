import { useRef } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useScrollTimeline } from '../../hooks/motion'

// Crop words the SMS parser accepts (backend/services/sms_service.py CROP_ALIASES).
const CROPS = [
  ['gandum', 'wheat'], ['chawal', 'rice'], ['kapas', 'cotton'], ['makka', 'maize'], ['aloo', 'potato'],
  ['pyaz', 'onion'], ['tamatar', 'tomato'], ['ganna', 'sugarcane'], ['sarson', 'canola'], ['chana', 'chickpea'],
  ['lehsan', 'garlic'], ['gajar', 'carrot'], ['aam', 'mango'], ['amrood', 'guava'], ['moongphali', 'groundnut'],
]

export default function Hero({ onCta }) {
  const { t, lang } = useI18n()
  const sectionRef = useRef(null)
  const mediaRef = useRef(null)
  const innerRef = useRef(null)

  useScrollTimeline(sectionRef, p => {
    const q = Math.max(0, (p - 0.5) * 2)
    if (mediaRef.current) mediaRef.current.style.transform = `translateY(${q * 14}%) scale(${1.04 + q * 0.06})`
    if (innerRef.current) innerRef.current.style.transform = `translateY(${-q * 50}px)`
  }, { smoothing: 0.18 })

  // The last sentence of the headline is set in italic gold.
  const sentences = t('hero.headline').split(/(?<=[.。۔])\s*/).filter(Boolean)
  let w = 0

  return (
    <section id="hero" className="hero" ref={sectionRef}>
      <div className="hero-media" ref={mediaRef}>
        <img src="/images/hero-farm.jpg" alt="" fetchPriority="high" />
      </div>
      <div className="hero-shade" />

      <div className="container hero-inner" ref={innerRef}>
        <div className="hero-meta">
          <span className="kicker">{t('hero.kicker')}</span>
          <span className="hero-coords">30.1575° N · 71.5249° E</span>
        </div>

        <h1 className="hero-title" key={lang}>
          {sentences.map((s, si) => (
            <span key={si} className={si === sentences.length - 1 && sentences.length > 1 ? 'accent' : ''}>
              {s.split(' ').map((word, i, arr) => (
                <span key={i} className="word" style={{ animationDelay: `${0.1 + (w++) * 0.06}s` }}>
                  {word}{i < arr.length - 1 || si < sentences.length - 1 ? ' ' : ''}
                </span>
              ))}
            </span>
          ))}
        </h1>

        <div className="hero-foot">
          <p className="hero-sub">{t('hero.sub')}</p>
          <div className="hero-actions">
            <a href="#khata-form" className="btn btn-solid" onClick={onCta}>
              {t('hero.cta')} <span className="arrow" aria-hidden="true">→</span>
            </a>
            <a href="#features" className="link-under">{t('hero.down')} <span aria-hidden="true">↓</span></a>
          </div>
        </div>
      </div>

      <div className="ticker" aria-label={t('hero.tickerLabel')}>
        <span className="ticker-label">{t('hero.tickerLabel')}</span>
        <div className="ticker-window" dir="ltr">
          <div className="ticker-track">
            {[0, 1].map(copy => (
              <span key={copy} className="ticker-set" aria-hidden={copy === 1}>
                {CROPS.map(([ur, en]) => (
                  <span key={ur} className="ticker-item"><b>{ur.toUpperCase()}</b> {en}</span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

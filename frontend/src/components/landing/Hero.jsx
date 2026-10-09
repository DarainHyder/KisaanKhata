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
  const photoRef = useRef(null)

  useScrollTimeline(sectionRef, p => {
    const q = Math.max(0, (p - 0.5) * 2)
    if (photoRef.current) photoRef.current.style.transform = `translateY(${q * -8}%) scale(${1.08 - q * 0.04})`
  }, { smoothing: 0.18 })

  // The last sentence of the headline is set in field green.
  const sentences = t('hero.headline').split(/(?<=[.。۔])\s*/).filter(Boolean)
  let w = 0

  return (
    <section id="hero" className="hero theme-mustard" ref={sectionRef}>
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="hero-meta">
            <span className="kicker">{t('hero.kicker')}</span>
          </div>

          <h1 className="hero-title" key={lang}>
            {sentences.map((s, si) => (
              <span key={si} className={si === sentences.length - 1 && sentences.length > 1 ? 'accent' : ''}>
                {s.split(' ').map((word, i, arr) => (
                  <span key={i} className="word" style={{ animationDelay: `${0.08 + (w++) * 0.05}s` }}>
                    {word}{i < arr.length - 1 || si < sentences.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p className="hero-slogan">
            <span className="slogan-ur" lang="ur" dir="rtl">{t('hero.slogan')}</span>
            {lang !== 'ur' && <span className="slogan-gloss">{t('hero.sloganGloss')}</span>}
          </p>
          <p className="hero-sub">{t('hero.sub')}</p>
          <div className="hero-actions">
            <a href="#khata-form" className="btn btn-solid" onClick={onCta}>
              {t('hero.cta')} <span className="arrow" aria-hidden="true">→</span>
            </a>
            <a href="#features" className="link-under">{t('hero.down')} <span aria-hidden="true">↓</span></a>
          </div>
        </div>

        <figure className="hero-figure">
          <div className="duotone">
            <img ref={photoRef} src="/images/hero-farm.jpg" alt="" fetchPriority="high" />
          </div>
          <span className="hero-urdu" lang="ur" dir="rtl" aria-hidden="true">کسان کھاتہ</span>
          <figcaption>
            <span>{t('hero.figure')}</span>
            <span>30.16° N · 71.52° E</span>
          </figcaption>
          <div className="stamp stamp-bad hero-stamp" aria-hidden="true">
            <span className="stamp-main">{t('hero.stampMain')}</span>
            <span className="stamp-sub">{t('hero.stampSub')}</span>
          </div>
        </figure>
      </div>

      <div className="ticker theme-soil" aria-label={t('hero.tickerLabel')}>
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

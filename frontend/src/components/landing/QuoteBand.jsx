import { useRef } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useScrollTimeline } from '../../hooks/motion'

export default function QuoteBand() {
  const { t } = useI18n()
  const sectionRef = useRef(null)
  const photoRef = useRef(null)

  useScrollTimeline(sectionRef, p => {
    if (photoRef.current) photoRef.current.style.transform = `translateY(${(p - 0.5) * -14}%) scale(1.18)`
  }, { smoothing: 0.16 })

  return (
    <section className="quote-band" ref={sectionRef}>
      <img ref={photoRef} src="/images/wheat-gold.jpg" alt="" loading="lazy" />
      <div className="quote-scrim" />
      <div className="container quote-body reveal">
        <p className="quote-ur" lang="ur" dir="rtl">{t('hero.slogan')}</p>
        <p className="quote-en">{t('quote.line')}</p>
      </div>
      <span className="quote-credit">{t('quote.credit')}</span>
    </section>
  )
}

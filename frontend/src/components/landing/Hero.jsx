import { useRef } from 'react'
import { ArrowRight, Mic, ShieldCheck, MessageSquareText, Scale } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import { useScrollTimeline } from '../../hooks/motion'

export default function Hero({ onCta }) {
  const { t, lang } = useI18n()
  const sectionRef = useRef(null)
  const mediaRef = useRef(null)
  const innerRef = useRef(null)

  // Parallax: the field drifts slower than the page, the copy lifts and fades.
  useScrollTimeline(sectionRef, p => {
    const q = Math.max(0, (p - 0.5) * 2)
    if (mediaRef.current) mediaRef.current.style.transform = `translateY(${q * 18}%) scale(${1 + q * 0.08})`
    if (innerRef.current) {
      innerRef.current.style.transform = `translateY(${-q * 60}px)`
      innerRef.current.style.opacity = 1 - q * 1.3
    }
  }, { smoothing: 0.18 })

  const words = t('hero.headline').split(' ')

  return (
    <section id="hero" className="hero" ref={sectionRef}>
      <div className="hero-media" ref={mediaRef}>
        <img src="/images/hero-farm.jpg" alt="" fetchPriority="high" />
      </div>
      <div className="hero-shade" />

      <div className="container hero-inner" ref={innerRef}>
        <span className="eyebrow">{t('hero.eyebrow')}</span>
        <h1 className="hero-title" key={lang}>
          {words.map((w, i) => (
            <span key={i} className="word" style={{ animationDelay: `${0.15 + i * 0.07}s` }}>
              {w}{i < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </h1>
        <p className="hero-sub">{t('hero.sub')}</p>
        <div className="hero-actions">
          <a href="#khata-form" className="btn btn-primary" onClick={onCta}>
            <span>{t('hero.cta')}</span>
            <ArrowRight size={18} className="flip-rtl" />
          </a>
          <a href="#features" className="btn btn-outline">{t('hero.secondary')}</a>
        </div>
        <div className="hero-badges">
          <span className="hero-badge"><Mic size={15} />{t('hero.badges.voice')}</span>
          <span className="hero-badge"><Scale size={15} />{t('hero.badges.price')}</span>
          <span className="hero-badge"><ShieldCheck size={15} />{t('hero.badges.hash')}</span>
          <span className="hero-badge"><MessageSquareText size={15} />{t('hero.badges.sms')}</span>
        </div>
      </div>

      <div className="scroll-cue" aria-hidden="true">
        <span>{t('hero.scroll')}</span>
        <span className="track" />
      </div>
    </section>
  )
}

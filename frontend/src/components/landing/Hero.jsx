import { useCallback, useMemo, useRef } from 'react'
import { HandCoins, Smartphone, Mic, ArrowDown } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import { useScrollTimeline, range, lerp, easeInOutCubic, easeOutCubic, prefersReducedMotion } from '../../hooks/motion'
import { scrollToSection } from '../../hooks/smoothScroll'

/*
 * Full-bleed photograph that, as you scroll, pulls back into a framed
 * picture on one side of the page while the intro statement takes the
 * other side — the field becomes the first page of the khata.
 *
 *   p 0.00–0.30  headline lifts away
 *   p 0.10–0.70  photo insets into its frame
 *   p 0.45–0.80  intro statement arrives
 */
export default function Hero({ onCta }) {
  const { t, lang, dir } = useI18n()
  const sectionRef = useRef(null)
  const frameRef = useRef(null)
  const imgRef = useRef(null)
  const scrimRef = useRef(null)
  const bodyRef = useRef(null)
  const footRef = useRef(null)
  const introRef = useRef(null)
  const cueRef = useRef(null)
  const reduce = useMemo(prefersReducedMotion, [])

  const render = useCallback(p => {
    const wide = window.innerWidth >= 960 && !reduce
    const frame = frameRef.current
    if (!frame) return
    if (!wide) {
      frame.style.clipPath = ''
      ;[bodyRef, footRef, introRef, scrimRef, imgRef].forEach(r => { if (r.current) { r.current.style.opacity = ''; r.current.style.transform = '' } })
      return
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const e = easeInOutCubic(range(p, 0.1, 0.7))
    // Frame: right half in LTR, left half in RTL.
    const near = 0.04 * vw
    const far = 0.47 * vw
    const top = lerp(0, 96, e)
    const bottom = lerp(0, 0.07 * vh, e)
    const [l, r] = dir === 'rtl' ? [near, far] : [far, near]
    frame.style.clipPath = `inset(${top}px ${lerp(0, r, e)}px ${bottom}px ${lerp(0, l, e)}px round ${lerp(0, 22, e)}px)`
    if (imgRef.current) imgRef.current.style.transform = `scale(${lerp(1.08, 1, e)})`
    if (scrimRef.current) scrimRef.current.style.opacity = String(1 - e * 0.85)

    const out = easeOutCubic(range(p, 0.02, 0.3))
    if (bodyRef.current) {
      bodyRef.current.style.opacity = String(1 - out)
      bodyRef.current.style.transform = `translateY(${-out * 60}px)`
    }
    if (footRef.current) footRef.current.style.opacity = String(1 - range(p, 0.02, 0.16))
    if (cueRef.current) cueRef.current.style.opacity = String(1 - range(p, 0, 0.06))

    const inn = easeOutCubic(range(p, 0.45, 0.8))
    if (introRef.current) {
      introRef.current.style.opacity = String(inn)
      introRef.current.style.transform = `translateY(${(1 - inn) * 40}px)`
      introRef.current.style.pointerEvents = inn > 0.5 ? 'auto' : 'none'
    }
  }, [dir, reduce])

  useScrollTimeline(sectionRef, render, { mode: 'sticky', smoothing: 0.16 })

  // First sentence in white, the promise in italic amber.
  const [first, ...rest] = t('hero.headline').split(/(?<=[.。۔])\s*/).filter(Boolean)
  const words = s => s.split(' ').flatMap((w, i) => [<span key={i} className="w" style={{ '--i': i }}>{w}</span>, ' '])

  const facts = [['free', HandCoins], ['phone', Smartphone], ['voice', Mic]]

  return (
    <section id="hero" className="hero2" ref={sectionRef}>
      <div className="hero2-stage">
        <div className="hero2-frame" ref={frameRef}>
          <picture>
            <source media="(max-width: 800px)" srcSet="/images/hero-tractor-1200.jpg" />
            <img ref={imgRef} src="/images/hero-tractor.jpg" alt="" fetchPriority="high" />
          </picture>
          <div className="hero2-scrim" ref={scrimRef} />
          <span className="hero2-credit">{t('hero.credit')}</span>
        </div>

        <div className="hero2-copy">
        <div className="container hero2-body" ref={bodyRef} key={lang}>
          <p className="eyebrow eyebrow-light">{t('hero.eyebrow')}</p>
          <h1 className="hero-title">
            <span className="line">{words(first)}</span>
            {rest.length > 0 && <em className="line">{words(rest.join(' '))}</em>}
          </h1>
          <p className="hero-ur" lang="ur" dir="rtl">{t('hero.slogan')}</p>
          <p className="hero-sub">{t('hero.sub')}</p>
          <div className="hero-actions">
            <a href="#khata-form" className="btn btn-amber" onClick={onCta}>
              {t('hero.cta')} <span className="arrow" aria-hidden="true">→</span>
            </a>
            <a href="#story" className="btn btn-glass" onClick={e => { e.preventDefault(); scrollToSection('story') }}>{t('hero.secondary')}</a>
          </div>
        </div>

        <div className="container hero2-foot" ref={footRef}>
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
        </div>

        <button type="button" className="scroll-cue" ref={cueRef} onClick={() => scrollToSection('story')} aria-label={t('v4.hero.scroll')}>
          <span>{t('v4.hero.scroll')}</span>
          <ArrowDown size={16} />
        </button>
        </div>

        <div className="hero2-intro" ref={introRef}>
          <p className="eyebrow">{t('intro.eyebrow')}</p>
          <h2 className="h2">{t('intro.title')}</h2>
          <p className="lead">{t('intro.lead')}</p>
          <a href="#story" className="link-under" onClick={e => { e.preventDefault(); scrollToSection('story') }}>
            {t('v4.hero.follow')} <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>
    </section>
  )
}

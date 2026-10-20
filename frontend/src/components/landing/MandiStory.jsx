import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Mic, Scale, ShieldCheck, ArrowDown } from 'lucide-react'
import { rootApi } from '../../api'
import { useI18n } from '../../i18n/useI18n'
import { useScrollTimeline, useCountUp, clamp, easeInOutCubic, prefersReducedMotion } from '../../hooks/motion'
import { scrollToSection } from '../../hooks/smoothScroll'

/*
 * "Mandi day" — the problem told as one farmer's day, in four panels that
 * slide sideways while the page scrolls down. Each panel holds for a moment
 * before the next one turns in, like pages of a khata.
 */
const PANELS = ['dawn', 'mandi', 'book', 'now']

function LiveNumber({ value, label }) {
  const v = useCountUp(value)
  return (
    <div className="sn-live-item">
      <strong>{Math.round(v).toLocaleString('en-US')}</strong>
      <span>{label}</span>
    </div>
  )
}

export default function MandiStory() {
  const { t, dir } = useI18n()
  const sectionRef = useRef(null)
  const trackRef = useRef(null)
  const barRef = useRef(null)
  const depthRefs = useRef([])
  const [current, setCurrent] = useState(0)
  const [live, setLive] = useState(null)
  const reduce = useMemo(prefersReducedMotion, [])

  useEffect(() => {
    let alive = true
    rootApi.get('/analytics/summary-report', { timeout: 25000 })
      .then(r => { if (alive) setLive(r.data) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const render = useCallback(p => {
    const track = trackRef.current
    if (!track) return
    const wide = window.innerWidth >= 960 && !reduce
    if (!wide) {
      track.style.transform = ''
      depthRefs.current.forEach(el => { if (el) el.style.transform = '' })
      return
    }
    // Hold at each panel, then turn: eased position between panels.
    const n = PANELS.length - 1
    const seg = clamp(p * 1.04 - 0.02) * n
    const i = Math.min(n - 1, Math.floor(seg))
    const pos = i + easeInOutCubic(clamp((seg - i - 0.18) / 0.64))
    const sign = dir === 'rtl' ? 1 : -1
    track.style.transform = `translate3d(${sign * pos * 100}vw, 0, 0)`
    // Parallax: inner layers lag behind their panel.
    depthRefs.current.forEach(el => {
      if (!el) return
      const local = Number(el.dataset.panel) - pos
      el.style.transform = `translate3d(${-sign * local * Number(el.dataset.depth) * 100}px, 0, 0)`
    })
    if (barRef.current) barRef.current.style.transform = `scaleX(${pos / n})`
    const idx = Math.round(pos)
    setCurrent(c => (c === idx ? c : idx))
  }, [dir, reduce])

  useScrollTimeline(sectionRef, render, { mode: 'sticky', smoothing: 0.12 })

  useEffect(() => {
    const on = () => render(0)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [render])

  function goTo(i) {
    const el = sectionRef.current
    if (!el) return
    if (window.innerWidth < 960 || reduce) return scrollToSection(el.querySelectorAll('.sn-panel')[i])
    const top = el.getBoundingClientRect().top + window.scrollY
    const span = el.offsetHeight - window.innerHeight
    // Land in the middle of that panel's hold.
    const p = (i / (PANELS.length - 1) + 0.02) / 1.04
    scrollToSection(top + clamp(p) * span, { offset: 0 })
  }

  // Only show counters that have something to say; a fresh database is all zeros.
  const liveItems = live ? [
    ['farmers', live.total_farmers],
    ['entries', live.total_ledger_entries],
    ['sms', live.sms_total_queries],
  ].filter(([, v]) => v > 0) : []

  const depth = (panel, d) => ({
    ref: el => { depthRefs.current[panel * 4 + d] = el },
    'data-panel': panel,
    'data-depth': [0, 0.6, 1.2, 1.8][d],
  })

  return (
    <section id="story" className="story" ref={sectionRef} aria-labelledby="story-title">
      <div className="sn-stage">
        <h2 id="story-title" className="visually-hidden">{t('v4.story.title')}</h2>
        <div className="sn-track" ref={trackRef}>

          {/* 01 — Dawn */}
          <article className="sn-panel sn-dawn t-light" aria-current={current === 0}>
            <div className="sn-copy">
              <p className="sn-chapter"><b>01</b>{t('v4.story.dawn.chapter')}</p>
              <h3 className="sn-title">{t('v4.story.dawn.title')}</h3>
              <p className="sn-body">{t('v4.story.dawn.body')}</p>
              <div className="sn-stats" {...depth(0, 1)}>
                <div><strong>11.1M</strong><span>{t('v4.story.dawn.s1')}</span></div>
                <div><strong>97%</strong><span>{t('v4.story.dawn.s2')}</span></div>
              </div>
            </div>
            <figure className="sn-photo" {...depth(0, 2)}>
              <img src="/images/farmer-field.jpg" alt="" loading="lazy" />
              <figcaption>{t('access.photoCredit')}</figcaption>
            </figure>
          </article>

          {/* 02 — The mandi */}
          <article className="sn-panel sn-mandi" aria-current={current === 1}>
            <img className="sn-bleed" src="/images/mandi.jpg" alt="" loading="lazy" {...depth(1, 1)} />
            <div className="sn-bleed-scrim" />
            <div className="sn-copy sn-copy-light">
              <p className="sn-chapter"><b>02</b>{t('v4.story.mandi.chapter')}</p>
              <h3 className="sn-title">{t('v4.story.mandi.title')}</h3>
              <p className="sn-body">{t('v4.story.mandi.body')}</p>
            </div>
            <div className="sn-bignum" {...depth(1, 3)}>
              <strong>20–25%</strong>
              <span>{t('v4.story.mandi.stat')}</span>
            </div>
            <span className="sn-credit">{t('checker.photoCaption')}</span>
          </article>

          {/* 03 — The notebook */}
          <article className={`sn-panel sn-book t-light t-tint${current === 2 ? ' on' : ''}`} aria-current={current === 2}>
            <div className="sn-copy">
              <p className="sn-chapter"><b>03</b>{t('v4.story.book.chapter')}</p>
              <h3 className="sn-title">{t('v4.story.book.title')}</h3>
              <p className="sn-body">{t('v4.story.book.body')}</p>
              <div className="sn-stats" {...depth(2, 1)}>
                <div><strong>46%</strong><span>{t('v4.story.book.s1')}</span></div>
              </div>
            </div>
            <div className="sn-notebook" dir="ltr" aria-hidden="true" {...depth(2, 2)}>
              <div className="nb-head"><span>Bahi · 1447</span><span>Arhat Shah &amp; Sons</span></div>
              <div className="nb-row"><span>12 Rabi</span><span>Aslam — beej, khaad</span><span className="nb-amt">qarz 50,000<i className="nb-new">80,000</i></span></div>
              <div className="nb-row"><span>03 Jeth</span><span>Aslam — gandum 40 man</span><span className="nb-amt">@ 3,400</span></div>
              <div className="nb-row"><span>03 Jeth</span><span>Arhat 2½%, mazdoori</span><span className="nb-amt">− 5,780</span></div>
              <div className="nb-row nb-total"><span /><span>Baqaya</span><span className="nb-amt">?</span></div>
              <div className="nb-note">{t('v4.story.book.note')}</div>
            </div>
          </article>

          {/* 04 — Now */}
          <article className="sn-panel sn-now t-dark" aria-current={current === 3}>
            <div className="sn-copy">
              <p className="sn-chapter"><b>04</b>{t('v4.story.now.chapter')}</p>
              <h3 className="sn-title">{t('v4.story.now.title')}</h3>
              <p className="sn-body">{t('v4.story.now.body')}</p>
              <button type="button" className="btn btn-amber" onClick={() => scrollToSection('features')}>
                {t('v4.story.now.cta')} <ArrowDown size={16} />
              </button>
            </div>
            <ol className="sn-pillars" {...depth(3, 1)}>
              {[['speak', Mic], ['check', Scale], ['prove', ShieldCheck]].map(([k, Icon], i) => (
                <li key={k} style={{ '--i': i }}>
                  <Icon size={22} strokeWidth={1.6} />
                  <div>
                    <strong>{t(`v4.story.now.${k}.title`)}</strong>
                    <span>{t(`v4.story.now.${k}.desc`)}</span>
                  </div>
                </li>
              ))}
            </ol>
            {liveItems.length > 0 && (
              <div className="sn-live" {...depth(3, 2)}>
                <span className="live-title"><i className="live-dot" />{t('intro.live')}</span>
                {liveItems.map(([k, v]) => <LiveNumber key={k} value={v} label={t(`stats.${k}`)} />)}
              </div>
            )}
          </article>
        </div>

        <nav className="sn-nav" aria-label={t('v4.story.title')}>
          <div className="sn-nav-track"><i ref={barRef} /></div>
          <ol>
            {PANELS.map((k, i) => (
              <li key={k}>
                <button type="button" className={current === i ? 'on' : ''} onClick={() => goTo(i)}>
                  <b>0{i + 1}</b><span>{t(`v4.story.${k}.chapter`)}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </section>
  )
}

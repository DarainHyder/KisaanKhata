import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Mic, Scale, Link2, MessageSquareText } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import {
  useScrollTimeline, range, lerp, easeOutCubic, easeInOutCubic, prefersReducedMotion,
} from '../../hooks/motion'

/*
 * "Khata Burst" — one ledger entry slip explodes into the four engines that
 * power it (voice, mandi price check, hash seal, SMS), scattering wheat
 * grains, then the pieces settle into feature cards.
 *
 * Timeline over the pinned section (p = 0 → 1):
 *   0.00–0.10  slip at rest
 *   0.10–0.40  explode outwards (shockwave ring + grains)
 *   0.40–0.70  pieces settle into the feature layout
 *   0.52–0.80  each piece unfolds its description
 */

const FRAGS = [
  { key: 'voice', Icon: Mic, feature: 'voiceFirst', rot: -14 },
  { key: 'price', Icon: Scale, feature: 'priceVerify', rot: 12 },
  { key: 'hash', Icon: Link2, feature: 'integrity', rot: 10 },
  { key: 'sms', Icon: MessageSquareText, feature: 'sms', rot: -16 },
]
const GRAIN_COUNT = 28
const HEADER_H = 58

function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export default function KhataBurst() {
  const { t, lang } = useI18n()
  const sectionRef = useRef(null)
  const stickyRef = useRef(null)
  const headRef = useRef(null)
  const shellRef = useRef(null)
  const glowRef = useRef(null)
  const ringRef = useRef(null)
  const barRef = useRef(null)
  const fragRefs = useRef([])
  const detailRefs = useRef([])
  const grainRefs = useRef([])
  const geom = useRef(null)
  const lastP = useRef(0)
  const reduce = useMemo(prefersReducedMotion, [])

  const grains = useMemo(() => {
    const rnd = seeded(42)
    return Array.from({ length: GRAIN_COUNT }, () => ({
      angle: rnd() * Math.PI * 2,
      dist: 0.45 + rnd() * 0.55,
      spin: (rnd() - 0.5) * 540,
      size: 0.6 + rnd() * 0.7,
    }))
  }, [])

  const measure = useCallback(() => {
    const stage = stickyRef.current
    if (!stage) return null
    const vw = stage.clientWidth
    const vh = stage.clientHeight
    const mobile = vw < 760
    const W = mobile ? Math.min(380, vw * 0.88) : Math.max(300, Math.min(vw * 0.3, 410))

    const rowH = []
    const fullH = []
    FRAGS.forEach((_, i) => {
      const el = fragRefs.current[i]
      const det = detailRefs.current[i]
      el.style.width = `${W}px`
      rowH[i] = el.offsetHeight - det.offsetHeight
      fullH[i] = rowH[i] + det.scrollHeight
    })

    // Assembled: the four pieces stacked inside the slip.
    const GAP = 10
    const stackH = rowH.reduce((a, b) => a + b, 0) + GAP * 3
    const shellH = HEADER_H + stackH + 16
    const shellW = W + 28
    // Keep the resting slip clear of the heading (matters on short / narrow screens).
    const headBottom = (headRef.current?.offsetTop || 0) + (headRef.current?.offsetHeight || 0) - vh / 2
    const below = headBottom + 20
    const aScale = Math.min(1, (vh / 2 - 64 - below) / shellH)
    const shellY = Math.max(0, below + (shellH * aScale) / 2)
    const assembled = []
    let y = shellY - (shellH * aScale) / 2 + HEADER_H * aScale
    rowH.forEach((h, i) => { assembled[i] = { x: 0, y }; y += (h + GAP) * aScale })

    // Final: 2×2 grid on desktop, a single column on phones.
    const final = []
    let scale = 1
    if (mobile) {
      // Fill the space between the navbar and the progress caption.
      const total = fullH.reduce((a, b) => a + b, 0) + 12 * 3
      const top = -vh / 2 + 68 + 12
      const room = vh - 68 - 12 - 78
      scale = Math.min(1, room / total)
      let fy = (top + (room - total * scale) / 2) / scale
      fullH.forEach((h, i) => { final[i] = { x: 0, y: fy }; fy += h + 12 })
    } else {
      // Leave room for the heading, which returns once the cards land.
      const colX = W / 2 + 22
      const top = Math.max(fullH[0], fullH[1])
      const bottom = Math.max(fullH[2], fullH[3])
      const total = top + 24 + bottom
      const room = vh / 2 - 70 - headBottom - 24
      scale = Math.min(1, room / total)
      const y0 = (headBottom + 24 + (room - total * scale) / 2) / scale
      final[0] = { x: -colX, y: y0 }
      final[1] = { x: colX, y: y0 }
      final[2] = { x: -colX, y: y0 + top + 24 }
      final[3] = { x: colX, y: y0 + top + 24 }
    }

    // Burst: thrown well past the final spot before settling back.
    const dirs = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
    const burst = FRAGS.map((_, i) => mobile
      ? { x: (i % 2 ? 1 : -1) * vw * 0.42, y: final[i].y * 1.4 }
      : { x: dirs[i][0] * vw * 0.36, y: dirs[i][1] * vh * 0.34 - rowH[i] / 2 })

    return { mobile, shellY, aScale, vw, vh, W, shellW, shellH, assembled, final, burst, scale, fullH, rowH, reach: Math.max(vw, vh) * 0.55 }
  }, [])

  const render = useCallback(p => {
    if (reduce) p = 1
    lastP.current = p
    if (!geom.current) geom.current = measure()
    const g = geom.current
    if (!g) return

    const e1 = easeOutCubic(range(p, 0.10, 0.40))
    const e2 = easeInOutCubic(range(p, 0.40, 0.70))
    const d = easeOutCubic(range(p, 0.52, 0.80))

    FRAGS.forEach((f, i) => {
      const el = fragRefs.current[i]
      const det = detailRefs.current[i]
      if (!el || !det) return
      const a = g.assembled[i], b = g.burst[i], c = g.final[i]
      const x = e2 > 0 ? lerp(b.x, c.x * g.scale, e2) : lerp(a.x, b.x, e1)
      const y = e2 > 0 ? lerp(b.y, c.y * g.scale, e2) : lerp(a.y, b.y, e1)
      const rot = f.rot * e1 * (1 - e2)
      const pop = 1 + 0.08 * Math.sin(Math.PI * e1) * (1 - e2)
      const s = lerp(g.aScale, g.scale, e2) * pop
      el.style.transform = `translate(-50%, 0) translate(${x}px, ${y}px) rotate(${rot}deg) scale(${s})`
      el.style.boxShadow = e1 > 0.02 ? `0 30px 60px -28px rgba(0,0,0,${0.5 + 0.3 * e1})` : 'none'
      el.style.background = `rgba(${e2 > 0 ? '18,32,22' : '0,0,0'},${lerp(0.28, 0.92, e2)})`
      det.style.maxHeight = `${(g.fullH[i] - g.rowH[i]) * d}px`
      det.style.opacity = d
    })

    const shell = shellRef.current
    if (shell) {
      const fade = range(p, 0.10, 0.26)
      shell.style.width = `${g.shellW}px`
      shell.style.height = `${g.shellH}px`
      shell.style.opacity = 1 - fade
      shell.style.transform = `translate(-50%, calc(-50% + ${g.shellY}px)) scale(${g.aScale * (1 + 0.3 * e1)})`
    }
    if (headRef.current) {
      // Fades out for the explosion; on wide screens it returns above the settled cards.
      const out = range(p, 0.06, 0.22)
      const back = g.mobile ? 0 : easeOutCubic(range(p, 0.62, 0.78))
      const v = Math.max(1 - out, back)
      headRef.current.style.opacity = v
      headRef.current.style.transform = `translateY(${-40 * (1 - v)}px)`
    }
    if (glowRef.current) {
      glowRef.current.style.transform = `scale(${0.8 + 1.1 * e1})`
      glowRef.current.style.opacity = 0.9 - 0.55 * e2
    }
    if (ringRef.current) {
      ringRef.current.style.transform = `scale(${0.5 + 3.2 * e1})`
      ringRef.current.style.opacity = e1 > 0 && e1 < 1 ? 0.9 * (1 - e1) : 0
    }
    const gp = easeOutCubic(range(p, 0.12, 0.52))
    grains.forEach((gr, i) => {
      const el = grainRefs.current[i]
      if (!el) return
      const D = g.reach * gr.dist * gp
      const gx = Math.cos(gr.angle) * D
      const gy = Math.sin(gr.angle) * D + 140 * gp * gp
      el.style.transform = `translate(${gx}px, ${gy}px) rotate(${gr.angle * 57.3 + gr.spin * gp}deg) scale(${gr.size})`
      el.style.opacity = gp <= 0 || gp >= 1 ? 0 : Math.min(1, gp * 6) * (1 - gp)
    })
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`
  }, [grains, measure, reduce])

  // Re-measure when the language (and therefore text length) or the viewport changes.
  useEffect(() => {
    geom.current = null
    const id = requestAnimationFrame(() => render(lastP.current))
    const onResize = () => { geom.current = null; render(lastP.current) }
    window.addEventListener('resize', onResize)
    document.fonts?.ready.then(onResize)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', onResize) }
  }, [lang, render])

  useScrollTimeline(sectionRef, render, { mode: 'sticky', smoothing: 0.12 })

  return (
    <section
      id="features"
      className="burst"
      ref={sectionRef}
      aria-labelledby="burst-title"
      style={reduce ? { height: '100svh' } : undefined}
    >
      <div className="burst-sticky" ref={stickyRef}>
        <div className="burst-glow" ref={glowRef} aria-hidden="true" />
        <div className="burst-ring" ref={ringRef} aria-hidden="true" />
        {grains.map((_, i) => (
          <span key={i} className="grain" ref={el => { grainRefs.current[i] = el }} aria-hidden="true" />
        ))}

        <div className="burst-heading" ref={headRef}>
          <span className="eyebrow">{t('burst.eyebrow')}</span>
          <h2 id="burst-title">{t('burst.title')}</h2>
        </div>

        <div className="slip-shell" ref={shellRef} aria-hidden="true">
          <div className="slip-head">
            <span>{t('burst.slipLabel')} · #0042</span>
            <span className="slip-urdu">کھاتہ</span>
          </div>
        </div>

        {FRAGS.map((f, i) => (
          <article
            key={f.key}
            className={`frag frag-${f.key}`}
            ref={el => { fragRefs.current[i] = el }}
          >
            <div className="frag-row">
              <div className="frag-icon"><f.Icon size={19} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="frag-kicker">{t(`burst.${f.key}.kicker`)}</div>
                <div className="frag-main">{t(`burst.${f.key}.main`)}</div>
              </div>
              {f.key === 'voice' && (
                <div className="wave" aria-hidden="true">
                  {[0.5, 0.9, 0.6, 1, 0.7, 0.4, 0.8].map((h, k) => (
                    <i key={k} style={{ height: `${h * 100}%`, animationDelay: `${k * 0.12}s` }} />
                  ))}
                </div>
              )}
              {f.key === 'price' && <span className="verdict-pill">{t('burst.price.pill')}</span>}
              {f.key === 'hash' && <span className="hash-text">4be0…17c3</span>}
              {f.key === 'sms' && <span className="sms-bubble">SALE gandum</span>}
            </div>
            <div className="frag-detail" ref={el => { detailRefs.current[i] = el }}>
              <h3>{t(`features.${f.feature}.title`)}</h3>
              <p>{t(`features.${f.feature}.desc`)}</p>
            </div>
          </article>
        ))}

        <div className="burst-caption" aria-hidden="true">
          {t('burst.caption')}
          <div className="burst-progress"><span ref={barRef} /></div>
        </div>
      </div>
    </section>
  )
}

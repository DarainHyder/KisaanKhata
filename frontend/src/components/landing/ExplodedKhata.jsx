import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import {
  useScrollTimeline, range, lerp, easeOutCubic, easeInOutCubic, prefersReducedMotion,
} from '../../hooks/motion'

/*
 * Exploded view of one khata entry.
 *
 * A real ledger slip lies flat. As the section scrolls (pinned), the camera
 * tilts into an isometric view and the slip separates into the physical
 * layers that carry it — voice, mandi check, hash seal, SMS — like a
 * technical exploded diagram. Leader lines then draw out to annotations.
 *
 *   p 0.00–0.08  flat, top-down
 *   p 0.08–0.32  camera tilts to isometric
 *   p 0.26–0.62  layers separate (top layer first)
 *   p 0.50–0.86  leader lines draw, annotations appear one by one
 */

// Bottom → top. `side` is where the annotation sits on wide screens.
const LAYERS = [
  { key: 'sms', side: 'right' },
  { key: 'hash', side: 'left' },
  { key: 'mandi', side: 'right' },
  { key: 'voice', side: 'left' },
  { key: 'slip', side: 'right' },
]
const TOP = LAYERS.length - 1
// Annotation order, top of the stack first.
const ORDER = [...LAYERS.keys()].reverse()

const WAVE = [0.3, 0.55, 0.4, 0.8, 0.62, 1, 0.7, 0.45, 0.85, 0.5, 0.95, 0.6, 0.35, 0.75, 0.5, 0.88, 0.42, 0.66, 0.3, 0.52, 0.8, 0.45, 0.28, 0.6]
const HEX = 'f548d1a0d08c31228732b3cbadb3f91fc0eab5246756baaab782d71364192c65'

function Plate({ k, t }) {
  if (k === 'slip') {
    return (
      <div className="plate-slip">
        <div className="slip-top">
          <span>{t('exploded.slip.no')}</span>
          <span>{t('exploded.slip.place')}</span>
        </div>
        <dl className="slip-rows">
          <div><dt>{t('exploded.slip.date')}</dt><dd>18 · 04 · 2026</dd></div>
          <div><dt>{t('exploded.slip.crop')}</dt><dd>{t('exploded.slip.wheat')}</dd></div>
          <div><dt>{t('exploded.slip.qty')}</dt><dd>{t('exploded.slip.maund')}</dd></div>
          <div><dt>{t('exploded.slip.rate')}</dt><dd>3,400</dd></div>
          <div className="slip-total"><dt>{t('exploded.slip.total')}</dt><dd>136,000</dd></div>
        </dl>
        <div className="slip-foot">
          <svg className="thumb" viewBox="0 0 60 76" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <ellipse key={i} cx="30" cy="40" rx={26 - i * 3.6} ry={34 - i * 4.6} fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray={i % 2 ? '9 3' : '14 2'} />
            ))}
          </svg>
          <span>{t('exploded.slip.mark')}</span>
          <span className="slip-seal">#4be0…17c3</span>
        </div>
      </div>
    )
  }
  if (k === 'voice') {
    return (
      <div className="plate-voice">
        <div className="plate-meta"><span>ur · 00:04</span><span>● REC</span></div>
        <svg className="wave-svg" viewBox="0 0 240 80" preserveAspectRatio="none" aria-hidden="true">
          {WAVE.map((h, i) => (
            <rect key={i} x={i * 10 + 2} y={40 - h * 34} width="5" height={h * 68} rx="2.5" />
          ))}
        </svg>
        <p className="voice-ur" dir="rtl" lang="ur">گندم بیچی، 3,400 فی من</p>
      </div>
    )
  }
  if (k === 'mandi') {
    return (
      <div className="plate-mandi">
        <div className="plate-meta"><span>AMIS · Multan</span><span>PKR / 40 kg</span></div>
        <div className="mandi-scale">
          <div className="ms-band" />
          <div className="ms-mark ms-paid" style={{ left: '30%' }}><b>3,400</b></div>
          <div className="ms-mark ms-ref" style={{ left: '62%' }}><b>3,900</b></div>
        </div>
        <div className="rubber-stamp">{t('exploded.stamp')}</div>
      </div>
    )
  }
  if (k === 'hash') {
    return (
      <div className="plate-hash">
        <div className="hash-field" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => <span key={i}>{HEX.slice(i * 3) + HEX.slice(0, i * 3)}</span>)}
        </div>
        <div className="wax-seal"><span>SHA<br />256</span></div>
        <div className="plate-meta hash-meta"><span>prev 9f2c…a71e</span><span>→ 4be0…17c3</span></div>
      </div>
    )
  }
  return (
    <div className="plate-sms">
      <div className="plate-meta"><span>SMS · 8070</span><span>▮▮▮▯</span></div>
      <div className="sms-in">SALE gandum 3400 Multan</div>
      <div className="sms-out">Gandum: aapko Rs 3,400 mila. Mandi rate Rs 3,900. Rs 500 (12.8%) kam mila.</div>
    </div>
  )
}

export default function ExplodedKhata() {
  const { t, lang, dir } = useI18n()
  const sectionRef = useRef(null)
  const stageRef = useRef(null)
  const stackRef = useRef(null)
  const headRef = useRef(null)
  const layerRefs = useRef([])
  const pinRefs = useRef([])
  const labelRefs = useRef([])
  const pathRefs = useRef([])
  const dotRefs = useRef([])
  const barRef = useRef(null)
  const lastP = useRef(0)
  const [active, setActive] = useState(-1)
  const reduce = useMemo(prefersReducedMotion, [])

  const render = useCallback(p => {
    if (reduce) p = 0.9
    lastP.current = p
    const stage = stageRef.current
    const stack = stackRef.current
    if (!stage || !stack) return
    const vw = stage.clientWidth
    const vh = stage.clientHeight
    const wide = vw >= 900

    // Camera
    const tilt = easeInOutCubic(range(p, 0.08, 0.32))
    const drift = range(p, 0.3, 1)
    const rotX = lerp(0, 57, tilt)
    const rotZ = lerp(0, -36, tilt) - 8 * drift
    const lift = wide ? 30 : 10
    const scale = wide ? lerp(1.12, Math.min(0.86, vh / 1050), tilt) : lerp(1, 0.72, tilt)
    stack.style.transform = `translate(-50%, -50%) translateY(${lift * tilt}px) scale(${scale}) rotateX(${rotX}deg) rotateZ(${rotZ}deg)`

    // Layers separate along Z, top layer first
    const gap = wide ? 132 : 78
    LAYERS.forEach((_, i) => {
      const el = layerRefs.current[i]
      if (!el) return
      const delay = (TOP - i) * 0.035
      const e = easeOutCubic(range(p, 0.26 + delay, 0.56 + delay))
      const z = (i - TOP / 2) * gap * e
      el.style.transform = `translateZ(${z}px)`
      el.style.setProperty('--sep', e.toFixed(3))
    })

    if (headRef.current) {
      const fade = wide ? 0 : range(p, 0.05, 0.2)
      headRef.current.style.opacity = 1 - fade
    }
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`

    // Mobile: one caption at a time instead of leader lines
    if (!wide) {
      const idx = p < 0.5 ? -1 : Math.min(ORDER.length - 1, Math.floor(range(p, 0.5, 0.95) * ORDER.length))
      setActive(prev => (prev === idx ? prev : idx))
      return
    }

    // Leader lines + annotations
    const sRect = stage.getBoundingClientRect()
    const cx = vw / 2
    const offset = Math.max(250, Math.min(cx - 300, 470))
    const headBottom = headRef.current ? headRef.current.offsetTop + headRef.current.offsetHeight + 24 : 0
    const placed = { left: [], right: [] }

    ORDER.forEach((li, n) => {
      const L = LAYERS[li]
      const label = labelRefs.current[li]
      const pins = pinRefs.current[li]
      if (!pins || !label) return
      // Anchor on whichever corner sits furthest out on the label's side.
      let px = L.side === 'left' ? Infinity : -Infinity
      let py = 0
      pins.forEach(pin => {
        if (!pin) return
        const r = pin.getBoundingClientRect()
        const x = r.left + r.width / 2 - sRect.left
        if (L.side === 'left' ? x < px : x > px) { px = x; py = r.top + r.height / 2 - sRect.top }
      })
      const h = label.offsetHeight
      let ly = py - 14
      const column = placed[L.side]
      const minY = column.length ? column[column.length - 1] + 18 : (L.side === 'left' ? headBottom : 96)
      ly = Math.max(ly, minY)
      ly = Math.min(ly, vh - h - 70)
      column.push(ly + h)

      const lx = L.side === 'left' ? cx - offset - label.offsetWidth : cx + offset
      label.style.transform = `translate(${lx}px, ${ly}px)`
      const anchorX = L.side === 'left' ? cx - offset + 8 : cx + offset - 8
      const anchorY = ly + 14
      const elbowX = L.side === 'left' ? anchorX + 36 : anchorX - 36

      const draw = easeOutCubic(range(p, 0.5 + n * 0.065, 0.62 + n * 0.065))
      const path = pathRefs.current[li]
      if (path) {
        path.setAttribute('d', `M ${px} ${py} L ${elbowX} ${anchorY} L ${anchorX} ${anchorY}`)
        path.style.strokeDashoffset = `${1 - draw}`
      }
      const dot = dotRefs.current[li]
      if (dot) {
        dot.setAttribute('cx', px)
        dot.setAttribute('cy', py)
        dot.style.opacity = draw > 0 ? 1 : 0
      }
      const show = range(p, 0.56 + n * 0.065, 0.66 + n * 0.065)
      label.style.opacity = show
      label.style.setProperty('--show', show.toFixed(3))
    })
  }, [reduce])

  useEffect(() => {
    const id = requestAnimationFrame(() => render(lastP.current))
    const onResize = () => render(lastP.current)
    window.addEventListener('resize', onResize)
    document.fonts?.ready.then(onResize)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', onResize) }
  }, [lang, render])

  useScrollTimeline(sectionRef, render, { mode: 'sticky', smoothing: 0.1 })

  return (
    <section id="features" className="xv theme-field" ref={sectionRef} aria-labelledby="xv-title" style={reduce ? { height: '100svh' } : undefined}>
      <div className="xv-stage" ref={stageRef}>
        <div className="xv-grid" aria-hidden="true" />

        <header className="xv-head" ref={headRef}>
          <span className="kicker">{t('exploded.eyebrow')}</span>
          <h2 id="xv-title" className="display-md">{t('exploded.title')}</h2>
          <p>{t('exploded.lead')}</p>
        </header>

        <div className="xv-scene" dir="ltr">
          <div className="xv-stack" ref={stackRef}>
            {LAYERS.map((L, i) => (
              <div key={L.key} className={`xv-layer xv-${L.key}`} ref={el => { layerRefs.current[i] = el }} dir={L.key === 'slip' ? dir : 'ltr'}>
                <Plate k={L.key} t={t} />
                <span className="xv-tag">{String(TOP - i + 1).padStart(2, '0')}</span>
                {['tl', 'tr', 'br', 'bl'].map((c, k) => (
                  <i key={c} className={`xv-pin xv-pin-${c}`} ref={el => { (pinRefs.current[i] ||= [])[k] = el }} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <svg className="xv-lines" aria-hidden="true">
          {LAYERS.map((L, i) => (
            <g key={L.key}>
              <path ref={el => { pathRefs.current[i] = el }} pathLength="1" />
              <circle ref={el => { dotRefs.current[i] = el }} r="3.5" />
            </g>
          ))}
        </svg>

        {LAYERS.map((L, i) => (
          <div key={L.key} className={`xv-label xv-label-${L.side}`} ref={el => { labelRefs.current[i] = el }}>
            <span className="xv-num">{String(TOP - i + 1).padStart(2, '0')}</span>
            <h3>{t(`exploded.layers.${L.key}.title`)}</h3>
            <p>{t(`exploded.layers.${L.key}.desc`)}</p>
          </div>
        ))}

        <div className="xv-caption" aria-live="polite">
          {active >= 0 ? (
            <div key={active} className="xv-caption-inner">
              <span className="xv-num">{String(TOP - ORDER[active] + 1).padStart(2, '0')}</span>
              <div>
                <h3>{t(`exploded.layers.${LAYERS[ORDER[active]].key}.title`)}</h3>
                <p>{t(`exploded.layers.${LAYERS[ORDER[active]].key}.desc`)}</p>
              </div>
            </div>
          ) : (
            <span className="xv-hint">{t('exploded.hint')}</span>
          )}
        </div>

        <div className="xv-progress" aria-hidden="true">
          <span>00</span>
          <div className="xv-track"><i ref={barRef} /></div>
          <span>0{LAYERS.length}</span>
        </div>
      </div>
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'

export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v))
export const lerp = (a, b, t) => a + (b - a) * t
/** Maps v from [a, b] to [0, 1], clamped. */
export const range = (v, a, b) => clamp((v - a) / (b - a))
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3)
export const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Calls onFrame(progress) with a smoothed scroll progress for `ref`.
 *  - mode 'sticky': 0 when the section top hits the viewport top, 1 when its bottom hits the viewport bottom.
 *  - mode 'view'  : 0 when the section enters from below, 1 when it leaves at the top.
 * The loop only runs while the section is near the viewport.
 */
export function useScrollTimeline(ref, onFrame, { mode = 'view', smoothing = 0.14 } = {}) {
  const cb = useRef(onFrame)
  useEffect(() => { cb.current = onFrame })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = prefersReducedMotion()
    let raf = 0
    let current = -1
    let visible = false

    const target = () => {
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      if (mode === 'sticky') return clamp(-r.top / Math.max(1, r.height - vh))
      return clamp((vh - r.top) / (vh + r.height))
    }

    const tick = () => {
      const t = target()
      const next = current < 0 || reduce ? t : lerp(current, t, smoothing)
      if (Math.abs(next - current) > 0.0002) {
        current = Math.abs(next - t) < 0.0005 ? t : next
        cb.current(current)
      }
      if (visible) raf = requestAnimationFrame(tick)
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      cancelAnimationFrame(raf)
      if (visible) raf = requestAnimationFrame(tick)
    }, { rootMargin: '20% 0px 20% 0px' })
    io.observe(el)

    // Run one frame immediately so the initial state is correct.
    current = target()
    cb.current(current)

    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [ref, mode, smoothing])
}

/** Adds the `in` class to every `.reveal` element inside `rootRef` as it scrolls into view. */
export function useReveal(rootRef, deps = []) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = root.querySelectorAll('.reveal:not(.in)')
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      })
    }, { threshold: 0.15 })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Animates a number from its previous value to `target`. */
export function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    if (target === null || target === undefined || Number.isNaN(target)) return
    const from = fromRef.current
    if (prefersReducedMotion()) { fromRef.current = target; setValue(target); return }
    let raf = 0
    const start = performance.now()
    const step = now => {
      const t = easeOutCubic(clamp((now - start) / duration))
      const v = from + (target - from) * t
      setValue(v)
      if (t < 1) raf = requestAnimationFrame(step)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

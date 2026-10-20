import { useEffect, useState } from 'react'
import Lenis from 'lenis'
import { prefersReducedMotion } from './motion'

// One Lenis instance for the landing page, shared so the navbar, the
// chapter rail and in-page buttons all glide the same way.
let lenis = null
const listeners = new Set()

export function startSmoothScroll() {
  if (lenis || prefersReducedMotion()) return () => {}
  lenis = new Lenis({ autoRaf: true, lerp: 0.09, wheelMultiplier: 0.95, anchors: { offset: -64 } })
  lenis.on('scroll', e => listeners.forEach(fn => fn(e)))
  return () => { lenis?.destroy(); lenis = null }
}

/** Smoothly scrolls to a section id, an element, or a page offset in px. */
export function scrollToSection(target, { offset = -64, immediate = false } = {}) {
  const el = typeof target === 'string' ? document.getElementById(target) : target
  if (el == null) return
  if (lenis) return lenis.scrollTo(el, { offset, immediate, duration: 1.4, easing: t => 1 - Math.pow(1 - t, 4) })
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
  if (typeof el === 'number') window.scrollTo({ top: el + offset, behavior })
  else el.scrollIntoView({ behavior })
}

/** Freezes page scrolling (e.g. while a full-screen menu is open). */
export function lockScroll(locked) {
  if (lenis && locked) lenis.stop()
  else if (lenis) lenis.start()
  document.documentElement.style.overflow = locked ? 'hidden' : ''
}

/** Current scroll velocity in px/frame (0 without Lenis). */
export function useScrollVelocity(onChange) {
  useEffect(() => {
    const fn = e => onChange(e.velocity || 0)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [onChange])
}

/** Overall page scroll progress, 0–1. */
export function usePageProgress() {
  const [p, setP] = useState(0)
  useEffect(() => {
    let raf = 0
    const read = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      setP(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0)
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(read) }
    read()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf) }
  }, [])
  return p
}

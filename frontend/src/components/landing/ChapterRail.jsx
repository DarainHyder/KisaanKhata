import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { scrollToSection } from '../../hooks/smoothScroll'
import { CHAPTERS } from './chapters'

/*
 * Vertical chapter index pinned to the page edge, like the thumb tabs on a
 * ledger. Shows where you are, how far through, and jumps on click.
 * It reads the theme of whatever sits behind it so it stays legible.
 */
export default function ChapterRail() {
  const { t } = useI18n()
  const [active, setActive] = useState(-1)
  const [tone, setTone] = useState('light')
  const [shown, setShown] = useState(false)
  const fillRef = useRef(null)

  useEffect(() => {
    const els = CHAPTERS.map(([id]) => document.getElementById(id))
    let raf = 0
    const update = () => {
      raf = 0
      const mid = window.innerHeight * 0.5
      let idx = -1
      els.forEach((el, i) => { if (el && el.getBoundingClientRect().top <= mid) idx = i })
      setActive(idx)

      const story = els[0]
      const footer = document.querySelector('.footer-wrapper')
      const afterHero = story && story.getBoundingClientRect().top < window.innerHeight * 0.6
      const beforeFooter = !footer || footer.getBoundingClientRect().top > window.innerHeight * 0.5
      setShown(Boolean(afterHero && beforeFooter))

      // Progress between the first chapter and the last.
      if (fillRef.current && els[0] && els[els.length - 1]) {
        const a = els[0].getBoundingClientRect().top
        const b = els[els.length - 1].getBoundingClientRect().top
        const p = Math.min(1, Math.max(0, (mid - a) / Math.max(1, b - a)))
        fillRef.current.style.transform = `scaleY(${p})`
      }

      // Light or dark behind the rail?
      const x = document.documentElement.dir === 'rtl' ? window.innerWidth - 30 : 30
      const under = document.elementsFromPoint(x, mid).find(el => !el.closest('.chapter-rail'))
      const themed = under?.closest('.t-dark, .t-light, .hero2')
      setTone(themed && !themed.classList.contains('t-light') ? 'dark' : 'light')
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf) }
  }, [])

  return (
    <nav className={`chapter-rail rail-${tone}${shown ? ' shown' : ''}`} aria-label={t('v4.chapters.label')}>
      <div className="rail-line"><i ref={fillRef} /></div>
      <ol>
        {CHAPTERS.map(([id, key], i) => (
          <li key={id} className={i === active ? 'on' : i < active ? 'past' : ''}>
            <button type="button" onClick={() => scrollToSection(id)} aria-current={i === active ? 'step' : undefined}>
              <b>{String(i + 1).padStart(2, '0')}</b>
              <span>{t(key)}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

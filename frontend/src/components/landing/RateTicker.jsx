import { useCallback, useEffect, useRef } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useMandiBoard, fmtPKR, cityName } from '../../hooks/useMandi'
import { useScrollVelocity } from '../../hooks/smoothScroll'
import { prefersReducedMotion } from '../../hooks/motion'

/*
 * Today's AMIS mandi rates, running like the chalk board at a mandi gate.
 * Drifts on its own; scrolling pushes it faster in the scroll direction.
 * Hovering pauses it so a rate can be read.
 */
export default function RateTicker() {
  const { t } = useI18n()
  const board = useMandiBoard()
  const rowRef = useRef(null)
  const boost = useRef(0)
  const paused = useRef(false)

  useScrollVelocity(useCallback(v => { boost.current = Math.max(-30, Math.min(30, v)) }, []))

  const items = Object.values(board.crops)

  useEffect(() => {
    const row = rowRef.current
    if (!row || !items.length || prefersReducedMotion()) return
    let x = 0
    let last = performance.now()
    let dirSign = 1
    let raf = 0
    const tick = now => {
      const dt = Math.min(64, now - last) / 1000
      last = now
      if (Math.abs(boost.current) > 0.5) dirSign = Math.sign(boost.current)
      const speed = paused.current ? 0 : 38 + Math.abs(boost.current) * 22
      x -= dirSign * speed * dt
      const half = row.scrollWidth / 2
      if (half > 0) x = ((x % half) - half) % half
      row.style.transform = `translate3d(${x}px, 0, 0)`
      boost.current *= 0.92
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [items.length])

  if (board.status === 'offline') return null

  // Rendered twice back to back so the loop is seamless.
  const list = copy => items.map(c => {
    const top = c.cities[0]
    return (
      <li key={c.crop + copy} className="rt-item" aria-hidden={copy ? true : undefined}>
        <span className="rt-crop">{t(`v4.crops.${c.crop}`)}</span>
        <span className="rt-price">{fmtPKR(c.avg)}</span>
        <span className="rt-meta">{t('v4.ticker.high', { city: cityName(top.city), price: fmtPKR(top.fqp) })} · {t('v4.ticker.mandis', { n: c.cities.length })}</span>
      </li>
    )
  })

  return (
    <aside className="ticker t-dark" aria-label={t('v4.ticker.label')}
      onMouseEnter={() => { paused.current = true }} onMouseLeave={() => { paused.current = false }}>
      <div className="rt-label">
        <i className={`live-dot${board.status === 'live' ? '' : ' wait'}`} />
        <span>{t('v4.ticker.label')}</span>
        <small>{t('v4.ticker.unit')}</small>
      </div>
      <div className="rt-window" dir="ltr">
        {board.status === 'loading' ? (
          <span className="rt-loading">{t('v4.ticker.loading')}</span>
        ) : (
          <ul className="rt-row" ref={rowRef}>{list('')}{list('-b')}</ul>
        )}
      </div>
    </aside>
  )
}

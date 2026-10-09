import { useCallback, useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useScrollTimeline, range } from '../../hooks/motion'

// The spoken sentence is Roman Urdu on purpose: it is what the farmer says.
const SENTENCE = [
  'Maine ',
  { text: '40 man', field: 'qty' },
  ' ',
  { text: 'gandum', field: 'crop' },
  ' ',
  { text: 'becha', field: 'type' },
  ', ',
  { text: '3,400 rupay fi man', field: 'rate' },
  '.',
]
// Columns follow the sentence order so the connector lines never cross.
const FIELDS = ['qty', 'crop', 'type', 'rate']
// Order the tokens light up in (left to right through the sentence).
const SEQUENCE = ['qty', 'crop', 'type', 'rate']

export default function ParseSentence() {
  const { t } = useI18n()
  const sectionRef = useRef(null)
  const boardRef = useRef(null)
  const tokenRefs = useRef({})
  const cellRefs = useRef({})
  const pathRefs = useRef({})
  const [lit, setLit] = useState(0)

  const draw = useCallback(p => {
    const board = boardRef.current
    if (!board) return
    const stage = range(p, 0.22, 0.52)
    const n = stage <= 0 ? 0 : Math.min(4, Math.floor(stage * 4) + 1)
    setLit(prev => (prev === n ? prev : n))

    const b = board.getBoundingClientRect()
    // Every connector leaves from under the whole sentence, so none cut through its text.
    const sentenceBottom = board.querySelector('.parse-sentence').getBoundingClientRect().bottom - b.top + 10
    SEQUENCE.forEach((f, k) => {
      const tok = tokenRefs.current[f]
      const cell = cellRefs.current[f]
      const path = pathRefs.current[f]
      if (!tok || !cell || !path) return
      const a = tok.getBoundingClientRect()
      const c = cell.getBoundingClientRect()
      const x1 = a.left + a.width / 2 - b.left
      const y1 = sentenceBottom
      const x2 = c.left + 18 - b.left
      const y2 = c.top - b.top - 4
      const my = (y1 + y2) / 2
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`)
      const d = range(stage, k / 4, (k + 0.85) / 4)
      path.style.strokeDashoffset = `${1 - d}`
    })
  }, [])

  useScrollTimeline(sectionRef, draw, { smoothing: 0.16 })

  const isLit = f => SEQUENCE.indexOf(f) < lit

  return (
    <section id="how-it-works" className="section parse t-light t-tint" ref={sectionRef}>
      <div className="container">
        <header className="section-head reveal">
          <div>
            <p className="eyebrow">{t('parse.eyebrow')}</p>
            <h2 className="h2">{t('parse.title')}</h2>
          </div>
          <p className="lead">{t('parse.lead')}</p>
        </header>

        <div className="parse-board" ref={boardRef}>
          <div className="parse-label">{t('parse.example')}</div>
          <p className="parse-sentence" dir="ltr" lang="ur-Latn">
            <span className="quote">“</span>
            {SENTENCE.map((part, i) => typeof part === 'string'
              ? <span key={i}>{part}</span>
              : (
                <span
                  key={i}
                  ref={el => { tokenRefs.current[part.field] = el }}
                  className={`token${isLit(part.field) ? ' on' : ''}`}
                >
                  {part.text}
                </span>
              ))}
            <span className="quote">”</span>
          </p>

          <svg className="parse-lines" aria-hidden="true">
            {SEQUENCE.map(f => <path key={f} ref={el => { pathRefs.current[f] = el }} pathLength="1" />)}
          </svg>

          <div className="parse-ledger">
            {FIELDS.map(f => (
              <div key={f} className={`parse-cell${isLit(f) ? ' on' : ''}`} ref={el => { cellRefs.current[f] = el }}>
                <span className="pc-label">{t(`parse.fields.${f}`)}</span>
                <span className="pc-value">{t(`parse.values.${f}`)}</span>
              </div>
            ))}
          </div>
        </div>

        <ol className="steps-row">
          {['s1', 's2', 's3', 's4'].map((s, i) => (
            <li key={s} className={`reveal reveal-d${i}`}>
              <span className="step-index">{i + 1}</span>
              <h3>{t(`steps.${s}.title`)}</h3>
              <p>{t(`steps.${s}.desc`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

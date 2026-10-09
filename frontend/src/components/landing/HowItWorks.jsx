import { useRef, useState } from 'react'
import { Mic, AudioLines, ListChecks, ShieldCheck } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'
import { useScrollTimeline, range } from '../../hooks/motion'

const STEPS = [
  { key: 's1', Icon: Mic },
  { key: 's2', Icon: AudioLines },
  { key: 's3', Icon: ListChecks },
  { key: 's4', Icon: ShieldCheck },
]

export default function HowItWorks() {
  const { t } = useI18n()
  const sectionRef = useRef(null)
  const lineRef = useRef(null)
  const [lit, setLit] = useState(0)

  // The line fills as the section scrolls through the middle of the screen,
  // lighting each step as it passes.
  useScrollTimeline(sectionRef, p => {
    const fill = range(p, 0.28, 0.62)
    if (lineRef.current) lineRef.current.style.transform = `scaleX(${fill})`
    const n = fill <= 0 ? 0 : Math.min(4, Math.floor(fill * 3.0001) + 1)
    setLit(prev => (prev === n ? prev : n))
  })

  return (
    <section id="how-it-works" className="section" ref={sectionRef}>
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">{t('steps.eyebrow')}</span>
          <h2 className="section-title">{t('steps.title')}</h2>
          <p className="section-lead">{t('steps.lead')}</p>
        </div>
        <div className="steps">
          <div className="steps-line" aria-hidden="true"><span ref={lineRef} /></div>
          {STEPS.map(({ key, Icon }, i) => (
            <div key={key} className={`step${i < lit ? ' lit' : ''}`}>
              <div className="step-dot"><Icon size={26} /></div>
              <div className="step-num">0{i + 1}</div>
              <h3>{t(`steps.${key}.title`)}</h3>
              <p>{t(`steps.${key}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

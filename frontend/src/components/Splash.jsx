import { useEffect, useState } from 'react'
import { Emblem } from './Icon'

// Opening screen, shown once each time the app starts (about 2.3 seconds, skipped with a click).
const STEPS = ['Checking the local services', 'Loading specification STS/UC/01', 'Preparing the inspection workspace']

export default function Splash({ onDone }) {
  const [step, setStep] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 700)
    const t2 = setTimeout(() => setStep(2), 1400)
    const t3 = setTimeout(() => setLeaving(true), 2300)
    const t4 = setTimeout(onDone, 2800)
    return () => [t1, t2, t3, t4].forEach(clearTimeout)
  }, [onDone])

  return (
    <div className={`splash${leaving ? ' out' : ''}`} onClick={onDone} role="status" aria-label="SentinelTex is starting">
      <div className="splash-inner">
        <Emblem size={96} />
        <div className="splash-word">SENTINEL<b>TEX</b></div>
        <div className="splash-sub">Military uniform fabric quality assurance</div>
        <div className="splash-bar"><i /></div>
        <div className="splash-step">{STEPS[step]}</div>
      </div>
    </div>
  )
}

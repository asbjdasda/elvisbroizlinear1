import { Activity, BarChart3, ExternalLink, Radar } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { achievementSummary, channelMetrics, chartSegments } from '../data/achievementMetrics'

const total = chartSegments.reduce((sum, item) => sum + item.value, 0)
const conicStops = chartSegments
  .reduce(
    (acc, item) => {
      const start = acc.cursor
      const end = start + (item.value / total) * 100
      acc.parts.push(`${item.color} ${start}% ${end}%`)
      acc.cursor = end
      return acc
    },
    { cursor: 0, parts: [] },
  )
  .parts.join(', ')

const defaultInViewOptions = { threshold: 0.3 }
const dashboardInViewOptions = { threshold: 0.08, rootMargin: '0px 0px -8% 0px' }

function formatCounterValue(value, progress) {
  const decimalRange = value.match(/^(\+?)(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(.*)$/)
  if (decimalRange) {
    const firstPrecision = decimalRange[2].includes('.') ? decimalRange[2].split('.')[1].length : 0
    const secondPrecision = decimalRange[3].includes('.') ? decimalRange[3].split('.')[1].length : 0
    const first = (Number(decimalRange[2]) * progress).toFixed(firstPrecision)
    const second = (Number(decimalRange[3]) * progress).toFixed(secondPrecision)
    return `${decimalRange[1]}${first}-${second}${decimalRange[4]}`
  }

  const range = value.match(/^(\+?)(\d+)-(\d+)(.*)$/)
  if (range) {
    const first = Math.round(Number(range[2]) * progress)
    const second = Math.round(Number(range[3]) * progress)
    return `${range[1]}${first}-${second}${range[4]}`
  }

  const match = value.match(/^(\+?)(\d+)(.*)$/)
  if (!match) return value
  return `${match[1]}${Math.round(Number(match[2]) * progress)}${match[3]}`
}

function useInViewOnce(options = defaultInViewOptions) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setInView(true)
        observer.disconnect()
      },
      options,
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [options])

  return [ref, inView]
}

function AnimatedValue({ value }) {
  const [ref, inView] = useInViewOnce()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!inView) return undefined
    let frame = 0
    const start = performance.now()
    const duration = 1200

    function tick(now) {
      const raw = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - raw, 3)
      setProgress(eased)
      if (raw < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView])

  return <strong ref={ref}>{formatCounterValue(value, progress)}</strong>
}

function SplitHeading({ children }) {
  return (
    <h3 aria-label={children}>
      {children.split('').map((letter, index) => (
        <span className="split-char" style={{ '--char-index': index }} aria-hidden="true" key={`${letter}-${index}`}>
          {letter === ' ' ? '\u00a0' : letter}
        </span>
      ))}
    </h3>
  )
}

function AchievementDashboard() {
  const [dashboardRef, dashboardInView] = useInViewOnce(dashboardInViewOptions)

  return (
    <div className={dashboardInView ? 'achievement-block is-in-view' : 'achievement-block'} ref={dashboardRef}>
      <div className="achievement-block__heading motion-title">
        <p>Career Performance</p>
        <SplitHeading>Achievement Dashboard</SplitHeading>
        <span>Resume verified data</span>
      </div>

      <section className="achievement-dashboard motion-card" aria-label="Career performance dashboard">
      <div className="achievement-dashboard__grid">
        <div className="achievement-dashboard__chart-card">
          <div className="achievement-dashboard__chart-head">
            <span>
              <Radar size={16} />
              Work Mix
            </span>
            <strong>2022-2026</strong>
          </div>
          <div className="achievement-dashboard__donut" style={{ '--achievement-chart': conicStops }}>
            <div>
              <AnimatedValue value="4" />
              <span>Core Tracks</span>
            </div>
          </div>
          <div className="achievement-dashboard__legend">
            {chartSegments.map((item) => (
              <span key={item.label}>
                <i style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="achievement-dashboard__metrics">
          {achievementSummary.map((item) => (
            <article className={`achievement-metric achievement-metric--${item.tone}`} key={item.label}>
              <div>
                <span>{item.label}</span>
                <AnimatedValue value={item.value} />
              </div>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>

        <div className="achievement-dashboard__channels">
          <div className="achievement-dashboard__channels-head">
            <span>
              <BarChart3 size={16} />
              Social / Commerce Signals
            </span>
            <Activity size={18} />
          </div>
          <div className="achievement-dashboard__channel-list">
            {channelMetrics.map((item) => (
              <article className="achievement-channel" key={item.channel}>
                <div className="achievement-channel__icon">{item.icon}</div>
                <div>
                  <span>{item.channel}</span>
                  <AnimatedValue value={item.metric} />
                  <p>{item.label}</p>
                </div>
                <small>{item.note}</small>
              </article>
            ))}
          </div>
          <a className="achievement-dashboard__link" href="https://www.zcool.com.cn/u/21518952" target="_blank" rel="noreferrer">
            View Portfolio Signals
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
      </section>
    </div>
  )
}

export default AchievementDashboard

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const CONFIG = { minCopies: 2, copyHeadroom: 2 }

function useResize(callback, refs, deps) {
  useEffect(() => {
    if (!window.ResizeObserver) {
      window.addEventListener('resize', callback)
      callback()
      return () => window.removeEventListener('resize', callback)
    }

    const observers = refs.map((ref) => {
      if (!ref.current) return null
      const observer = new ResizeObserver(callback)
      observer.observe(ref.current)
      return observer
    })
    callback()
    return () => observers.forEach((observer) => observer?.disconnect())
  }, [callback, deps, refs])
}

function useAnimation(trackRef, velocity, sequenceSize, hovered, hoverSpeed, vertical) {
  const rafRef = useRef(null)
  const lastRef = useRef(null)
  const offsetRef = useRef(0)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return undefined

    const animate = (timestamp) => {
      if (lastRef.current === null) lastRef.current = timestamp
      const delta = Math.max(0, timestamp - lastRef.current) / 1000
      lastRef.current = timestamp
      const target = hovered && hoverSpeed !== undefined ? hoverSpeed : velocity

      if (sequenceSize > 0) {
        const next = offsetRef.current + target * delta
        offsetRef.current = ((next % sequenceSize) + sequenceSize) % sequenceSize
        track.style.transform = vertical
          ? `translate3d(0, ${-offsetRef.current}px, 0)`
          : `translate3d(${-offsetRef.current}px, 0, 0)`
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastRef.current = null
    }
  }, [hoverSpeed, hovered, sequenceSize, trackRef, velocity, vertical])
}

const LogoLoop = memo(function LogoLoop({
  logos,
  speed = 120,
  direction = 'left',
  logoHeight = 48,
  gap = 72,
  hoverSpeed = 0,
  fadeOut = true,
  fadeOutColor = '#020203',
  scaleOnHover = false,
  renderItem,
  ariaLabel = 'Partner logos',
  className = '',
}) {
  const containerRef = useRef(null)
  const trackRef = useRef(null)
  const sequenceRef = useRef(null)
  const [copyCount, setCopyCount] = useState(CONFIG.minCopies)
  const [sequenceSize, setSequenceSize] = useState(0)
  const [hovered, setHovered] = useState(false)
  const vertical = direction === 'up' || direction === 'down'

  const velocity = useMemo(() => {
    const directionMultiplier = vertical ? (direction === 'up' ? 1 : -1) : direction === 'left' ? 1 : -1
    return Math.abs(speed) * directionMultiplier * (speed < 0 ? -1 : 1)
  }, [direction, speed, vertical])

  const updateDimensions = useCallback(() => {
    const viewport = vertical ? containerRef.current?.clientHeight || 0 : containerRef.current?.clientWidth || 0
    const rect = sequenceRef.current?.getBoundingClientRect()
    const size = vertical ? rect?.height || 0 : rect?.width || 0
    if (size > 0) {
      setSequenceSize(Math.ceil(size))
      setCopyCount(Math.max(CONFIG.minCopies, Math.ceil(viewport / size) + CONFIG.copyHeadroom))
    }
  }, [vertical])

  useResize(updateDimensions, [containerRef, sequenceRef], [logos, gap, logoHeight, vertical])
  useAnimation(trackRef, velocity, sequenceSize, hovered, hoverSpeed, vertical)

  const renderLogo = useCallback(
    (item, key) => (
      <li className="logoloop__item" key={key} role="listitem">
        {renderItem ? (
          renderItem(item)
        ) : (
          <img src={item.src} alt={item.alt || item.title || ''} draggable={false} loading="lazy" decoding="async" />
        )}
      </li>
    ),
    [renderItem],
  )

  return (
    <div
      ref={containerRef}
      className={`logoloop ${vertical ? 'logoloop--vertical' : 'logoloop--horizontal'} ${
        fadeOut ? 'logoloop--fade' : ''
      } ${scaleOnHover ? 'logoloop--scale-hover' : ''} ${className}`}
      style={{ '--logoloop-logoHeight': `${logoHeight}px`, '--logoloop-gap': `${gap}px`, '--logoloop-fadeColor': fadeOutColor }}
      role="region"
      aria-label={ariaLabel}
    >
      <div
        className="logoloop__track"
        ref={trackRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {Array.from({ length: copyCount }, (_, copyIndex) => (
          <ul
            className="logoloop__list"
            key={`copy-${copyIndex}`}
            role="list"
            aria-hidden={copyIndex > 0}
            ref={copyIndex === 0 ? sequenceRef : undefined}
          >
            {logos.map((item, index) => renderLogo(item, `${copyIndex}-${index}`))}
          </ul>
        ))}
      </div>
    </div>
  )
})

export default LogoLoop

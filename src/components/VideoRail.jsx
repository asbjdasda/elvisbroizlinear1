import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mediaPath, productVideoPreviewPath } from '../utils/mediaPaths'

function wrapIndex(value, length) {
  if (!length) return 0
  return ((value % length) + length) % length
}

function getOffset(index, activeIndex, length) {
  let offset = index - activeIndex
  const half = length / 2
  if (offset > half) offset -= length
  if (offset < -half) offset += length
  return offset
}

function cleanTitle(item, fallbackPrefix = 'Project Film') {
  const raw = item?.title || ''
  const isReadable = /^[\x20-\x7E]{3,}$/.test(raw) && !/[?]{2,}/.test(raw)

  if (isReadable) return raw

  const fromId = item?.id
    ?.replace(/^\d+-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

  return fromId || fallbackPrefix
}

function previewPath(item) {
  return productVideoPreviewPath(item, {
    baseUrl: import.meta.env.BASE_URL,
    production: import.meta.env.PROD,
  })
}

function localMediaPath(src) {
  return mediaPath(src, { baseUrl: import.meta.env.BASE_URL })
}

function VideoRail({ category, items, titlePrefix = category?.label || 'Project Film', mode = 'horizontal', onOpen }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [hoverDirection, setHoverDirection] = useState(0)
  const [feedbackDirection, setFeedbackDirection] = useState(0)
  const stageRef = useRef(null)
  const activeVideoRef = useRef(null)
  const dragRef = useRef(null)
  const wheelRef = useRef({ delta: 0, time: 0 })
  const safeItems = useMemo(() => {
    const sourceItems = Array.isArray(items) && items.length ? items : category?.items
    return Array.isArray(sourceItems) ? sourceItems : []
  }, [category, items])
  const activeSafeIndex = wrapIndex(activeIndex, safeItems.length)
  const activeItem = safeItems[activeSafeIndex]
  const activeVideoSrc = activeItem ? previewPath(activeItem) : ''
  const railClass = `product-rail product-rail--${mode}${feedbackDirection ? ' is-switching' : ''}`

  const visibleItems = useMemo(
    () =>
      safeItems.map((item, index) => ({
        item,
        index,
        offset: getOffset(index, wrapIndex(activeIndex, safeItems.length), safeItems.length),
      })),
    [activeIndex, safeItems],
  )

  const select = useCallback((nextIndex) => {
    if (!safeItems.length) return
    const next = wrapIndex(nextIndex, safeItems.length)
    if (next !== activeSafeIndex) {
      setFeedbackDirection(nextIndex > activeIndex ? 1 : -1)
    }
    setActiveIndex(next)
  }, [activeIndex, activeSafeIndex, safeItems.length])

  const handleWheel = useCallback(
    (event) => {
      if (!safeItems.length) return
      event.preventDefault()
      event.stopPropagation()

      const primaryDelta =
        mode === 'vertical'
          ? Math.abs(event.deltaY) >= Math.abs(event.deltaX)
            ? event.deltaY
            : event.deltaX
          : Math.abs(event.deltaX) >= Math.abs(event.deltaY)
            ? event.deltaX
            : event.deltaY

      wheelRef.current.delta += primaryDelta
      const now = performance.now()
      if (Math.abs(wheelRef.current.delta) < 42 || now - wheelRef.current.time < 180) return

      const direction = wheelRef.current.delta > 0 ? 1 : -1
      wheelRef.current = { delta: 0, time: now }
      setFeedbackDirection(direction)
      setActiveIndex((current) => wrapIndex(current + direction, safeItems.length))
    },
    [mode, safeItems.length],
  )

  useEffect(() => {
    if (!feedbackDirection) return undefined
    const timer = window.setTimeout(() => setFeedbackDirection(0), 360)
    return () => window.clearTimeout(timer)
  }, [feedbackDirection])

  useEffect(() => {
    const video = activeVideoRef.current
    if (!video || !activeVideoSrc) return

    video.play().catch(() => {})
  }, [activeVideoSrc])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    stage.addEventListener('wheel', handleWheel, { passive: false })
    return () => stage.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  function handlePointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const direction = event.clientX < rect.left + rect.width / 2 ? -1 : 1
    setHoverDirection(direction)
  }

  function handlePointerDown(event) {
    if (event.target.closest('button') || event.target.closest('.product-card')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, activeIndex }
  }

  function handlePointerUp(event) {
    const start = dragRef.current
    dragRef.current = null
    if (!start) return

    const delta = mode === 'vertical' ? event.clientY - start.y : event.clientX - start.x
    if (Math.abs(delta) < 42) return
    select(start.activeIndex + (delta < 0 ? 1 : -1))
  }

  return (
    <article className={railClass} data-category={category.id}>
      <div className="product-rail__header">
        <div>
          <span>
            {category.number} / {titlePrefix}
          </span>
          <h3>{cleanTitle(activeItem, titlePrefix)}</h3>
        </div>
        <div className="product-rail__actions">
          <button type="button" onClick={() => select(activeIndex - 1)} aria-label="Previous video">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => select(activeIndex + 1)} aria-label="Next video">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div
        className="product-rail__stage"
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerCancel={() => {
          dragRef.current = null
          setHoverDirection(0)
        }}
        onPointerLeave={() => {
          setHoverDirection(0)
          wheelRef.current.delta = 0
        }}
      >
        {visibleItems.map(({ item, index, offset }) => {
          const active = offset === 0
          const abs = Math.abs(offset)
          const visible = abs <= 2
          const spread = mode === 'vertical' ? 180 : 380
          const x = mode === 'vertical' ? offset * 34 : offset * spread + hoverDirection * abs * -10
          const y = mode === 'vertical' ? offset * 104 : abs * 20
          const scale = Math.max(0.72, 1 - abs * 0.12)

          return (
            <article
              className={active ? 'product-card is-active motion-card' : 'product-card'}
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={active ? `Play ${cleanTitle(item, titlePrefix)}` : `Show ${cleanTitle(item, titlePrefix)}`}
              style={{
                zIndex: active ? 40 : 30 - abs,
                opacity: visible ? Math.max(0.18, 1 - abs * 0.32) : 0,
                pointerEvents: active || abs === 1 ? 'auto' : 'none',
                transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) scale(${scale})`,
                filter: `blur(${Math.min(6, abs * 2.5)}px) brightness(${Math.max(0.54, 1 - abs * 0.16)})`,
              }}
              onClick={() => {
                if (active) onOpen(item)
                else select(index)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                if (active) onOpen(item)
                else select(index)
              }}
            >
              {active ? (
                <video
                  ref={activeVideoRef}
                  key={`video-${item.id}`}
                  className="product-card__media"
                  src={active ? previewPath(item) : undefined}
                  poster={localMediaPath(item.poster)}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={`${cleanTitle(item, titlePrefix)} preview`}
                  onCanPlay={(event) => {
                    event.currentTarget.play().catch(() => {})
                  }}
                />
              ) : (
                <img
                  key={`poster-${item.id}`}
                  className="product-card__media"
                  src={localMediaPath(item.poster)}
                  alt={`${cleanTitle(item)} poster`}
                  loading="lazy"
                />
              )}
              <div className="product-card__shade" />
              <div className="product-card__meta">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{cleanTitle(item, titlePrefix)}</strong>
              </div>
              {active && (
                <>
                  <button
                    className="product-card__play"
                    type="button"
                    aria-label={`Play ${cleanTitle(item, titlePrefix)}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpen(item)
                    }}
                  >
                    <Play size={28} fill="currentColor" />
                  </button>
                  <button
                    className="product-card__demo"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpen(item)
                    }}
                  >
                    <Play size={14} fill="currentColor" />
                    Demo
                  </button>
                </>
              )}
            </article>
          )
        })}
      </div>

      <div className="product-rail__footer">
        <span>{String(wrapIndex(activeIndex, safeItems.length) + 1).padStart(2, '0')}</span>
        <div>
          {safeItems.map((item, index) => (
            <button
              className={wrapIndex(activeIndex, safeItems.length) === index ? 'is-active' : ''}
              key={item.id}
              type="button"
              aria-label={`Show ${cleanTitle(item)}`}
              onClick={() => select(index)}
            />
          ))}
        </div>
        <span>{String(safeItems.length).padStart(2, '0')}</span>
      </div>
    </article>
  )
}

export default VideoRail

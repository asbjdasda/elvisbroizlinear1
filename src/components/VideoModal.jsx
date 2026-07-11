import {
  Check,
  Copy,
  Gauge,
  Maximize2,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Send,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import gsap from 'gsap'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Loader from './Loader'
import { mediaPath, productVideoPath } from '../utils/mediaPaths'
import {
  buildVideoShareUrl,
  formatVideoTime,
  getBufferedPercent,
  pointerPercentFromRect,
  timeFromPercent,
  timePercent,
  trimComments,
} from '../utils/videoUi'

const speedOptions = [2, 1.5, 1, 0.7, 0.5]
const defaultComments = [
  { id: 'seed-handsome', author: 'Pinned', text: '帅帅帅帅帅帅帅帅帅帅帅帅', time: 'Just now', pinned: true },
  { id: 'seed-666', author: 'Visitor', text: '666666666666666', time: 'Just now', pinned: true },
]

const shareTargets = [
  { name: 'Facebook', icon: '/assets/ui/social-facebook.jpg', href: 'https://www.facebook.com/' },
  { name: 'Instagram', icon: '/assets/ui/social-instagram.jpg', href: 'https://www.instagram.com/' },
  { name: 'X', icon: '/assets/ui/social-x.jpg', href: 'https://x.com/' },
  { name: 'YouTube', icon: '/assets/ui/social-youtube.jpg', href: 'https://www.youtube.com/' },
]

function cleanTitle(item) {
  return item?.title || 'Project film'
}

function runtimeMediaOptions() {
  return {
    baseUrl: import.meta.env.BASE_URL,
    production: import.meta.env.PROD,
    r2AssetBase: import.meta.env.VITE_R2_ASSET_BASE,
    videoGatewayBase: import.meta.env.VITE_VIDEO_GATEWAY_BASE,
  }
}

function readComments(storageKey) {
  try {
    const saved = window.localStorage.getItem(storageKey)
    const parsed = saved ? JSON.parse(saved) : []
    return trimComments(parsed, 18)
  } catch {
    return []
  }
}

function writeComments(storageKey, comments) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(trimComments(comments, 18)))
  } catch {
    // localStorage can be unavailable in private or embedded browsers.
  }
}

function browserShareUrl(itemId) {
  if (typeof window === 'undefined') return buildVideoShareUrl(itemId)
  return buildVideoShareUrl(itemId, {
    origin: window.location.origin,
    pathname: window.location.pathname,
    search: window.location.search,
  })
}

function bufferedRanges(video) {
  if (!video?.buffered) return []
  return Array.from({ length: video.buffered.length }, (_, index) => [video.buffered.start(index), video.buffered.end(index)])
}

function VideoModalContent({ item, onClose }) {
  const videoRef = useRef(null)
  const panelRef = useRef(null)
  const progressRef = useRef(null)
  const controlsRef = useRef(null)
  const controlsHideTimerRef = useRef(null)
  const storageKey = `brozien-comments:${item.id}`
  const [loadedSrc, setLoadedSrc] = useState(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activePanel, setActivePanel] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [buffering, setBuffering] = useState(true)
  const [bufferedProgress, setBufferedProgress] = useState(0)
  const [playedProgress, setPlayedProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [progressPreview, setProgressPreview] = useState({ percent: 0, label: '00:00', visible: false })
  const [scrubbing, setScrubbing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [comments, setComments] = useState(() => readComments(storageKey))
  const [commentsExpanded, setCommentsExpanded] = useState(false)

  const options = runtimeMediaOptions()
  const sourcePath = item.src || item.previewSrc
  const [videoSourceError, setVideoSourceError] = useState('')
  const videoSrc = productVideoPath(sourcePath, options)
  const posterSrc = mediaPath(item.poster, options)
  const shareUrl = useMemo(() => browserShareUrl(item.id), [item.id])
  const displayComments = useMemo(() => trimComments([...defaultComments, ...comments]), [comments])
  const loading = loadedSrc !== videoSrc || buffering
  const commentCount = useMemo(() => displayComments.length.toString().padStart(2, '0'), [displayComments.length])

  function clearControlsHideTimer() {
    if (controlsHideTimerRef.current) {
      window.clearTimeout(controlsHideTimerRef.current)
      controlsHideTimerRef.current = null
    }
  }

  function scheduleControlsHide(delay = 1200) {
    clearControlsHideTimer()
    if (!videoRef.current || videoRef.current.paused || menuOpen || activePanel) return
    controlsHideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false)
    }, delay)
  }

  function revealControls(delay = 1200) {
    setControlsVisible(true)
    scheduleControlsHide(delay)
  }

  function hideControlsNow() {
    clearControlsHideTimer()
    if (menuOpen || activePanel) return
    setControlsVisible(false)
  }

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
        else if (activePanel) setActivePanel(null)
        else onClose()
      }
    }

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    window.setTimeout(() => videoRef.current?.focus(), 0)

    return () => {
      clearControlsHideTimer()
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activePanel, onClose])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    gsap.to(controls, {
      autoAlpha: controlsVisible ? 1 : 0,
      y: controlsVisible ? 0 : 18,
      duration: controlsVisible ? 0.28 : 0.42,
      ease: controlsVisible ? 'power2.out' : 'power3.inOut',
      overwrite: true,
    })
  }, [controlsVisible])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = playbackRate
  }, [playbackRate, videoSrc])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = muted ? 0 : volume
    video.muted = muted
  }, [muted, videoSrc, volume])

  useEffect(() => {
    if (activePanel !== 'comments') return
    videoRef.current?.pause()
  }, [activePanel])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === panelRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  async function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      await video.play().catch(() => {})
      hideControlsNow()
    } else {
      video.pause()
      clearControlsHideTimer()
      setControlsVisible(true)
    }
  }

  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    const nextMuted = !muted
    video.muted = nextMuted
    if (!nextMuted && video.volume === 0) {
      video.volume = volume || 0.68
      setVolume(video.volume)
    }
    setMuted(nextMuted)
  }

  function handleVolumeChange(event) {
    const nextVolume = Number(event.target.value)
    const video = videoRef.current
    setVolume(nextVolume)
    setMuted(nextVolume === 0)
    if (video) {
      video.volume = nextVolume
      video.muted = nextVolume === 0
    }
  }

  async function toggleFullscreen() {
    if (videoRef.current && !videoRef.current.paused) hideControlsNow()
    else revealControls(1600)
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {})
      return
    }
    await panelRef.current?.requestFullscreen?.().catch(() => {})
  }

  function updateProgress() {
    const video = videoRef.current
    if (!video) return
    setDuration(Number.isFinite(video.duration) ? video.duration : 0)
    setPlayedProgress(timePercent(video.currentTime, video.duration))
    setBufferedProgress(getBufferedPercent({ duration: video.duration, bufferedRanges: bufferedRanges(video) }))
  }

  function seekVideo(event) {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return
    const nextPercent = Number(event.target.value)
    video.currentTime = (nextPercent / 100) * video.duration
    setPlayedProgress(nextPercent)
  }

  function progressPointerState(event) {
    const progress = progressRef.current
    const video = videoRef.current
    if (!progress || !video) return null
    const rect = progress.getBoundingClientRect()
    const percent = pointerPercentFromRect({ clientX: event.clientX, left: rect.left, width: rect.width })
    const previewTime = timeFromPercent(percent, video.duration || duration)
    return { percent, time: previewTime, label: formatVideoTime(previewTime) }
  }

  function updateProgressPreview(event, shouldSeek = false) {
    const nextPreview = progressPointerState(event)
    const video = videoRef.current
    if (!nextPreview || !video) return
    setProgressPreview({ ...nextPreview, visible: true })
    if (shouldSeek && Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = nextPreview.time
      setPlayedProgress(nextPreview.percent)
    }
  }

  function handleProgressPointerMove(event) {
    updateProgressPreview(event, scrubbing)
  }

  function handleProgressPointerDown(event) {
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setScrubbing(true)
    revealControls(1800)
    updateProgressPreview(event, true)
  }

  function handleProgressPointerUp(event) {
    if (scrubbing) updateProgressPreview(event, true)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setScrubbing(false)
    scheduleControlsHide(1000)
  }

  function handleProgressPointerLeave() {
    if (scrubbing) return
    setProgressPreview((current) => ({ ...current, visible: false }))
  }

  function handlePlayerPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const bottomHoverZone = event.clientY >= rect.bottom - 112
    if (bottomHoverZone) {
      revealControls(1200)
      return
    }
    if (videoRef.current && !videoRef.current.paused) hideControlsNow()
  }

  function openPanel(panel) {
    if (panel === 'comments' && activePanel !== 'comments') {
      setCommentsExpanded(false)
      setIsPlaying(false)
    }
    setActivePanel((current) => (current === panel ? null : panel))
    setMenuOpen(false)
    setCopied(false)
    revealControls(3000)
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      const input = document.createElement('textarea')
      input.value = shareUrl
      input.setAttribute('readonly', '')
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function openShareTarget(target) {
    await copyShareUrl()
    window.open(target.href, '_blank', 'noopener,noreferrer')
  }

  function sendComment(event) {
    event.preventDefault()
    const text = commentDraft.trim()
    if (!text) return

    const nextComments = [
      {
        id: `${item.id}-${Date.now()}`,
        author: 'Visitor',
        text,
        time: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      },
      ...comments,
    ].slice(0, 18)

    setComments(nextComments)
    writeComments(storageKey, nextComments)
    setCommentDraft('')
  }

  return (
    <div className="video-modal" role="dialog" aria-modal="true" aria-label={`${cleanTitle(item)} demo`}>
      <button className="video-modal__backdrop" type="button" aria-label="Close video backdrop" onClick={onClose} />
      <div ref={panelRef} className={`video-modal__panel video-modal__panel--${item.orientation}${isFullscreen ? ' is-fullscreen' : ''}`}>
        <div className="video-modal__topbar">
          <div>
            <span>{item.category}</span>
            <strong>{cleanTitle(item)}</strong>
          </div>
          <button className="video-modal__close" type="button" aria-label="Close video" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div
          className={`video-player${!controlsVisible ? ' has-hidden-controls' : ''}`}
          onDoubleClick={toggleFullscreen}
          onMouseMove={handlePlayerPointerMove}
          onMouseLeave={() => scheduleControlsHide(500)}
          onFocus={() => revealControls(1600)}
        >
          {loading && (
            <div className="video-modal__loading">
              <Loader className="video-modal__loader" label="Loading video" />
              <div className="video-modal__loading-progress" aria-label="Video loading progress">
                <span style={{ width: `${Math.max(8, bufferedProgress)}%` }} />
              </div>
              {videoSourceError && <p className="video-modal__loading-error">{videoSourceError}</p>}
            </div>
          )}
          {videoSrc && <video
            key={videoSrc}
            ref={videoRef}
            src={videoSrc}
            poster={posterSrc}
            autoPlay
            playsInline
            preload="metadata"
            tabIndex={-1}
            controls={false}
            controlsList="nodownload noremoteplayback nofullscreen"
            disablePictureInPicture
            onContextMenu={(event) => event.preventDefault()}
            onClick={togglePlay}
            onDoubleClick={(event) => {
              event.preventDefault()
              toggleFullscreen()
            }}
            onPlay={() => {
              setIsPlaying(true)
              hideControlsNow()
            }}
            onPause={() => {
              setIsPlaying(false)
              clearControlsHideTimer()
              setControlsVisible(true)
            }}
            onLoadStart={() => setBuffering(true)}
            onError={() => {
              setLoadedSrc(videoSrc)
              setBuffering(false)
              setVideoSourceError('Video is temporarily unavailable. Please try again.')
            }}
            onLoadedMetadata={updateProgress}
            onProgress={updateProgress}
            onTimeUpdate={updateProgress}
            onWaiting={() => setBuffering(true)}
            onCanPlay={() => {
              setLoadedSrc(videoSrc)
              setBuffering(false)
              updateProgress()
            }}
            onLoadedData={() => {
              setLoadedSrc(videoSrc)
              setBuffering(false)
              updateProgress()
            }}
            onPlaying={() => setBuffering(false)}
          />}

          <div ref={controlsRef} className="video-player__controls" aria-label="Video controls">
            <button className="video-player__button video-player__button--primary" type="button" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>

            <div className="video-player__volume">
              <button className="video-player__button" type="button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <label className="video-player__volume-slider" aria-label="Volume">
                <input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} onChange={handleVolumeChange} />
              </label>
            </div>

            <button className="video-player__button" type="button" aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen}>
              <Maximize2 size={18} />
            </button>

            <div className="video-player__more">
              <button
                className="video-player__button"
                type="button"
                aria-label="More video actions"
                onClick={() => {
                  setActivePanel(null)
                  setMenuOpen((current) => !current)
                  revealControls(3000)
                }}
              >
                <MoreHorizontal size={20} />
              </button>
              {menuOpen && (
                <div className="video-player__menu">
                  <button type="button" onClick={() => openPanel('speed')}>
                    <Gauge size={16} />
                    <span>Speed</span>
                  </button>
                  <button type="button" onClick={() => openPanel('comments')}>
                    <MessageCircle size={16} />
                    <span>Comments</span>
                  </button>
                  <button type="button" onClick={() => openPanel('share')}>
                    <Share2 size={16} />
                    <span>Share</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div
            ref={progressRef}
            className={`video-player__progress${progressPreview.visible ? ' is-previewing' : ''}${scrubbing ? ' is-scrubbing' : ''}`}
            style={{
              '--played-progress': `${playedProgress}%`,
              '--buffered-progress': `${bufferedProgress}%`,
              '--preview-progress': `${progressPreview.percent}%`,
            }}
            onPointerMove={handleProgressPointerMove}
            onPointerDown={handleProgressPointerDown}
            onPointerUp={handleProgressPointerUp}
            onPointerCancel={handleProgressPointerUp}
            onPointerLeave={handleProgressPointerLeave}
          >
            <output className="video-player__time-tip" style={{ left: `${progressPreview.percent}%` }} aria-live="polite">
              {progressPreview.label}
            </output>
            <div className="video-player__progress-buffer" />
            <div className="video-player__progress-played" />
            <input type="range" min="0" max="100" step="0.1" value={playedProgress} aria-label="Video playback progress" onChange={seekVideo} />
          </div>
        </div>

        {activePanel === 'speed' && (
          <div className="video-popover video-popover--speed" role="dialog" aria-label="Playback speed">
            {speedOptions.map((speed) => (
              <button className={playbackRate === speed ? 'is-active' : ''} key={speed} type="button" onClick={() => setPlaybackRate(speed)}>
                <Gauge size={16} />
                <span>{speed.toFixed(speed % 1 === 0 ? 0 : 1)}x</span>
              </button>
            ))}
          </div>
        )}

        {activePanel === 'share' && (
          <div className="video-popover video-popover--share" role="dialog" aria-label="Share video">
            <button className="video-popover__close" type="button" aria-label="Close share" onClick={() => setActivePanel(null)}>
              <X size={16} />
            </button>
            <div className="video-share__icon">
              <Share2 size={22} />
            </div>
            <strong>Share</strong>
            <div className="video-share__targets" aria-label="Social share targets">
              {shareTargets.map((target) => (
                <button className={`video-share__target video-share__target--${target.name.toLowerCase()}`} key={target.name} type="button" onClick={() => openShareTarget(target)}>
                  <span>
                    <img src={mediaPath(target.icon, options)} alt="" />
                  </span>
                  <em>{target.name}</em>
                </button>
              ))}
            </div>
            <div className="video-share__link">
              <span>{shareUrl}</span>
              <button type="button" onClick={copyShareUrl}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {activePanel === 'comments' && (
          <div className={`video-popover video-popover--comments${commentsExpanded ? ' is-expanded' : ''}`} role="dialog" aria-label="Video comments">
            <button className="video-popover__close" type="button" aria-label="Close comments" onClick={() => setActivePanel(null)}>
              <X size={16} />
            </button>
            <div className="video-comments__head">
              <div>
                <span>{new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                <strong>Comments</strong>
                <em>Pinned</em>
              </div>
              <b>{commentCount} visitors</b>
            </div>
            <div className="video-comments__expand-preview">
              <div>
                {defaultComments.map((comment) => (
                  <p key={comment.id}>{comment.text}</p>
                ))}
              </div>
              <button
                className={commentsExpanded ? 'is-expanded' : ''}
                type="button"
                aria-label={commentsExpanded ? 'Collapse comments' : 'Expand comments'}
                aria-expanded={commentsExpanded}
                onClick={() => setCommentsExpanded((current) => !current)}
              >
                <img src={mediaPath('/assets/ui/comments-expand.svg', options)} alt="" />
              </button>
            </div>
            <div className="video-comments__list" hidden={!commentsExpanded}>
              {comments.length ? (
                comments.map((comment) => (
                  <article className={comment.pinned ? 'is-pinned' : ''} key={comment.id}>
                    <span>{comment.author}</span>
                    <p>{comment.text}</p>
                    <time>{comment.time}</time>
                    <button type="button">Reply</button>
                  </article>
                ))
              ) : (
                <p className="video-comments__empty">Be first to leave a note.</p>
              )}
            </div>
            <form className="video-comments__form" onSubmit={sendComment}>
              <input value={commentDraft} maxLength={180} placeholder="Write a comment" onChange={(event) => setCommentDraft(event.target.value)} />
              <button type="submit" aria-label="Send comment">
                <span className="video-comments__send-icon" aria-hidden="true">
                  <Send size={17} />
                </span>
                <span>Send</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

function VideoModal({ item, onClose }) {
  if (!item) return null
  if (typeof document === 'undefined') return null
  return createPortal(<VideoModalContent key={item.id} item={item} onClose={onClose} />, document.body)
}

export default VideoModal

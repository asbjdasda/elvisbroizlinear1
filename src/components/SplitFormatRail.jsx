import { useMemo, useState } from 'react'
import VideoRail from './VideoRail'

const videoIconSrc = `${import.meta.env.BASE_URL}assets/project-icons/video_fill.png`

function mediaPath(src) {
  if (!src) return ''
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src
  return `${import.meta.env.BASE_URL}${src.replace(/^\//, '')}`
}

function SplitFormatRail({ category, onOpen }) {
  const [format, setFormat] = useState(null)
  const landscapeItems = useMemo(() => category.items.filter((item) => item.orientation === 'landscape'), [category])
  const portraitItems = useMemo(() => category.items.filter((item) => item.orientation === 'portrait'), [category])

  if (format === 'landscape') {
    return (
      <div className="split-format split-format--active">
        <button className="split-format__back" type="button" onClick={() => setFormat(null)}>
          <img src={videoIconSrc} alt="" />
          Choose format
        </button>
        <VideoRail key="landscape" category={category} items={landscapeItems} titlePrefix="Landscape" mode="horizontal" onOpen={onOpen} />
      </div>
    )
  }

  if (format === 'portrait') {
    return (
      <div className="split-format split-format--active">
        <button className="split-format__back" type="button" onClick={() => setFormat(null)}>
          <img src={videoIconSrc} alt="" />
          Choose format
        </button>
        <VideoRail key="portrait" category={category} items={portraitItems} titlePrefix="Portrait" mode="vertical" onOpen={onOpen} />
      </div>
    )
  }

  return (
    <div className="split-format" aria-label="Select video format">
      <button className="split-format__choice split-format__choice--landscape" type="button" onClick={() => setFormat('landscape')}>
        <div className="split-format__stack" aria-hidden="true">
          {landscapeItems.slice(0, 5).map((item, index) => (
            <img key={item.id} src={mediaPath(item.poster)} alt="" style={{ '--stack-index': index }} loading="lazy" />
          ))}
        </div>
        <span>Landscape</span>
      </button>
      <button className="split-format__choice split-format__choice--portrait" type="button" onClick={() => setFormat('portrait')}>
        <div className="split-format__stack" aria-hidden="true">
          {portraitItems.slice(0, 5).map((item, index) => (
            <img key={item.id} src={mediaPath(item.poster)} alt="" style={{ '--stack-index': index }} loading="lazy" />
          ))}
        </div>
        <span>Portrait</span>
      </button>
    </div>
  )
}

export default SplitFormatRail

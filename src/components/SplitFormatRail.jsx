import { useMemo, useState } from 'react'
import DepthCarousel from './DepthCarousel'
import ScrollStack, { ScrollStackItem } from './ScrollStack'
import './FilmGallery.css'

const videoIconSrc = `${import.meta.env.BASE_URL}assets/project-icons/video_fill.png`

function mediaPath(src) {
  if (!src) return ''
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src
  return `${import.meta.env.BASE_URL}${src.replace(/^\//, '')}`
}

function SplitFormatRail({ category, onOpen, modalOpen }) {
  const [format, setFormat] = useState(null)
  const landscapeItems = useMemo(() => category.items.filter((item) => item.orientation === 'landscape'), [category])
  const portraitItems = useMemo(() => category.items.filter((item) => item.orientation === 'portrait'), [category])

  const slides = useMemo(() => portraitItems.map((item) => ({
    ...item, image: mediaPath(item.poster), alt: item.title,
  })), [portraitItems])

  if (format) {
    return (
      <div className="split-format split-format--active film-gallery">
        <div className="film-gallery__head">
          <h3>{format === 'portrait' ? 'Portrait' : 'Landscape'}</h3>
          <button className="split-format__back" type="button" onClick={() => setFormat(null)}>
            <img src={videoIconSrc} alt="" />
            Choose format
          </button>
        </div>
        {format === 'portrait' ? (
          <div className="film-gallery__portraits">
            <DepthCarousel items={slides} cardWidth={270} cardHeight={480}
              autoplay={!modalOpen} loop onOpen={onOpen} />
          </div>
        ) : (
          <ScrollStack className="film-gallery__landscape" stackPosition={12} itemStackDistance={8}
            itemDistance={80} dimAmount={0.24} holdDistance={90}>
            {landscapeItems.map((item) => (
              <ScrollStackItem key={item.id}>
                <button className="film-poster" type="button" onClick={() => onOpen(item)} aria-label={`Play ${item.title}`}>
                  <img src={mediaPath(item.poster)} alt="" loading="lazy" />
                  <span className="film-poster__caption"><strong>{item.title}</strong><span>{item.duration}</span></span>
                </button>
              </ScrollStackItem>
            ))}
          </ScrollStack>
        )}
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

import { useMemo, useState } from 'react'
import { productModes, productVideoCategories } from '../data/productVideos'
import SplitFormatRail from './SplitFormatRail'
import ScrollFloat from './ScrollFloat'
import VideoModal from './VideoModal'
import VideoRail from './VideoRail'

const assetPath = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
const videoMode = productModes.find((item) => item.id === 'video') || productModes[0]

function initialVideoState() {
  const params = new URLSearchParams(window.location.search)
  const videoId = params.get('video')
  if (!videoId) return { mode: null, categoryId: productVideoCategories[0].id, modalItem: null }

  const targetCategory = productVideoCategories.find((category) => category.items.some((item) => item.id === videoId))
  const targetItem = targetCategory?.items.find((item) => item.id === videoId)

  return {
    mode: targetItem ? 'video' : null,
    categoryId: targetCategory?.id || productVideoCategories[0].id,
    modalItem: targetItem || null,
  }
}

function ProductSection() {
  const [initialState] = useState(initialVideoState)
  const [mode, setMode] = useState(initialState.mode)
  const [categoryId, setCategoryId] = useState(initialState.categoryId)
  const [modalItem, setModalItem] = useState(initialState.modalItem)
  const allVideoItems = useMemo(() => productVideoCategories.flatMap((category) => category.items), [])
  const activeCategory = useMemo(
    () => productVideoCategories.find((category) => category.id === categoryId) || productVideoCategories[0],
    [categoryId],
  )

  function handleModeSelect(nextMode) {
    setMode(nextMode)
    if (nextMode === 'video') {
      setCategoryId(productVideoCategories[0].id)
    }
  }

  function handleBackToModes() {
    setMode(null)
    setCategoryId(productVideoCategories[0].id)
  }

  function handleOpenVideo(item) {
    setModalItem(item)
    if (!item?.id) return

    const url = new URL(window.location.href)
    url.searchParams.set('video', item.id)
    window.history.replaceState({}, '', url)
  }

  function handleCloseVideo() {
    setModalItem(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('video')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  return (
    <section className="product-section motion-section" id="project" aria-label="Project">
      <div className="product-section__head motion-title">
        <ScrollFloat>PROJECT</ScrollFloat>
        <button className="product-section__badge" type="button" onClick={() => setMode('video')}>
          Selected video works
        </button>
      </div>

      {mode === 'video' ? (
        <>
          <div className="video-category-tabs video-category-tabs--active" aria-label="Video categories">
            <button className="video-category-tabs__back" type="button" onClick={handleBackToModes} aria-label="Back to project categories">
              <img src={assetPath(videoMode.icon)} alt="" />
            </button>
            {productVideoCategories.map((category) => (
              <button
                className={activeCategory.id === category.id ? 'is-active' : ''}
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
              >
                <span>{category.number}</span>
                {category.label}
              </button>
            ))}
          </div>

          {activeCategory.id === 'filming-post' ? (
            <SplitFormatRail key={activeCategory.id} category={activeCategory} onOpen={handleOpenVideo} />
          ) : (
            <VideoRail key={activeCategory.id} category={activeCategory} items={activeCategory.items} onOpen={handleOpenVideo} />
          )}
        </>
      ) : mode === '3d' || mode === 'graphic' ? (
        <>
          <div className="product-mode-tabs" aria-label="Project categories">
            <button className="product-mode-tabs__back" type="button" onClick={handleBackToModes} aria-label="Back to project categories">
              <img src={assetPath(productModes.find((item) => item.id === mode)?.icon || videoMode.icon)} alt="" />
            </button>
          </div>
          <div className="product-placeholder">
            <span>{mode === '3d' ? '3D' : 'Graphic'}</span>
            <h3>Updating. Stay tuned......</h3>
          </div>
        </>
      ) : (
        <div className="product-mode-tabs product-mode-tabs--directory" aria-label="Project categories">
          {productModes.map((item) => (
            <button key={item.id} type="button" onClick={() => handleModeSelect(item.id)}>
              <img src={assetPath(item.icon)} alt="" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      <VideoModal item={modalItem || allVideoItems.find((item) => item.id === new URLSearchParams(window.location.search).get('video'))} onClose={handleCloseVideo} />
    </section>
  )
}

export default ProductSection

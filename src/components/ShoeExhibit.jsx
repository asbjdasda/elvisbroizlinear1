import { Component } from 'react'
import ModelViewer from './ModelViewer'
import shoeUrl from '../assets/models/MaterialsVariantsShoe.glb?url'
import './FilmGallery.css'

class ViewerBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return <p><a href={shoeUrl} download>Download the 3D shoe model</a></p>
    return this.props.children
  }
}

export default function ShoeExhibit() {
  return (
    <figure className="shoe-exhibit">
      <div className="shoe-exhibit__stage" aria-label="Interactive 3D shoe model">
        <ViewerBoundary>
          <ModelViewer url={shoeUrl} width="100%" height="100%" fit={0.88}
            startAngle={-38} tilt={12} autoRotateSpeed={0.26} hoverTilt={0.08} />
        </ViewerBoundary>
      </div>
      <figcaption>
        <span>Drag to rotate · Pinch or Ctrl + scroll to zoom · Double-click to reset</span>
        <small><a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/MaterialsVariantsShoe">Materials Variants Shoe</a> © 2021 Shopify · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></small>
      </figcaption>
    </figure>
  )
}

export default function ClientMapPanel({ title, description, children }) {
  return (
    <details className="service-row client-map-card motion-card">
      <summary className="client-map-trigger">
        <span className="client-map-number">04</span>
        <h3>{title}</h3>
        <svg className="client-map-chevron" aria-hidden="true" width="20" height="20" viewBox="0 0 20 20">
          <path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </summary>
      <div className="client-map-body client-map-panel">
        <p>{description}</p>
        {children}
      </div>
    </details>
  )
}

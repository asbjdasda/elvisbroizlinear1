function Loader({ className = '', label = 'Loading' }) {
  return (
    <div className={`loader-wrap ${className}`} role="status" aria-label={label}>
      <div className="loader-grid" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index} style={{ '--loader-index': index, '--loader-row': Math.floor(index / 3), '--loader-col': index % 3 }} />
        ))}
      </div>
    </div>
  )
}

export default Loader

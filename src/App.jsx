import { useState, useEffect, useCallback, memo, useRef, useLayoutEffect } from 'react'

// Video background component
const VideoBackground = memo(function VideoBackground({ src, fallbackImage }) {
  const [videoError, setVideoError] = useState(false)

  if (videoError && fallbackImage) {
    return (
      <div
        className="video-background"
        style={{ backgroundImage: `url(${fallbackImage})` }}
      />
    )
  }

  return (
    <video
      className="video-background"
      autoPlay
      muted
      loop
      playsInline
      onError={() => setVideoError(true)}
    >
      <source src={src} type="video/mp4" />
    </video>
  )
})

// Country flag emoji helper
const getCountryFlag = (code) => {
  const flags = {
    AR: '🇦🇷',
    EG: '🇪🇬',
    FR: '🇫🇷',
    US: '🇺🇸',
    GB: '🇬🇧',
    JP: '🇯🇵',
    IT: '🇮🇹',
    DE: '🇩🇪',
    ES: '🇪🇸',
    BR: '🇧🇷',
    MX: '🇲🇽',
    CA: '🇨🇦',
    AU: '🇦🇺',
    IN: '🇮🇳',
    CN: '🇨🇳',
    TH: '🇹🇭',
    GR: '🇬🇷',
    PT: '🇵🇹',
    NL: '🇳🇱',
    CH: '🇨🇭',
  }
  return flags[code] || '🌍'
}

// Generate a unique code from album name
const generateCode = (name, existingCodes) => {
  const clean = name.trim().toUpperCase().replace(/[^A-Z]/g, '')
  let code = clean.slice(0, 2)

  // If code already exists, try variations
  if (existingCodes.includes(code)) {
    // Try first and last letter
    code = clean[0] + clean[clean.length - 1]
  }
  if (existingCodes.includes(code)) {
    // Try with numbers
    for (let i = 1; i <= 9; i++) {
      const newCode = clean[0] + i
      if (!existingCodes.includes(newCode)) {
        code = newCode
        break
      }
    }
  }

  return code || 'XX'
}

// Add Album Modal
const AddAlbumModal = memo(function AddAlbumModal({ onClose, onAdd, existingCodes }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter an album name')
      return
    }

    setAdding(true)
    setError('')

    const code = generateCode(name, existingCodes)

    try {
      const response = await fetch('/api/countries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: name.trim() }),
      })

      if (response.status === 409) {
        setError('An album with this name already exists')
        setAdding(false)
        return
      }

      if (!response.ok) throw new Error('Failed to create album')

      const country = await response.json()
      onAdd(country)
      onClose()
    } catch (err) {
      setError(err.message)
      setAdding(false)
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="add-album-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Create New Album</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Album Name</label>
            <input
              type="text"
              placeholder="e.g., Japan, Summer 2024, Road Trip"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={adding}>
              {adding ? 'Creating...' : 'Create Album'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
})

// Confirm Delete Modal
const ConfirmDeleteModal = memo(function ConfirmDeleteModal({ country, photoCount, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    setDeleting(true)
    await onConfirm()
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Delete Album?</h3>
        <p>
          <strong>{country.name}</strong> contains <strong>{photoCount} photo{photoCount > 1 ? 's' : ''}</strong>.
        </p>
        <p className="warning">This action cannot be undone. All photos will be permanently deleted.</p>
        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="delete-confirm-btn"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Album & Photos'}
          </button>
        </div>
      </div>
    </div>
  )
})

// Sidebar component
const Sidebar = memo(function Sidebar({
  isOpen,
  onClose,
  countries,
  onSelectCountry,
  activeCountry,
  onAddAlbum,
  onDeleteAlbum,
}) {
  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-icon">✈</span>
            <h2>Destinations</h2>
          </div>
          <button className="sidebar-close" onClick={onClose}>
            ×
          </button>
        </div>
        <nav className="sidebar-nav">
          {countries.map((country) => (
            <div key={country.code} className="sidebar-item">
              <button
                className={`sidebar-link ${activeCountry?.code === country.code ? 'active' : ''}`}
                onClick={() => onSelectCountry(country)}
              >
                <div className="country-info">
                  <span className="country-flag">{getCountryFlag(country.code)}</span>
                  <span className="country-name">{country.name}</span>
                </div>
              </button>
              <button
                className="delete-album-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteAlbum(country)
                }}
                title="Delete album"
              >
                ×
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="add-album-btn" onClick={onAddAlbum}>
            + Add New Album
          </button>
        </div>
      </div>
    </>
  )
})

// Photo card component
const PhotoCard = memo(function PhotoCard({ photo, onClick }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    const img = imgRef.current
    if (!img) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            img.src = `/api/photos/${photo.id}/thumbnail`
            observer.unobserve(img)
          }
        })
      },
      { rootMargin: '100px' }
    )

    observer.observe(img)
    return () => observer.disconnect()
  }, [photo.id])

  return (
    <div className="photo-card" onClick={() => onClick(photo)}>
      {!loaded && !error && <div className="photo-skeleton" />}
      <img
        ref={imgRef}
        alt={photo.original_name}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{ opacity: loaded ? 1 : 0 }}
      />
      {error && <div className="photo-error">Failed to load</div>}
    </div>
  )
})

// Photo modal component
const PhotoModal = memo(function PhotoModal({ photo, photos, onClose, onDelete, onNavigate }) {
  const [deleting, setDeleting] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const currentIndex = photos.findIndex(p => p.id === photo.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < photos.length - 1

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      setImageLoaded(false)
      onNavigate(photos[currentIndex - 1])
    }
  }, [hasPrev, photos, currentIndex, onNavigate])

  const goToNext = useCallback(() => {
    if (hasNext) {
      setImageLoaded(false)
      onNavigate(photos[currentIndex + 1])
    }
  }, [hasNext, photos, currentIndex, onNavigate])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goToPrev()
      if (e.key === 'ArrowRight') goToNext()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, goToPrev, goToNext])

  const handleDelete = async () => {
    if (!confirm('Delete this photo?')) return
    setDeleting(true)
    await onDelete(photo.id)
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="modal" onClick={onClose}>
      {hasPrev && (
        <button
          className="nav-btn nav-prev"
          onClick={(e) => { e.stopPropagation(); goToPrev(); }}
        >
          ‹
        </button>
      )}

      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {!imageLoaded && <div className="modal-loading">Loading...</div>}
        <img
          src={`/api/photos/${photo.id}/image`}
          alt={photo.original_name}
          onLoad={() => setImageLoaded(true)}
          style={{ opacity: imageLoaded ? 1 : 0 }}
        />
        <div className="modal-info">
          <div className="modal-details">
            <p className="filename">{photo.original_name}</p>
            <p className="meta">
              {new Date(photo.uploaded_at).toLocaleDateString()}
              {photo.width && photo.height && ` • ${photo.width}×${photo.height}`}
              {photo.size && ` • ${formatFileSize(photo.size)}`}
              {photos.length > 1 && ` • ${currentIndex + 1} of ${photos.length}`}
            </p>
          </div>
          <button
            className="delete-btn"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      {hasNext && (
        <button
          className="nav-btn nav-next"
          onClick={(e) => { e.stopPropagation(); goToNext(); }}
        >
          ›
        </button>
      )}
    </div>
  )
})

// Landing page component
const LandingPage = memo(function LandingPage({ onOpenSidebar }) {
  return (
    <div className="landing-page">
      <VideoBackground
        src="https://videos.pexels.com/video-files/2169880/2169880-uhd_2560_1440_30fps.mp4"
        fallbackImage="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920&q=80"
      />
      <div className="landing-overlay" />
      <div className="landing-content">
        <h1 className="landing-title">Photo Collection</h1>
        <p className="landing-subtitle">Your travel memories, beautifully organized</p>
        <button className="explore-btn" onClick={onOpenSidebar}>
          Explore Destinations
        </button>
      </div>
      <button className="menu-btn" onClick={onOpenSidebar}>
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  )
})

// Country page component
const CountryPage = memo(function CountryPage({
  country,
  photos,
  onBack,
  onPhotoClick,
  onUpload,
  uploading,
  uploadProgress,
}) {
  return (
    <div className="country-page">
      <VideoBackground
        src={country.video_url}
        fallbackImage={country.background_url}
      />
      <div className="country-overlay" />
      <div className="country-content">
        <header className="country-header">
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
          <h1 className="country-title">{country.name}</h1>
          <label className="upload-btn">
            {uploading ? `Uploading... ${uploadProgress}%` : 'Upload Photos'}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onUpload}
              disabled={uploading}
            />
          </label>
        </header>

        <main className="country-main">
          {photos.length === 0 ? (
            <div className="empty-state">
              <p>No photos from {country.name} yet.</p>
              <p>Upload some to get started!</p>
            </div>
          ) : (
            <div className="photo-grid">
              {photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onClick={onPhotoClick}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
})

function App() {
  const [countries, setCountries] = useState([])
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [photos, setPhotos] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageTransition, setPageTransition] = useState('idle') // 'idle' | 'exiting' | 'entering'
  const [displayedCountry, setDisplayedCountry] = useState(null)
  const [showAddAlbum, setShowAddAlbum] = useState(false)
  const [albumToDelete, setAlbumToDelete] = useState(null)
  const [deletePhotoCount, setDeletePhotoCount] = useState(0)

  // Fetch countries on mount
  useEffect(() => {
    fetch('/api/countries')
      .then((res) => res.json())
      .then(setCountries)
      .catch((err) => console.error('Failed to load countries:', err))
  }, [])

  // Fetch photos when country changes
  useEffect(() => {
    if (!selectedCountry) {
      setPhotos([])
      return
    }

    setLoading(true)
    fetch(`/api/photos?country=${selectedCountry.code}`)
      .then((res) => res.json())
      .then((data) => {
        setPhotos(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load photos:', err)
        setLoading(false)
      })
  }, [selectedCountry])

  const handleSelectCountry = useCallback((country) => {
    // Don't close sidebar - let user browse countries
    setPageTransition('exiting')

    setTimeout(() => {
      setSelectedCountry(country)
      setDisplayedCountry(country)
      setPageTransition('entering')

      setTimeout(() => {
        setPageTransition('idle')
      }, 500)
    }, 400)
  }, [])

  const handleBack = useCallback(() => {
    setPageTransition('exiting')

    setTimeout(() => {
      setSelectedCountry(null)
      setDisplayedCountry(null)
      setPhotos([])
      setPageTransition('entering')

      setTimeout(() => {
        setPageTransition('idle')
      }, 500)
    }, 400)
  }, [])

  const handleUpload = async (event) => {
    const files = event.target.files
    if (!files.length || !selectedCountry) return

    setUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      formData.append('photos', files[i])
    }
    formData.append('country', selectedCountry.code)

    try {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
      })

      await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error('Upload failed'))
          }
        }
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.open('POST', '/api/photos')
        xhr.send(formData)
      })

      // Refresh photos
      const res = await fetch(`/api/photos?country=${selectedCountry.code}`)
      const data = await res.json()
      setPhotos(data)
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      setUploadProgress(0)
      event.target.value = ''
    }
  }

  const handleDelete = useCallback(async (id) => {
    try {
      const response = await fetch(`/api/photos/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      setPhotos((prev) => prev.filter((p) => p.id !== id))
      setSelectedPhoto(null)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }, [])

  const handlePhotoClick = useCallback((photo) => {
    setSelectedPhoto(photo)
  }, [])

  const handleCloseModal = useCallback(() => {
    setSelectedPhoto(null)
  }, [])

  const handleAddAlbum = useCallback((newCountry) => {
    setCountries((prev) => [...prev, newCountry].sort((a, b) => a.name.localeCompare(b.name)))
  }, [])

  const handleDeleteAlbum = useCallback(async (country) => {
    try {
      // First check if album has photos
      const response = await fetch(`/api/countries/${country.code}?deletePhotos=false`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.requiresConfirmation) {
        // Album has photos, show confirmation
        setAlbumToDelete(country)
        setDeletePhotoCount(data.photoCount)
      } else {
        // Album was empty and deleted
        setCountries((prev) => prev.filter((c) => c.code !== country.code))
        if (displayedCountry?.code === country.code) {
          handleBack()
        }
      }
    } catch (err) {
      console.error('Failed to delete album:', err)
    }
  }, [displayedCountry, handleBack])

  const handleConfirmDelete = useCallback(async () => {
    if (!albumToDelete) return

    try {
      const response = await fetch(`/api/countries/${albumToDelete.code}?deletePhotos=true`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setCountries((prev) => prev.filter((c) => c.code !== albumToDelete.code))
        if (displayedCountry?.code === albumToDelete.code) {
          handleBack()
        }
        setAlbumToDelete(null)
        setDeletePhotoCount(0)
      }
    } catch (err) {
      console.error('Failed to delete album:', err)
    }
  }, [albumToDelete, displayedCountry, handleBack])

  const transitionClass = pageTransition === 'exiting' ? 'page-exit' :
                          pageTransition === 'entering' ? 'page-enter' : ''

  return (
    <div className="app">
      <div className={`page-wrapper ${transitionClass}`}>
        {displayedCountry ? (
          <CountryPage
            country={displayedCountry}
            photos={photos}
            onBack={handleBack}
            onPhotoClick={handlePhotoClick}
            onUpload={handleUpload}
            uploading={uploading}
            uploadProgress={uploadProgress}
          />
        ) : (
          <LandingPage onOpenSidebar={() => setSidebarOpen(true)} />
        )}
      </div>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        countries={countries}
        onSelectCountry={handleSelectCountry}
        activeCountry={displayedCountry}
        onAddAlbum={() => setShowAddAlbum(true)}
        onDeleteAlbum={handleDeleteAlbum}
      />

      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          photos={photos}
          onClose={handleCloseModal}
          onDelete={handleDelete}
          onNavigate={setSelectedPhoto}
        />
      )}

      {showAddAlbum && (
        <AddAlbumModal
          onClose={() => setShowAddAlbum(false)}
          onAdd={handleAddAlbum}
          existingCodes={countries.map((c) => c.code)}
        />
      )}

      {albumToDelete && (
        <ConfirmDeleteModal
          country={albumToDelete}
          photoCount={deletePhotoCount}
          onClose={() => {
            setAlbumToDelete(null)
            setDeletePhotoCount(0)
          }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}

export default App

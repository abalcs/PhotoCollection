import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.join(__dirname, '..')
const uploadsDir = path.join(rootDir, 'uploads')
const thumbnailsDir = path.join(rootDir, 'thumbnails')

// Ensure directories exist
for (const dir of [uploadsDir, thumbnailsDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Initialize SQLite database with optimizations
const db = new Database(path.join(rootDir, 'photos.db'))
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    country TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// Migrations - add columns if they don't exist
const migrations = [
  'ALTER TABLE photos ADD COLUMN country TEXT',
  'ALTER TABLE photos ADD COLUMN width INTEGER',
  'ALTER TABLE photos ADD COLUMN height INTEGER',
]

for (const sql of migrations) {
  try {
    db.exec(sql)
  } catch (e) {
    // Column already exists, ignore
  }
}

// Create countries table with video support
db.exec(`
  CREATE TABLE IF NOT EXISTS countries (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    video_url TEXT,
    background_url TEXT
  )
`)

// Add video_url column if it doesn't exist
try {
  db.exec(`ALTER TABLE countries ADD COLUMN video_url TEXT`)
} catch (e) {
  // Column already exists
}

// Seed countries with video backgrounds (using Pexels CDN for reliable video hosting)
const countries = [
  {
    code: 'EG',
    name: 'Egypt',
    video_url: 'https://videos.pexels.com/video-files/3125396/3125396-uhd_2560_1440_30fps.mp4',
    background_url: 'https://images.unsplash.com/photo-1539768942893-daf53e448371?w=1920&q=80'
  },
  {
    code: 'FR',
    name: 'France',
    video_url: 'https://videos.pexels.com/video-files/2519660/2519660-uhd_2560_1440_24fps.mp4',
    background_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&q=80'
  },
  {
    code: 'AR',
    name: 'Argentina',
    video_url: 'https://videos.pexels.com/video-files/4763824/4763824-uhd_2560_1440_24fps.mp4',
    background_url: 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1920&q=80'
  },
]

// Clear and reseed countries
db.exec(`DELETE FROM countries`)

const insertCountry = db.prepare(`
  INSERT OR REPLACE INTO countries (code, name, video_url, background_url) VALUES (?, ?, ?, ?)
`)

for (const country of countries) {
  insertCountry.run(country.code, country.name, country.video_url, country.background_url)
}

// Add index for faster sorting and filtering
db.exec(`CREATE INDEX IF NOT EXISTS idx_photos_uploaded_at ON photos(uploaded_at DESC)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_photos_country ON photos(country)`)

// Prepared statements for better performance
const stmts = {
  getAll: db.prepare('SELECT * FROM photos ORDER BY uploaded_at DESC'),
  getByCountry: db.prepare('SELECT * FROM photos WHERE country = ? ORDER BY uploaded_at DESC'),
  getById: db.prepare('SELECT * FROM photos WHERE id = ?'),
  countByCountry: db.prepare('SELECT COUNT(*) as count FROM photos WHERE country = ?'),
  insert: db.prepare(`
    INSERT INTO photos (id, filename, original_name, mimetype, size, width, height, country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateCountry: db.prepare('UPDATE photos SET country = ? WHERE id = ?'),
  delete: db.prepare('DELETE FROM photos WHERE id = ?'),
  deleteByCountry: db.prepare('DELETE FROM photos WHERE country = ?'),
  getAllCountries: db.prepare('SELECT * FROM countries ORDER BY name'),
  getCountry: db.prepare('SELECT * FROM countries WHERE code = ?'),
  insertCountry: db.prepare('INSERT INTO countries (code, name, video_url, background_url) VALUES (?, ?, ?, ?)'),
  deleteCountry: db.prepare('DELETE FROM countries WHERE code = ?'),
}

const app = express()
app.use(cors())
app.use(express.json())

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const id = uuidv4()
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${id}${ext}`)
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only images are allowed'))
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }
})

// Generate thumbnail
async function generateThumbnail(inputPath, outputPath) {
  await sharp(inputPath)
    .resize(400, 400, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 80, progressive: true })
    .toFile(outputPath)
}

// Get image metadata
async function getImageMetadata(filePath) {
  try {
    const metadata = await sharp(filePath).metadata()
    return { width: metadata.width, height: metadata.height }
  } catch {
    return { width: null, height: null }
  }
}

// Get all countries
app.get('/api/countries', (req, res) => {
  const countries = stmts.getAllCountries.all()
  res.json(countries)
})

// Get single country
app.get('/api/countries/:code', (req, res) => {
  const country = stmts.getCountry.get(req.params.code)
  if (!country) {
    return res.status(404).json({ error: 'Country not found' })
  }
  // Include photo count
  const { count } = stmts.countByCountry.get(req.params.code)
  res.json({ ...country, photoCount: count })
})

// Video/background mappings for destinations
const destinationMedia = {
  // Countries
  japan: { video: 'https://videos.pexels.com/video-files/5548026/5548026-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1920&q=80' },
  tokyo: { video: 'https://videos.pexels.com/video-files/5548026/5548026-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920&q=80' },
  italy: { video: 'https://videos.pexels.com/video-files/4318479/4318479-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=1920&q=80' },
  rome: { video: 'https://videos.pexels.com/video-files/4318479/4318479-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1920&q=80' },
  greece: { video: 'https://videos.pexels.com/video-files/4162493/4162493-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1920&q=80' },
  spain: { video: 'https://videos.pexels.com/video-files/4476206/4476206-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=1920&q=80' },
  thailand: { video: 'https://videos.pexels.com/video-files/4761889/4761889-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=1920&q=80' },
  bali: { video: 'https://videos.pexels.com/video-files/5377252/5377252-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&q=80' },
  indonesia: { video: 'https://videos.pexels.com/video-files/5377252/5377252-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&q=80' },
  mexico: { video: 'https://videos.pexels.com/video-files/4174689/4174689-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=1920&q=80' },
  brazil: { video: 'https://videos.pexels.com/video-files/4476082/4476082-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1920&q=80' },
  usa: { video: 'https://videos.pexels.com/video-files/3121459/3121459-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?w=1920&q=80' },
  america: { video: 'https://videos.pexels.com/video-files/3121459/3121459-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?w=1920&q=80' },
  'new york': { video: 'https://videos.pexels.com/video-files/3121459/3121459-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1920&q=80' },
  london: { video: 'https://videos.pexels.com/video-files/5765723/5765723-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=80' },
  england: { video: 'https://videos.pexels.com/video-files/5765723/5765723-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=80' },
  uk: { video: 'https://videos.pexels.com/video-files/5765723/5765723-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=80' },
  paris: { video: 'https://videos.pexels.com/video-files/2519660/2519660-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&q=80' },
  dubai: { video: 'https://videos.pexels.com/video-files/4328587/4328587-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1920&q=80' },
  australia: { video: 'https://videos.pexels.com/video-files/2556297/2556297-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=1920&q=80' },
  sydney: { video: 'https://videos.pexels.com/video-files/2556297/2556297-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1920&q=80' },
  india: { video: 'https://videos.pexels.com/video-files/4174690/4174690-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1920&q=80' },
  china: { video: 'https://videos.pexels.com/video-files/3999055/3999055-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1920&q=80' },
  germany: { video: 'https://videos.pexels.com/video-files/4328555/4328555-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1920&q=80' },
  switzerland: { video: 'https://videos.pexels.com/video-files/4763824/4763824-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=1920&q=80' },
  canada: { video: 'https://videos.pexels.com/video-files/3994031/3994031-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=1920&q=80' },
  hawaii: { video: 'https://videos.pexels.com/video-files/3571264/3571264-uhd_2560_1440_30fps.mp4', image: 'https://images.unsplash.com/photo-1507876466758-bc54f384809c?w=1920&q=80' },
  maldives: { video: 'https://videos.pexels.com/video-files/4065906/4065906-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1920&q=80' },
  caribbean: { video: 'https://videos.pexels.com/video-files/4065906/4065906-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1548574505-5e239809ee19?w=1920&q=80' },
  morocco: { video: 'https://videos.pexels.com/video-files/4434242/4434242-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=1920&q=80' },
  iceland: { video: 'https://videos.pexels.com/video-files/3994030/3994030-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=1920&q=80' },
  norway: { video: 'https://videos.pexels.com/video-files/3994030/3994030-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80' },
  portugal: { video: 'https://videos.pexels.com/video-files/4476206/4476206-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1920&q=80' },
  // Generic themes
  beach: { video: 'https://videos.pexels.com/video-files/857116/857116-hd_1920_1080_25fps.mp4', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80' },
  mountain: { video: 'https://videos.pexels.com/video-files/4763824/4763824-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80' },
  city: { video: 'https://videos.pexels.com/video-files/3121459/3121459-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&q=80' },
  nature: { video: 'https://videos.pexels.com/video-files/3571264/3571264-uhd_2560_1440_30fps.mp4', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80' },
  summer: { video: 'https://videos.pexels.com/video-files/857116/857116-hd_1920_1080_25fps.mp4', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80' },
  winter: { video: 'https://videos.pexels.com/video-files/3994030/3994030-uhd_2560_1440_24fps.mp4', image: 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1920&q=80' },
  safari: { video: 'https://videos.pexels.com/video-files/5618253/5618253-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1920&q=80' },
  africa: { video: 'https://videos.pexels.com/video-files/5618253/5618253-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1920&q=80' },
  road: { video: 'https://videos.pexels.com/video-files/3999055/3999055-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80' },
  trip: { video: 'https://videos.pexels.com/video-files/2169880/2169880-uhd_2560_1440_30fps.mp4', image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80' },
}

// Default travel videos for unmatched destinations
const defaultVideos = [
  { video: 'https://videos.pexels.com/video-files/2169880/2169880-uhd_2560_1440_30fps.mp4', image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80' },
  { video: 'https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4', image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80' },
  { video: 'https://videos.pexels.com/video-files/4328587/4328587-uhd_2560_1440_25fps.mp4', image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80' },
]

// Find matching video for album name
function findMediaForDestination(name) {
  const lowerName = name.toLowerCase()

  // Check for direct match or partial match
  for (const [key, media] of Object.entries(destinationMedia)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return media
    }
  }

  // Return random default
  return defaultVideos[Math.floor(Math.random() * defaultVideos.length)]
}

// Create a new country/album
app.post('/api/countries', (req, res) => {
  const { code, name } = req.body

  if (!code || !name) {
    return res.status(400).json({ error: 'Code and name are required' })
  }

  // Check if already exists
  const existing = stmts.getCountry.get(code.toUpperCase())
  if (existing) {
    return res.status(409).json({ error: 'Album already exists' })
  }

  // Find appropriate video/background for this destination
  const media = findMediaForDestination(name)
  const video_url = media.video
  const background_url = media.image

  try {
    stmts.insertCountry.run(code.toUpperCase(), name, video_url, background_url)
    const country = stmts.getCountry.get(code.toUpperCase())
    res.status(201).json(country)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create album' })
  }
})

// Delete a country/album
app.delete('/api/countries/:code', (req, res) => {
  const country = stmts.getCountry.get(req.params.code)

  if (!country) {
    return res.status(404).json({ error: 'Country not found' })
  }

  // Get photo count
  const { count } = stmts.countByCountry.get(req.params.code)

  // If deletePhotos flag is set, delete all photos first
  if (req.query.deletePhotos === 'true' && count > 0) {
    // Get all photos to delete their files
    const photos = stmts.getByCountry.all(req.params.code)
    for (const photo of photos) {
      const filePath = path.join(uploadsDir, photo.filename)
      const thumbnailPath = path.join(thumbnailsDir, `${photo.id}.jpg`)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath)
    }
    stmts.deleteByCountry.run(req.params.code)
  } else if (count > 0) {
    // Return the count so frontend can confirm
    return res.status(200).json({
      requiresConfirmation: true,
      photoCount: count,
      message: `This album contains ${count} photo${count > 1 ? 's' : ''}. Are you sure you want to delete it?`
    })
  }

  // Delete the country
  stmts.deleteCountry.run(req.params.code)
  res.json({ success: true })
})

// Get all photos (optionally filter by country)
app.get('/api/photos', (req, res) => {
  const { country } = req.query
  const photos = country
    ? stmts.getByCountry.all(country)
    : stmts.getAll.all()
  res.json(photos)
})

// Upload photos
app.post('/api/photos', upload.array('photos', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' })
  }

  const country = req.body.country || null
  const photos = []

  for (const file of req.files) {
    const id = path.basename(file.filename, path.extname(file.filename))
    const filePath = path.join(uploadsDir, file.filename)
    const thumbnailPath = path.join(thumbnailsDir, `${id}.jpg`)

    try {
      const [metadata] = await Promise.all([
        getImageMetadata(filePath),
        generateThumbnail(filePath, thumbnailPath)
      ])

      stmts.insert.run(
        id,
        file.filename,
        file.originalname,
        file.mimetype,
        file.size,
        metadata.width,
        metadata.height,
        country
      )

      photos.push({
        id,
        filename: file.filename,
        original_name: file.originalname,
        width: metadata.width,
        height: metadata.height,
        country
      })
    } catch (error) {
      console.error(`Error processing ${file.originalname}:`, error.message)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath)
    }
  }

  if (photos.length === 0) {
    return res.status(500).json({ error: 'Failed to process any images' })
  }

  res.json(photos)
})

// Update photo country
app.patch('/api/photos/:id', (req, res) => {
  const { country } = req.body
  const photo = stmts.getById.get(req.params.id)

  if (!photo) {
    return res.status(404).json({ error: 'Photo not found' })
  }

  stmts.updateCountry.run(country || null, req.params.id)
  res.json({ ...photo, country: country || null })
})

// Get thumbnail
app.get('/api/photos/:id/thumbnail', (req, res) => {
  const photo = stmts.getById.get(req.params.id)

  if (!photo) {
    return res.status(404).json({ error: 'Photo not found' })
  }

  const thumbnailPath = path.join(thumbnailsDir, `${photo.id}.jpg`)

  if (!fs.existsSync(thumbnailPath)) {
    const filePath = path.join(uploadsDir, photo.filename)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    return res.sendFile(filePath)
  }

  res.set('Cache-Control', 'public, max-age=31536000, immutable')
  res.sendFile(thumbnailPath)
})

// Get full resolution photo
app.get('/api/photos/:id/image', (req, res) => {
  const photo = stmts.getById.get(req.params.id)

  if (!photo) {
    return res.status(404).json({ error: 'Photo not found' })
  }

  const filePath = path.join(uploadsDir, photo.filename)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' })
  }

  res.set('Cache-Control', 'public, max-age=31536000, immutable')
  res.sendFile(filePath)
})

// Delete photo
app.delete('/api/photos/:id', (req, res) => {
  const photo = stmts.getById.get(req.params.id)

  if (!photo) {
    return res.status(404).json({ error: 'Photo not found' })
  }

  const filePath = path.join(uploadsDir, photo.filename)
  const thumbnailPath = path.join(thumbnailsDir, `${photo.id}.jpg`)

  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath)

  stmts.delete.run(req.params.id)

  res.json({ success: true })
})

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(rootDir, 'dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'))
    }
  })
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  if (process.env.NODE_ENV === 'production') {
    console.log('Serving production build')
  }
})

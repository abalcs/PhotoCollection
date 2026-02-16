# Photo Collection

A travel photo collection app with stunning video backgrounds, album management, and smooth transitions.

## Features

- **Video Backgrounds** - Each destination has a unique video background that plays behind your photos
- **Album Management** - Create and delete albums with automatic video matching for 30+ destinations
- **Photo Upload** - Upload multiple photos at once with progress indicator
- **Thumbnail Generation** - Automatic thumbnail creation for fast grid loading
- **Photo Viewer** - Full-screen modal with left/right navigation and keyboard support
- **Sliding Sidebar** - Smooth animated sidebar for browsing destinations
- **Page Transitions** - Elegant fade and scale animations between pages
- **Lazy Loading** - Images load on-demand with Intersection Observer
- **Responsive Design** - Works on desktop and mobile devices

## Tech Stack

- **Frontend:** React 18, Vite
- **Backend:** Express, Node.js
- **Database:** SQLite (better-sqlite3)
- **Image Processing:** Sharp

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/abalcs/PhotoCollection.git
cd PhotoCollection

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at http://localhost:5173

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start
```

The production server runs at http://localhost:3001

## Usage

1. **Landing Page** - Click "Explore Destinations" or the menu icon to open the sidebar
2. **Create Album** - Click "+ Add New Album" and enter a destination name (e.g., "Japan", "Beach Trip")
3. **Upload Photos** - Select an album and click "Upload Photos" to add images
4. **View Photos** - Click any photo to open the viewer, use arrow keys or buttons to navigate
5. **Delete Album** - Hover over an album in the sidebar and click the × button

## Supported Destinations

Albums automatically get matching video backgrounds for:

**Countries:** Japan, Italy, Greece, Spain, Thailand, Indonesia, Mexico, Brazil, USA, UK, France, Dubai, Australia, India, China, Germany, Switzerland, Canada, Morocco, Iceland, Norway, Portugal, and more

**Cities:** Tokyo, Rome, New York, London, Paris, Sydney, Bali

**Themes:** Beach, Mountain, City, Nature, Summer, Winter, Safari, Road Trip

## Project Structure

```
PhotoCollection/
├── src/
│   ├── App.jsx        # Main React application
│   ├── index.css      # Styles and animations
│   └── main.jsx       # React entry point
├── server/
│   └── index.js       # Express API server
├── uploads/           # Uploaded photos (gitignored)
├── thumbnails/        # Generated thumbnails (gitignored)
└── photos.db          # SQLite database (gitignored)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/countries | List all albums |
| POST | /api/countries | Create new album |
| DELETE | /api/countries/:code | Delete album |
| GET | /api/photos | List photos (optional ?country= filter) |
| POST | /api/photos | Upload photos |
| DELETE | /api/photos/:id | Delete photo |
| GET | /api/photos/:id/image | Get full resolution image |
| GET | /api/photos/:id/thumbnail | Get thumbnail |

## License

MIT

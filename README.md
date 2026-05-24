# EventLens 📷

> AI-powered event photography platform. Guests scan their face at the event, instantly see only their own photos.

---

## Project Structure

```
EventLens/
├── backend/          ← Node.js + Express + MongoDB
└── frontend/         ← Vite + React + Tailwind CSS
```

---

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env        # Fill in MONGO_URI, JWT_SECRET, ADMIN_SECRET
npm install
npm run dev                  # → http://localhost:5000
```

Test: `GET http://localhost:5000/health` → `{ "status": "ok" }`

### 2. Frontend

```bash
cd frontend
cp .env.example .env         # Fill in Cloudinary credentials
npm install
npm run dev                  # → http://localhost:5173
```

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string for JWT signing |
| `JWT_EXPIRES_IN` | Token lifetime (default: `7d`) |
| `ADMIN_SECRET` | Secret password for the admin portal |
| `PORT` | Server port (default: `5000`) |
| `ALLOWED_ORIGINS` | Comma-separated frontend URLs |

### Frontend (`frontend/.env`)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL in production (blank = Vite proxy in dev) |
| `VITE_FACE_API_MODEL_URL` | face-api.js model URL (blank = jsDelivr CDN) |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Unsigned Cloudinary upload preset |

---

## User Flows

### Admin (Photographer)
1. Visit `/admin/login` → enter `ADMIN_SECRET`
2. Create an event → get a guest URL → generate QR code
3. Upload photos via Cloudinary widget
4. Click "Extract Faces & Save" — face-api.js runs in your browser
5. Photos + descriptors saved to MongoDB

### Guest
1. Scan QR code → `/event/:eventId`
2. Enter the event password
3. Allow camera access
4. Tap "Scan My Face" — face matching runs on device
5. Instantly see only your photos, download any of them

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Uptime check |
| `POST` | `/api/admin/login` | `ADMIN_SECRET` | Get admin JWT |
| `POST` | `/api/admin/events` | Admin JWT | Create event |
| `GET` | `/api/admin/events` | Admin JWT | List events |
| `DELETE` | `/api/admin/events/:id` | Admin JWT | Delete event + photos |
| `POST` | `/api/admin/upload-metadata` | Admin JWT | Save photo descriptors |
| `GET` | `/api/guest/event-info/:id` | None | Public event name |
| `POST` | `/api/guest/login` | None | Guest login → JWT |
| `GET` | `/api/guest/event-vectors/:id` | Guest JWT | Full descriptor matrix |

---

## Tech Stack

- **Backend**: Node.js, Express, Mongoose, bcryptjs, jsonwebtoken
- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion, React Router v6
- **AI**: [@vladmandic/face-api](https://github.com/vladmandic/face-api) (client-side only)
- **Storage**: Cloudinary (direct browser upload — zero binary on server)
- **Database**: MongoDB Atlas
- **Hosting**: Render / Railway (backend) + Vercel (frontend)

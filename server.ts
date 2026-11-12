import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SEED_ROUTES } from './src/data/seedRoutes.ts';
import { GaliRoute } from './src/types/route.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Persistent routes file setup
const DATA_DIR = path.join(__dirname, 'data');
const ROUTES_FILE = path.join(DATA_DIR, 'routes.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadRoutes(): GaliRoute[] {
  try {
    if (fs.existsSync(ROUTES_FILE)) {
      const data = fs.readFileSync(ROUTES_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading routes file:', err);
  }
  // Initialize with seed routes if not exists
  saveRoutes(SEED_ROUTES);
  return [...SEED_ROUTES];
}

function saveRoutes(routes: GaliRoute[]) {
  try {
    fs.writeFileSync(ROUTES_FILE, JSON.stringify(routes, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving routes file:', err);
  }
}

// In-memory cache synced with disk
let routesDatabase: GaliRoute[] = loadRoutes();

// Simulated active OTPs: phone -> { code, expiresAt }
const activeOTPs = new Map<string, { code: string; expiresAt: number }>();

// ----------------- API ROUTES ----------------- //

// 0. Configuration
app.get('/api/config', (_req, res) => {
  const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
  return res.json({ googleMapsApiKey: mapsKey });
});

// 1. Send OTP for Indian phone numbers
app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }

  // Clean phone number
  const cleaned = phone.replace(/[^0-9+]/g, '');
  const code = '123456'; // Default deterministic code for effortless testing
  const expiresAt = Date.now() + 10 * 60 * 1000;

  activeOTPs.set(cleaned, { code, expiresAt });

  return res.json({
    success: true,
    message: `OTP sent successfully to ${cleaned}`,
    testOtp: code,
    expiresInSeconds: 600
  });
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, otp, name } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone number and OTP are required' });
  }

  const cleaned = phone.replace(/[^0-9+]/g, '');
  const record = activeOTPs.get(cleaned);

  // Accept valid sent OTP or universal test OTP '123456'
  const isValid = otp === '123456' || (record && record.code === otp && Date.now() < record.expiresAt);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid or expired OTP. Use 123456 for testing.' });
  }

  activeOTPs.delete(cleaned);

  const user = {
    id: `host_${cleaned.replace(/\+/g, '')}`,
    phone: cleaned,
    name: name || `Host ${cleaned.slice(-4)}`,
    token: `token_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString()
  };

  return res.json({ success: true, user });
});

// 3. Get All Routes
app.get('/api/routes', (_req, res) => {
  // Return recent first
  const sorted = [...routesDatabase].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return res.json(sorted);
});

// 4. Get Route by ID or Slug
app.get('/api/routes/:id', (req, res) => {
  const { id } = req.params;
  const route = routesDatabase.find(r => r.id === id || r.slug === id);
  if (!route) {
    return res.status(404).json({ error: 'Route not found' });
  }
  return res.json(route);
});

// 5. Create or Update Route
app.post('/api/routes', (req, res) => {
  const body = req.body as Partial<GaliRoute>;

  if (!body.title || !body.path || !Array.isArray(body.path) || body.path.length < 2) {
    return res.status(400).json({
      error: 'Route must have a title and a path with at least 2 coordinate points'
    });
  }

  const id = body.id || `route_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + id.slice(-4);

  const existingIndex = routesDatabase.findIndex(r => r.id === id || (body.id && r.id === body.id));

  const newRoute: GaliRoute = {
    id,
    slug,
    title: body.title,
    category: body.category || 'home',
    hostName: body.hostName || 'Community Host',
    hostPhone: body.hostPhone || '+91 98000 00000',
    startLandmark: body.startLandmark || {
      name: 'Main Road Landmark',
      description: 'Starting landmark point',
      lat: body.path[0][0],
      lng: body.path[0][1],
      landmarkType: 'junction'
    },
    destination: body.destination || {
      name: 'Destination Door / Gate',
      flatFloor: 'Ground Floor',
      notes: '',
      lat: body.path[body.path.length - 1][0],
      lng: body.path[body.path.length - 1][1],
      parkingAvailable: true
    },
    path: body.path,
    markers: body.markers || [],
    distanceMeters: body.distanceMeters || 350,
    estimatedWalkMinutes: body.estimatedWalkMinutes || Math.max(1, Math.round((body.distanceMeters || 350) / 75)),
    visitsCount: body.visitsCount || 0,
    createdAt: body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublic: body.isPublic !== undefined ? body.isPublic : true,
    notesHindi: body.notesHindi || ''
  };

  if (existingIndex >= 0) {
    routesDatabase[existingIndex] = newRoute;
  } else {
    routesDatabase.unshift(newRoute);
  }

  saveRoutes(routesDatabase);
  return res.status(201).json(newRoute);
});

// 6. Increment route visit count for host analytics
app.post('/api/routes/:id/visit', (req, res) => {
  const { id } = req.params;
  const route = routesDatabase.find(r => r.id === id || r.slug === id);
  if (route) {
    route.visitsCount = (route.visitsCount || 0) + 1;
    saveRoutes(routesDatabase);
    return res.json({ success: true, visitsCount: route.visitsCount });
  }
  return res.status(404).json({ error: 'Route not found' });
});

// 7. Delete Route
app.delete('/api/routes/:id', (req, res) => {
  const { id } = req.params;
  const initialLen = routesDatabase.length;
  routesDatabase = routesDatabase.filter(r => r.id !== id && r.slug !== id);
  if (routesDatabase.length < initialLen) {
    saveRoutes(routesDatabase);
    return res.json({ success: true, message: 'Route deleted' });
  }
  return res.status(404).json({ error: 'Route not found' });
});

// 8. Upload landmark photo (base64 image storage)
app.post('/api/upload', (req, res) => {
  const { imageBase64, filename } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  try {
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const safeName = `landmark_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
    const filePath = path.join(uploadsDir, safeName);

    fs.writeFileSync(filePath, buffer);
    const publicUrl = `/uploads/${safeName}`;

    return res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Failed to process image' });
  }
});

// ----------------- VITE DEV / PRODUCTION STATIC ----------------- //

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gali Guide server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

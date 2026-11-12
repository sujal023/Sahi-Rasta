import { GaliRoute, HostUser } from '../types/route';
import { SEED_ROUTES } from '../data/seedRoutes';

const STORAGE_ROUTES_KEY = 'gali_guide_routes_v1';
const STORAGE_USER_KEY = 'gali_guide_user_v1';

function getLocalRoutes(): GaliRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_ROUTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed reading localStorage routes:', e);
  }
  return SEED_ROUTES;
}

function saveLocalRoutes(routes: GaliRoute[]) {
  try {
    localStorage.setItem(STORAGE_ROUTES_KEY, JSON.stringify(routes));
  } catch (e) {
    console.error('Failed saving routes to localStorage:', e);
  }
}

export async function fetchGoogleMapsApiKey(): Promise<string> {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) {
    return import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  }
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.googleMapsApiKey) return data.googleMapsApiKey;
    }
  } catch (e) {
    console.warn('Could not fetch server config for Google Maps API key:', e);
  }
  return '';
}

export async function fetchAllRoutes(): Promise<GaliRoute[]> {
  try {
    const res = await fetch('/api/routes');
    if (res.ok) {
      const data: GaliRoute[] = await res.json();
      saveLocalRoutes(data);
      return data;
    }
  } catch (e) {
    console.warn('Network request failed, falling back to local storage cache:', e);
  }
  return getLocalRoutes();
}

export async function fetchRouteById(idOrSlug: string): Promise<GaliRoute | null> {
  try {
    const res = await fetch(`/api/routes/${encodeURIComponent(idOrSlug)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Network fetch error for route, checking cache:', e);
  }
  const local = getLocalRoutes();
  return local.find(r => r.id === idOrSlug || r.slug === idOrSlug) || null;
}

export async function saveRouteApi(route: Partial<GaliRoute>): Promise<GaliRoute> {
  try {
    const res = await fetch('/api/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });
    if (res.ok) {
      const saved: GaliRoute = await res.json();
      const existing = getLocalRoutes();
      const idx = existing.findIndex(r => r.id === saved.id);
      if (idx >= 0) existing[idx] = saved;
      else existing.unshift(saved);
      saveLocalRoutes(existing);
      return saved;
    }
  } catch (e) {
    console.warn('API route save failed, saving offline locally:', e);
  }

  // Offline fallback creation
  const id = route.id || `local_${Date.now()}`;
  const slug = route.slug || (route.title || 'route').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + id.slice(-4);
  const fallbackRoute: GaliRoute = {
    id,
    slug,
    title: route.title || 'My Gali Route',
    category: route.category || 'home',
    hostName: route.hostName || 'Host',
    hostPhone: route.hostPhone || '+91 98000 00000',
    startLandmark: route.startLandmark || {
      name: 'Start Landmark',
      description: 'Starting location',
      lat: route.path?.[0]?.[0] || 28.6139,
      lng: route.path?.[0]?.[1] || 77.2090,
    },
    destination: route.destination || {
      name: 'Destination Door',
      flatFloor: '1st Floor',
      notes: '',
      lat: route.path?.[route.path.length - 1]?.[0] || 28.6149,
      lng: route.path?.[route.path.length - 1]?.[1] || 77.2100,
      parkingAvailable: true
    },
    path: route.path || [],
    markers: route.markers || [],
    distanceMeters: route.distanceMeters || 300,
    estimatedWalkMinutes: route.estimatedWalkMinutes || 4,
    visitsCount: route.visitsCount || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublic: true,
    notesHindi: route.notesHindi || ''
  };

  const existing = getLocalRoutes();
  const idx = existing.findIndex(r => r.id === fallbackRoute.id);
  if (idx >= 0) existing[idx] = fallbackRoute;
  else existing.unshift(fallbackRoute);
  saveLocalRoutes(existing);
  return fallbackRoute;
}

export async function recordRouteVisit(routeId: string): Promise<void> {
  try {
    await fetch(`/api/routes/${encodeURIComponent(routeId)}/visit`, { method: 'POST' });
  } catch {
    // quiet ignore
  }
}

export async function deleteRouteApi(routeId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/routes/${encodeURIComponent(routeId)}`, { method: 'DELETE' });
    if (res.ok) {
      const existing = getLocalRoutes().filter(r => r.id !== routeId);
      saveLocalRoutes(existing);
      return true;
    }
  } catch (e) {
    console.error('Failed to delete route:', e);
  }
  const existing = getLocalRoutes().filter(r => r.id !== routeId);
  saveLocalRoutes(existing);
  return true;
}

export async function sendOtpApi(phone: string): Promise<{ success: boolean; testOtp?: string; message: string }> {
  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return await res.json();
  } catch {
    return { success: true, testOtp: '123456', message: 'Demo OTP: 123456' };
  }
}

export async function verifyOtpApi(phone: string, otp: string, name?: string): Promise<{ success: boolean; user?: HostUser; error?: string }> {
  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, name }),
    });
    const data = await res.json();
    if (data.success && data.user) {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
    }
    return data;
  } catch {
    if (otp === '123456' || otp.length === 6) {
      const mockUser: HostUser = {
        id: `host_${phone.replace(/\D/g, '')}`,
        phone,
        name: name || `Host ${phone.slice(-4)}`,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(mockUser));
      return { success: true, user: mockUser };
    }
    return { success: false, error: 'Invalid verification code. Enter 123456 for instant testing.' };
  }
}

export function getCurrentUser(): HostUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function logoutUser(): void {
  localStorage.removeItem(STORAGE_USER_KEY);
}

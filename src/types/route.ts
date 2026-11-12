export type MarkerType = 'turn' | 'photo_landmark' | 'warning' | 'parking' | 'destination' | 'start';

export interface LandmarkMarker {
  id: string;
  lat: number;
  lng: number;
  type: MarkerType;
  title: string;
  description: string;
  photoUrl?: string;
  badge?: string; // e.g. "Take Left", "Narrow Road", "Blue Gate"
  orderIndex: number;
}

export interface LandmarkStartPoint {
  name: string;
  description: string;
  lat: number;
  lng: number;
  landmarkType?: string; // 'metro' | 'temple' | 'petrol_pump' | 'junction' | 'other'
}

export interface DestinationPoint {
  name: string;
  flatFloor: string;
  notes: string;
  lat: number;
  lng: number;
  parkingAvailable: boolean;
  parkingInstructions?: string;
}

export interface GaliRoute {
  id: string;
  slug: string;
  title: string;
  category: 'home' | 'delivery' | 'clinic' | 'event' | 'farmhouse' | 'shop';
  hostName: string;
  hostPhone: string;
  startLandmark: LandmarkStartPoint;
  destination: DestinationPoint;
  path: [number, number][]; // Array of [lat, lng] coordinates
  markers: LandmarkMarker[];
  distanceMeters: number;
  estimatedWalkMinutes: number;
  visitsCount: number;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  notesHindi?: string;
}

export interface HostUser {
  id: string;
  phone: string;
  name: string;
  createdAt: string;
}

export type MapLayerType = 'satellite' | 'streets';
export type MapEngineType = 'google' | 'leaflet';

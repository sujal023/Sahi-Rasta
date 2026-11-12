import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { GaliRoute, LandmarkMarker, MapEngineType, MapLayerType } from '../types/route';
import { GoogleGaliMap } from './GoogleGaliMap';

interface GaliMapProps {
  route?: Partial<GaliRoute>;
  visitorPos?: [number, number] | null;
  nearestRoutePoint?: [number, number] | null;
  isOffRoute?: boolean;
  activeMarkerId?: string | null;
  mapLayer: MapLayerType;
  mapEngine?: MapEngineType;
  googleMapsApiKey?: string;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: LandmarkMarker) => void;
  interactiveMode?: 'view' | 'draw' | 'add_marker';
  showTileToggle?: boolean;
  className?: string;
}

export const GaliMap: React.FC<GaliMapProps> = ({
  route,
  visitorPos,
  nearestRoutePoint,
  isOffRoute,
  activeMarkerId,
  mapLayer,
  mapEngine = 'google',
  googleMapsApiKey = '',
  onMapClick,
  onMarkerClick,
  interactiveMode = 'view',
  className = 'h-full w-full'
}) => {
  // If user selected Google Maps engine and an API key is available, render GoogleGaliMap
  if (mapEngine === 'google' && googleMapsApiKey) {
    return (
      <GoogleGaliMap
        route={route}
        visitorPos={visitorPos}
        nearestRoutePoint={nearestRoutePoint}
        isOffRoute={isOffRoute}
        activeMarkerId={activeMarkerId}
        mapType={mapLayer === 'satellite' ? 'hybrid' : 'roadmap'}
        onMapClick={onMapClick}
        onMarkerClick={onMarkerClick}
        interactiveMode={interactiveMode}
        apiKey={googleMapsApiKey}
        className={className}
      />
    );
  }
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const polylineCasingRef = useRef<L.Polyline | null>(null);
  const offRouteLineRef = useRef<L.Polyline | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const visitorMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Default center in Delhi/NCR or first point
    const initialCenter: [number, number] = route?.path?.[0] || [28.6508, 77.2285];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 18,
      zoomControl: false,
      attributionControl: false
    });

    // Add zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Group for dynamic markers
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer based on mapLayer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let maxZoom = 19;

    if (mapLayer === 'satellite') {
      // High-res Esri World Imagery (perfect for narrow galis, rooftops, boundary walls)
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 19;
    }

    const tile = L.tileLayer(url, {
      maxZoom,
      subdomains: mapLayer === 'satellite' ? [] : ['a', 'b', 'c']
    }).addTo(map);

    tileLayerRef.current = tile;
  }, [mapLayer]);

  // Handle map clicks in drawing / add marker modes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [onMapClick, interactiveMode]);

  // Update Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (polylineCasingRef.current) {
      map.removeLayer(polylineCasingRef.current);
      polylineCasingRef.current = null;
    }
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    const path = route?.path;
    if (path && path.length > 1) {
      const latlngs: L.LatLngExpression[] = path.map(([lat, lng]) => [lat, lng]);

      // White casing for high contrast against satellite imagery or roads
      const casing = L.polyline(latlngs, {
        color: '#FFFFFF',
        weight: 10,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      // Vivid saffron/orange inner line
      const line = L.polyline(latlngs, {
        color: '#F97316',
        weight: 6,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      polylineCasingRef.current = casing;
      polylineRef.current = line;

      // In view mode, auto fit bounds once
      if (interactiveMode === 'view' && !visitorPos) {
        map.fitBounds(line.getBounds(), { padding: [50, 50], maxZoom: 18 });
      }
    }
  }, [route?.path, interactiveMode]);

  // Update Markers (Start, Turns, Warnings, Destination)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Start Landmark Marker
    if (route?.startLandmark && route.startLandmark.lat && route.startLandmark.lng) {
      const startIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-9 h-9 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center font-bold text-xs ring-4 ring-white border border-blue-700">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-6-5.6-6-10a6 6 0 1112 0c0 4.4-6 10-6 10z"/>
                <circle cx="12" cy="11" r="2.5" fill="currentColor"/>
              </svg>
            </div>
            <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/95 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-slate-200 pointer-events-none">
              Start
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const m = L.marker([route.startLandmark.lat, route.startLandmark.lng], { icon: startIcon });
      m.bindPopup(`
        <div class="p-2 text-xs">
          <p class="font-bold text-slate-900">${route.startLandmark.name}</p>
          <p class="text-slate-600 mt-1">${route.startLandmark.description}</p>
        </div>
      `);
      group.addLayer(m);
    }

    // 2. Destination Marker
    if (route?.destination && route.destination.lat && route.destination.lng) {
      const destIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-10 h-10 rounded-full bg-emerald-600 text-white shadow-xl flex items-center justify-center font-bold text-xs ring-4 ring-white border border-emerald-700 animate-bounce">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </div>
            <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm pointer-events-none">
              Destination
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const m = L.marker([route.destination.lat, route.destination.lng], { icon: destIcon });
      m.bindPopup(`
        <div class="p-2 text-xs">
          <p class="font-bold text-emerald-800">${route.destination.name}</p>
          <p class="text-slate-700 mt-0.5">${route.destination.flatFloor}</p>
          ${route.destination.notes ? `<p class="text-slate-500 mt-1 italic">${route.destination.notes}</p>` : ''}
        </div>
      `);
      group.addLayer(m);
    }

    // 3. Landmark & Turn Markers
    if (route?.markers && route.markers.length > 0) {
      route.markers.forEach((marker, index) => {
        let bgColor = 'bg-orange-500';
        let svgIcon = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
          </svg>
        `;

        if (marker.type === 'photo_landmark') {
          bgColor = 'bg-sky-600';
          svgIcon = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
          `;
        } else if (marker.type === 'warning') {
          bgColor = 'bg-red-600';
          svgIcon = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
          `;
        } else if (marker.type === 'parking') {
          bgColor = 'bg-indigo-600';
          svgIcon = `
            <span class="font-black text-xs">P</span>
          `;
        }

        const isActive = activeMarkerId === marker.id;
        const iconSize = isActive ? 38 : 30;

        const customIcon = L.divIcon({
          className: 'custom-map-icon',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110">
              <div class="w-${isActive ? '10' : '8'} h-${isActive ? '10' : '8'} rounded-full ${bgColor} text-white shadow-md flex items-center justify-center ring-2 ${isActive ? 'ring-yellow-400 ring-4 scale-110' : 'ring-white'}">
                ${svgIcon}
              </div>
              <div class="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-white text-[9px] font-medium px-1.5 py-0.2 rounded shadow">
                ${marker.badge || `#${index + 1}`}
              </div>
            </div>
          `,
          iconSize: [iconSize, iconSize],
          iconAnchor: [iconSize / 2, iconSize / 2]
        });

        const m = L.marker([marker.lat, marker.lng], { icon: customIcon });
        m.on('click', () => {
          if (onMarkerClick) onMarkerClick(marker);
        });

        group.addLayer(m);
      });
    }

    // In draw mode: show small vertex handles on each drawn point
    if (interactiveMode === 'draw' && route?.path) {
      route.path.forEach(([lat, lng], idx) => {
        const handleIcon = L.divIcon({
          className: 'custom-map-icon',
          html: `<div class="w-3.5 h-3.5 rounded-full bg-white border-2 border-orange-500 shadow-sm flex items-center justify-center text-[8px] font-bold text-slate-700">${idx + 1}</div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        const handle = L.marker([lat, lng], { icon: handleIcon });
        group.addLayer(handle);
      });
    }
  }, [route?.markers, route?.path, route?.startLandmark, route?.destination, activeMarkerId, interactiveMode, onMarkerClick]);

  // Update Visitor Live GPS Dot and Off-Route Line
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (visitorMarkerRef.current) {
      map.removeLayer(visitorMarkerRef.current);
      visitorMarkerRef.current = null;
    }
    if (offRouteLineRef.current) {
      map.removeLayer(offRouteLineRef.current);
      offRouteLineRef.current = null;
    }

    if (visitorPos) {
      const visitorIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-6 h-6 rounded-full bg-blue-600 ring-4 ring-blue-300 shadow-xl flex items-center justify-center gps-dot-pulse">
              <div class="w-2.5 h-2.5 rounded-full bg-white"></div>
            </div>
            <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-blue-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none">
              You
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const visitorMarker = L.marker(visitorPos, { icon: visitorIcon }).addTo(map);
      visitorMarkerRef.current = visitorMarker;

      // Draw dashed line back to route if off route
      if (isOffRoute && nearestRoutePoint) {
        const dashedGuide = L.polyline([visitorPos, nearestRoutePoint], {
          color: '#EF4444',
          weight: 3,
          dashArray: '6, 8',
          opacity: 0.95
        }).addTo(map);
        offRouteLineRef.current = dashedGuide;
      }
    }
  }, [visitorPos, isOffRoute, nearestRoutePoint]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
};

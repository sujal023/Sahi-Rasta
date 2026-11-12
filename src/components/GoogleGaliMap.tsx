import React, { useEffect } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary
} from '@vis.gl/react-google-maps';
import { GaliRoute, LandmarkMarker } from '../types/route';

interface GoogleGaliMapProps {
  route?: Partial<GaliRoute>;
  visitorPos?: [number, number] | null;
  nearestRoutePoint?: [number, number] | null;
  isOffRoute?: boolean;
  activeMarkerId?: string | null;
  mapType?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: LandmarkMarker) => void;
  interactiveMode?: 'view' | 'draw' | 'add_marker';
  apiKey: string;
  className?: string;
}

// Inner component with access to Google Maps instance via useMap() and useMapsLibrary()
function MapPolylineLayer({
  path,
  visitorPos,
  nearestRoutePoint,
  isOffRoute,
}: {
  path?: [number, number][];
  visitorPos?: [number, number] | null;
  nearestRoutePoint?: [number, number] | null;
  isOffRoute?: boolean;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !mapsLib || !path || path.length < 2) return;

    const pathCoords = path.map(([lat, lng]) => ({ lat, lng }));

    // High contrast white casing
    const casing = new mapsLib.Polyline({
      path: pathCoords,
      geodesic: true,
      strokeColor: '#FFFFFF',
      strokeOpacity: 0.95,
      strokeWeight: 10,
      map,
    });

    // Vivid saffron / orange route polyline
    const routeLine = new mapsLib.Polyline({
      path: pathCoords,
      geodesic: true,
      strokeColor: '#F97316',
      strokeOpacity: 1.0,
      strokeWeight: 6,
      map,
    });

    return () => {
      casing.setMap(null);
      routeLine.setMap(null);
    };
  }, [map, mapsLib, path]);

  // Off route dashed red indicator line
  useEffect(() => {
    if (!map || !mapsLib || !isOffRoute || !visitorPos || !nearestRoutePoint) return;

    const line = new mapsLib.Polyline({
      path: [
        { lat: visitorPos[0], lng: visitorPos[1] },
        { lat: nearestRoutePoint[0], lng: nearestRoutePoint[1] },
      ],
      strokeColor: '#EF4444',
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map,
    });

    return () => {
      line.setMap(null);
    };
  }, [map, mapsLib, isOffRoute, visitorPos, nearestRoutePoint]);

  return null;
}

// Auto-fitter to center bounds when route changes
function MapBoundsFitter({ path }: { path?: [number, number][] }) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !mapsLib || !path || path.length < 2) return;
    const bounds = new mapsLib.LatLngBounds();
    path.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
    map.fitBounds(bounds, 60);
  }, [map, mapsLib, path]);

  return null;
}

export const GoogleGaliMap: React.FC<GoogleGaliMapProps> = ({
  route,
  visitorPos,
  nearestRoutePoint,
  isOffRoute,
  activeMarkerId,
  mapType = 'hybrid',
  onMapClick,
  onMarkerClick,
  interactiveMode = 'view',
  apiKey,
  className = 'h-full w-full'
}) => {
  const initialCenter = route?.path?.[0]
    ? { lat: route.path[0][0], lng: route.path[0][1] }
    : { lat: 28.6508, lng: 77.2285 };

  return (
    <div className={`relative ${className}`}>
      <APIProvider
        apiKey={apiKey}
        libraries={['places', 'geometry', 'routes']}
      >
        <Map
          mapId="DEMO_MAP_ID"
          defaultCenter={initialCenter}
          defaultZoom={18}
          mapTypeId={mapType}
          disableDefaultUI={false}
          gestureHandling="greedy"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          onClick={e => {
            if (onMapClick && e.detail.latLng) {
              onMapClick(e.detail.latLng.lat, e.detail.latLng.lng);
            }
          }}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Custom Route Polylines */}
          <MapPolylineLayer
            path={route?.path}
            visitorPos={visitorPos}
            nearestRoutePoint={nearestRoutePoint}
            isOffRoute={isOffRoute}
          />

          {/* Auto Bounds Fitter in View Mode */}
          {interactiveMode === 'view' && !visitorPos && (
            <MapBoundsFitter path={route?.path} />
          )}

          {/* 1. Start Landmark Marker */}
          {route?.startLandmark && route.startLandmark.lat && route.startLandmark.lng && (
            <AdvancedMarker
              position={{ lat: route.startLandmark.lat, lng: route.startLandmark.lng }}
              title={route.startLandmark.name}
            >
              <div className="relative flex items-center justify-center cursor-pointer group">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center font-bold text-xs ring-4 ring-white border border-blue-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-6-5.6-6-10a6 6 0 1112 0c0 4.4-6 10-6 10z"/>
                    <circle cx="12" cy="11" r="2.5" fill="currentColor"/>
                  </svg>
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/95 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-slate-200 pointer-events-none">
                  Start: {route.startLandmark.name}
                </div>
              </div>
            </AdvancedMarker>
          )}

          {/* 2. Destination Marker */}
          {route?.destination && route.destination.lat && route.destination.lng && (
            <AdvancedMarker
              position={{ lat: route.destination.lat, lng: route.destination.lng }}
              title={route.destination.name}
            >
              <div className="relative flex items-center justify-center cursor-pointer animate-bounce">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white shadow-xl flex items-center justify-center font-bold text-xs ring-4 ring-white border border-emerald-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                  </svg>
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm pointer-events-none">
                  {route.destination.name}
                </div>
              </div>
            </AdvancedMarker>
          )}

          {/* 3. Turn & Landmark Markers */}
          {route?.markers && route.markers.map((marker, idx) => {
            const isActive = activeMarkerId === marker.id;
            let bgColor = 'bg-orange-500';
            if (marker.type === 'photo_landmark') bgColor = 'bg-sky-600';
            else if (marker.type === 'warning') bgColor = 'bg-red-600';
            else if (marker.type === 'parking') bgColor = 'bg-indigo-600';

            return (
              <AdvancedMarker
                key={marker.id}
                position={{ lat: marker.lat, lng: marker.lng }}
                title={marker.title}
                onClick={() => onMarkerClick?.(marker)}
              >
                <div className="relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110">
                  <div className={`w-${isActive ? '10' : '8'} h-${isActive ? '10' : '8'} rounded-full ${bgColor} text-white shadow-md flex items-center justify-center ring-2 ${isActive ? 'ring-yellow-400 ring-4 scale-110' : 'ring-white'}`}>
                    {marker.type === 'photo_landmark' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                        <circle cx="12" cy="13" r="3"/>
                      </svg>
                    ) : marker.type === 'warning' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                      </svg>
                    ) : marker.type === 'parking' ? (
                      <span className="font-black text-xs">P</span>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
                      </svg>
                    )}
                  </div>
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-white text-[9px] font-medium px-1.5 py-0.2 rounded shadow">
                    {marker.badge || `#${idx + 1}`}
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}

          {/* 4. Live Visitor GPS Blue Dot */}
          {visitorPos && (
            <AdvancedMarker position={{ lat: visitorPos[0], lng: visitorPos[1] }} title="Your Location">
              <div className="relative flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-blue-600 ring-4 ring-blue-300 shadow-xl flex items-center justify-center gps-dot-pulse">
                  <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-blue-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none">
                  You
                </div>
              </div>
            </AdvancedMarker>
          )}

          {/* 5. Vertices Handles in Draw Mode */}
          {interactiveMode === 'draw' && route?.path && route.path.map(([lat, lng], idx) => (
            <AdvancedMarker key={`vertex-${idx}`} position={{ lat, lng }}>
              <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-orange-500 shadow-sm flex items-center justify-center text-[8px] font-bold text-slate-700">
                {idx + 1}
              </div>
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  ArrowRight,
  Compass,
  CornerDownRight,
  ExternalLink,
  Layers,
  MapPin,
  Navigation,
  ParkingSquare,
  Phone,
  Play,
  RotateCcw,
  Share2,
  Volume2,
  CheckCircle2,
  X
} from 'lucide-react';
import { GaliMap } from './GaliMap';
import { QRCodeModal } from './QRCodeModal';
import { GaliRoute, LandmarkMarker, MapEngineType, MapLayerType } from '../types/route';
import {
  distanceBetweenCoordsMeters,
  evaluateVisitorPosition,
  formatDistance,
  formatWalkTime,
  OffRouteStatus
} from '../utils/geo';
import { recordRouteVisit } from '../utils/api';

interface VisitorNavigatorProps {
  route: GaliRoute;
  onBackToHost?: () => void;
  lang?: 'en' | 'hi';
  googleMapsApiKey?: string;
}

export const VisitorNavigator: React.FC<VisitorNavigatorProps> = ({
  route,
  onBackToHost,
  lang = 'en',
  googleMapsApiKey = ''
}) => {
  const [mapLayer, setMapLayer] = useState<MapLayerType>('satellite');
  const [mapEngine, setMapEngine] = useState<MapEngineType>(googleMapsApiKey ? 'google' : 'leaflet');
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [visitorPos, setVisitorPos] = useState<[number, number] | null>(null);
  const [activeMarker, setActiveMarker] = useState<LandmarkMarker | null>(null);
  const [dismissedMarkerId, setDismissedMarkerId] = useState<string | null>(null);
  const [hasArrived, setHasArrived] = useState<boolean>(false);
  const [showQR, setShowQR] = useState<boolean>(false);

  // Off-route smoothing state: consecutive bad readings
  const [offRouteCounter, setOffRouteCounter] = useState<number>(0);
  const [offRouteInfo, setOffRouteInfo] = useState<OffRouteStatus | null>(null);

  // Simulation mode for testing indoor/laptop
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationIndex, setSimulationIndex] = useState<number>(0);

  const geoWatchIdRef = useRef<number | null>(null);

  // Record visit once on load
  useEffect(() => {
    if (route.id) {
      recordRouteVisit(route.id);
    }
  }, [route.id]);

  // Real Geolocation Tracking
  useEffect(() => {
    if (isNavigating && !isSimulating && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      const id = navigator.geolocation.watchPosition(
        pos => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setVisitorPos(coords);
          handlePositionUpdate(coords);
        },
        err => {
          console.warn('Geolocation watch error:', err.message);
        },
        { enableHighAccuracy: true, maximumAge: 1500, timeout: 10000 }
      );
      geoWatchIdRef.current = id;

      return () => {
        navigator.geolocation.clearWatch(id);
      };
    } else if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
  }, [isNavigating, isSimulating]);

  // Simulated GPS walker for demonstration & testing
  useEffect(() => {
    let timer: any;
    if (isSimulating && isNavigating && route.path && route.path.length > 0) {
      timer = setInterval(() => {
        setSimulationIndex(prev => {
          const next = prev + 1;
          if (next >= route.path.length) {
            // Arrived at destination
            const finalPos = route.path[route.path.length - 1];
            setVisitorPos(finalPos);
            handlePositionUpdate(finalPos);
            setIsSimulating(false);
            return prev;
          }
          const currentPos = route.path[next];
          setVisitorPos(currentPos);
          handlePositionUpdate(currentPos);
          return next;
        });
      }, 3000); // Step every 3 seconds
    }
    return () => clearInterval(timer);
  }, [isSimulating, isNavigating, route.path]);

  // Position evaluation: check off-route and proximity to markers
  const handlePositionUpdate = (pos: [number, number]) => {
    const status = evaluateVisitorPosition(pos, route.path, 25);
    setOffRouteInfo(status);

    // Off-route smoothing: require 2 consecutive readings beyond 25m
    if (status.isOffRoute) {
      setOffRouteCounter(prev => prev + 1);
    } else {
      setOffRouteCounter(0);
    }

    // Check proximity to destination (< 15 meters)
    if (route.destination) {
      const distToDest = distanceBetweenCoordsMeters(pos, [route.destination.lat, route.destination.lng]);
      if (distToDest <= 18 && !hasArrived) {
        setHasArrived(true);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }

    // Check proximity to turn markers (< 20 meters)
    if (route.markers && route.markers.length > 0) {
      for (const m of route.markers) {
        const d = distanceBetweenCoordsMeters(pos, [m.lat, m.lng]);
        if (d <= 22 && dismissedMarkerId !== m.id) {
          setActiveMarker(m);
          break;
        }
      }
    }
  };

  const handleStartNavigation = () => {
    setIsNavigating(true);
    setHasArrived(false);
    // Initial position to starting landmark if GPS not ready yet
    if (!visitorPos && route.path.length > 0) {
      setVisitorPos(route.path[0]);
      handlePositionUpdate(route.path[0]);
    }
  };

  const handleStartSimulation = () => {
    setIsNavigating(true);
    setIsSimulating(true);
    setHasArrived(false);
    setSimulationIndex(0);
    if (route.path.length > 0) {
      setVisitorPos(route.path[0]);
      handlePositionUpdate(route.path[0]);
    }
  };

  const handleSimulateOffRoute = () => {
    // Deliberately shift visitor position 40m away to showcase off-route radar
    if (visitorPos) {
      const offPos: [number, number] = [visitorPos[0] + 0.00035, visitorPos[1] + 0.00035];
      setVisitorPos(offPos);
      handlePositionUpdate(offPos);
      setOffRouteCounter(2); // trigger warning immediately
    }
  };

  const handleResetToRoute = () => {
    if (route.path.length > 0) {
      const safePos = route.path[Math.min(simulationIndex, route.path.length - 1)];
      setVisitorPos(safePos);
      handlePositionUpdate(safePos);
      setOffRouteCounter(0);
    }
  };

  // Google Maps links
  const startLandmarkUrl = `https://www.google.com/maps/dir/?api=1&destination=${route.startLandmark.lat},${route.startLandmark.lng}`;

  const waypointsUrl = (() => {
    if (!route.path || route.path.length < 2) return '';
    const start = `${route.path[0][0]},${route.path[0][1]}`;
    const end = `${route.path[route.path.length - 1][0]},${route.path[route.path.length - 1][1]}`;
    const intermediate = route.path.slice(1, -1).slice(0, 8).map(pt => `${pt[0]},${pt[1]}`).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${start}&destination=${end}&waypoints=${encodeURIComponent(intermediate)}&travelmode=walking`;
  })();

  const isConfirmedOffRoute = offRouteCounter >= 2 && (offRouteInfo?.isOffRoute ?? false);

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-900">
      {/* Fullscreen Map Canvas */}
      <GaliMap
        route={route}
        visitorPos={visitorPos}
        nearestRoutePoint={offRouteInfo?.nearestPoint}
        isOffRoute={isConfirmedOffRoute}
        activeMarkerId={activeMarker?.id}
        mapLayer={mapLayer}
        mapEngine={mapEngine}
        googleMapsApiKey={googleMapsApiKey}
        onMarkerClick={marker => setActiveMarker(marker)}
        interactiveMode="view"
        className="h-full w-full"
      />

      {/* Floating Top Controls */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-30">
        <div className="flex items-center gap-2 pointer-events-auto">
          {onBackToHost && (
            <button
              onClick={onBackToHost}
              className="py-2 px-3 rounded-xl bg-white/95 text-slate-800 text-xs font-bold shadow-md hover:bg-white flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              ← {lang === 'hi' ? 'वापस' : 'Host View'}
            </button>
          )}

          <div className="bg-slate-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-slate-700 text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="truncate max-w-[140px] sm:max-w-xs">{route.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setShowQR(true)}
            className="p-2.5 rounded-xl bg-white/95 text-slate-800 shadow-md hover:bg-white transition-colors border border-slate-200"
            title="Share / QR Code"
          >
            <Share2 className="w-4 h-4 text-orange-600" />
          </button>

          <button
            onClick={() => setMapEngine(prev => prev === 'google' ? 'leaflet' : 'google')}
            className="py-2 px-2.5 rounded-xl bg-white/95 text-slate-800 text-xs font-bold shadow-md hover:bg-white transition-colors border border-slate-200"
            title="Toggle between Google Maps and Leaflet"
          >
            <span className="text-orange-600">{mapEngine === 'google' ? 'Google Maps' : 'Leaflet'}</span>
          </button>

          <button
            onClick={() => setMapLayer(prev => (prev === 'satellite' ? 'streets' : 'satellite'))}
            className="py-2 px-3 rounded-xl bg-white/95 text-slate-800 text-xs font-bold shadow-md hover:bg-white flex items-center gap-1.5 transition-colors border border-slate-200"
          >
            <Layers className="w-4 h-4 text-orange-600" />
            <span>{mapLayer === 'satellite' ? 'Satellite' : 'Street'}</span>
          </button>
        </div>
      </div>

      {/* OFF-ROUTE WARNING RADAR BANNER */}
      {isConfirmedOffRoute && (
        <div className="absolute top-16 left-3 right-3 z-40 animate-in slide-in-from-top-4 duration-200">
          <div className="off-route-glow text-white p-3.5 rounded-2xl shadow-2xl border border-red-400 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white text-red-600 flex items-center justify-center shrink-0 shadow-sm">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-black tracking-tight">
                  {lang === 'hi' ? 'आप रास्ते से भटक गए हैं!' : 'You Are Off Route!'}
                </h4>
                <p className="text-xs text-red-100 mt-0.5">
                  {offRouteInfo?.distanceToRouteMeters}m away from the gali line. Follow red guide line back.
                </p>
              </div>
            </div>

            <button
              onClick={handleResetToRoute}
              className="py-1.5 px-3 rounded-xl bg-white text-red-700 text-xs font-bold shadow-sm shrink-0 hover:bg-red-50"
            >
              {lang === 'hi' ? 'रास्ते पर लौटें' : 'Back to Path'}
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE TURN / PHOTO LANDMARK CARD POPUP */}
      {activeMarker && (
        <div className="absolute top-20 left-4 right-4 max-w-sm mx-auto z-40 animate-in zoom-in-95 fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 relative overflow-hidden">
            <button
              onClick={() => {
                setDismissedMarkerId(activeMarker.id);
                setActiveMarker(null);
              }}
              className="absolute top-2.5 right-2.5 p-1 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            {activeMarker.photoUrl && (
              <div className="relative mb-3 -mx-4 -mt-4">
                <img
                  src={activeMarker.photoUrl}
                  alt={activeMarker.title}
                  className="w-full h-36 object-cover"
                />
                <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                  Visual Landmark
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                {activeMarker.badge || 'Turn Landmark'}
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900">{activeMarker.title}</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{activeMarker.description}</p>
          </div>
        </div>
      )}

      {/* ARRIVED CELEBRATION MODAL */}
      {hasArrived && (
        <div className="absolute inset-x-4 top-20 max-w-md mx-auto z-50 animate-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-emerald-500 p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
                {lang === 'hi' ? 'आप पहुँच गए हैं!' : 'You Have Arrived!'}
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-1">{route.destination.name}</h3>
              <p className="text-xs font-medium text-slate-700 mt-0.5">{route.destination.flatFloor}</p>
            </div>

            {route.destination.notes && (
              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                "{route.destination.notes}"
              </p>
            )}

            {route.destination.parkingAvailable && route.destination.parkingInstructions && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50 text-indigo-900 text-xs text-left">
                <ParkingSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{route.destination.parkingInstructions}</span>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <a
                href={`tel:${route.hostPhone}`}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              >
                <Phone className="w-4 h-4" />
                {lang === 'hi' ? 'मेज़बान को कॉल करें' : 'Call Host'} ({route.hostName || 'Host'})
              </a>

              <button
                onClick={() => setHasArrived(false)}
                className="text-xs text-slate-500 hover:text-slate-800 py-1"
              >
                {lang === 'hi' ? 'मैप देखें' : 'Dismiss and view map'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING BOTTOM DRAWER (ERGONOMIC THUMB ZONE) */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-slate-950 via-slate-900/90 to-transparent">
        <div className="max-w-md mx-auto space-y-3">
          {/* Starting Landmark Summary Banner (Bonus Button 1) */}
          {!isNavigating && (
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-600 uppercase tracking-wide">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{lang === 'hi' ? 'शुरुआती बिंदु' : 'Starting Landmark'}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-1 mt-0.5">
                    {route.startLandmark.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                    {route.startLandmark.description}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-orange-600 tabular-nums">
                    {formatDistance(route.distanceMeters)}
                  </span>
                  <span className="block text-[10px] text-slate-400 font-medium">
                    {formatWalkTime(route.distanceMeters)}
                  </span>
                </div>
              </div>

              {/* Bonus Button 1: Google Maps to Starting Landmark only */}
              <a
                href={startLandmarkUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                {lang === 'hi'
                  ? 'लैंडमार्क तक गूगल मैप्स से पहुँचें'
                  : 'Get me to starting landmark (Google Maps)'}
              </a>
            </div>
          )}

          {/* Navigation Controls Bar */}
          <div className="bg-white rounded-2xl p-3 shadow-2xl border border-slate-100 flex items-center gap-3">
            {!isNavigating ? (
              <button
                onClick={handleStartNavigation}
                className="flex-1 h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 active:scale-[0.98] transition-transform"
              >
                <Play className="w-5 h-5 fill-white" />
                {lang === 'hi' ? 'नेविगेशन शुरू करें' : 'Start Navigation (Live GPS)'}
              </button>
            ) : (
              <div className="flex-1 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    <Navigation className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      {lang === 'hi' ? 'बची हुई दूरी' : 'Remaining'}
                    </span>
                    <span className="text-sm font-black text-slate-900 tabular-nums">
                      {formatDistance(offRouteInfo?.distanceRemainingMeters || route.distanceMeters)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleSimulateOffRoute}
                    className="py-1.5 px-2.5 rounded-lg border border-red-200 bg-red-50 text-[11px] font-bold text-red-700 hover:bg-red-100"
                    title="Test off-route alert"
                  >
                    Test Off-Route
                  </button>

                  <button
                    onClick={() => {
                      setIsNavigating(false);
                      setIsSimulating(false);
                      setVisitorPos(null);
                    }}
                    className="py-1.5 px-3 rounded-lg border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}

            {/* Test Simulation Button */}
            {!isNavigating && (
              <button
                onClick={handleStartSimulation}
                className="h-12 px-4 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold shrink-0 transition-colors"
                title="Simulate step-by-step walk without walking outdoors"
              >
                Demo Walk
              </button>
            )}
          </div>

          {/* Bonus Button 2: Waypoints in Google Maps */}
          {waypointsUrl && (
            <div className="text-center">
              <a
                href={waypointsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-slate-300 hover:text-white underline inline-flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
              >
                Open full route in Google Maps (Waypoints Trick)
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      <QRCodeModal
        route={route}
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        lang={lang}
      />
    </div>
  );
};

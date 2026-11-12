import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  Compass,
  CornerDownRight,
  Footprints,
  Info,
  Layers,
  MapPin,
  Navigation,
  ParkingSquare,
  Plus,
  RotateCcw,
  Save,
  Share2,
  Trash2,
  Upload,
  AlertTriangle
} from 'lucide-react';
import { GaliMap } from './GaliMap';
import { DestinationPoint, GaliRoute, LandmarkMarker, LandmarkStartPoint, MapEngineType, MapLayerType, MarkerType } from '../types/route';
import { calculatePathLengthMeters, formatDistance, formatWalkTime } from '../utils/geo';
import { saveRouteApi } from '../utils/api';

interface HostRouteEditorProps {
  initialRoute?: GaliRoute | null;
  onCancel: () => void;
  onSaved: (route: GaliRoute) => void;
  lang?: 'en' | 'hi';
  googleMapsApiKey?: string;
}

const PRESET_PHOTOS = [
  { label: 'Blue Iron Gate', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80' },
  { label: 'Kirana Shop Corner', url: 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=600&auto=format&fit=crop&q=80' },
  { label: 'Yellow Temple / Wall', url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80' },
  { label: 'Bakery / Chai Corner', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80' },
];

export const HostRouteEditor: React.FC<HostRouteEditorProps> = ({
  initialRoute,
  onCancel,
  onSaved,
  lang = 'en',
  googleMapsApiKey = ''
}) => {
  // Stepper: 1: Details & Start -> 2: Draw / Record Path -> 3: Landmarks -> 4: Destination & Finish
  const [activeStep, setActiveStep] = useState<number>(1);
  const [mapLayer, setMapLayer] = useState<MapLayerType>('satellite');
  const [mapEngine, setMapEngine] = useState<MapEngineType>(googleMapsApiKey ? 'google' : 'leaflet');

  // Form Fields
  const [title, setTitle] = useState<string>(initialRoute?.title || '');
  const [category, setCategory] = useState<GaliRoute['category']>(initialRoute?.category || 'home');
  const [hostName, setHostName] = useState<string>(initialRoute?.hostName || '');
  const [hostPhone, setHostPhone] = useState<string>(initialRoute?.hostPhone || '');

  // Landmark Start
  const [startLandmark, setStartLandmark] = useState<LandmarkStartPoint>(
    initialRoute?.startLandmark || {
      name: 'Chawri Bazar Metro Gate 3',
      description: 'Right next to Shyam Sweets on the main market road',
      lat: 28.6508,
      lng: 77.2285,
      landmarkType: 'metro',
    }
  );

  // Path coordinates [[lat, lng], ...]
  const [path, setPath] = useState<[number, number][]>(
    initialRoute?.path || [
      [28.6508, 77.2285],
      [28.6512, 77.2289],
    ]
  );

  // Draw Mode vs Walk Mode
  const [pathMode, setPathMode] = useState<'tap' | 'walk'>('tap');
  const [isRecordingWalk, setIsRecordingWalk] = useState<boolean>(false);
  const [walkWatchId, setWalkWatchId] = useState<number | null>(null);

  // Turn Markers
  const [markers, setMarkers] = useState<LandmarkMarker[]>(initialRoute?.markers || []);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  // Destination Details
  const [destination, setDestination] = useState<DestinationPoint>(
    initialRoute?.destination || {
      name: 'Sharma Niwas, Haveli 412',
      flatFloor: 'Second Floor, Doorbell on Left',
      notes: 'Car cannot enter after kirana turn. Two-wheelers park at blue gate.',
      lat: 28.6528,
      lng: 77.2312,
      parkingAvailable: true,
      parkingInstructions: 'Two-wheeler parking inside blue gate',
    }
  );

  // New Marker Modal / Form State
  const [showAddMarkerModal, setShowAddMarkerModal] = useState<boolean>(false);
  const [newMarkerType, setNewMarkerType] = useState<MarkerType>('turn');
  const [newMarkerTitle, setNewMarkerTitle] = useState<string>('');
  const [newMarkerDesc, setNewMarkerDesc] = useState<string>('');
  const [newMarkerBadge, setNewMarkerBadge] = useState<string>('Take Left');
  const [newMarkerPhoto, setNewMarkerPhoto] = useState<string>('');
  const [newMarkerLat, setNewMarkerLat] = useState<number>(28.6515);
  const [newMarkerLng, setNewMarkerLng] = useState<number>(77.2294);

  const [saving, setSaving] = useState<boolean>(false);

  // Calculated distance & walk time
  const distanceMeters = calculatePathLengthMeters(path);
  const walkMinutes = Math.max(1, Math.round(distanceMeters / 75));

  // Geolocation Walk-and-Record handler
  useEffect(() => {
    if (isRecordingWalk && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      const id = navigator.geolocation.watchPosition(
        pos => {
          const newPt: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setPath(prev => {
            // Avoid adding point if identical to last
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              const dLat = Math.abs(last[0] - newPt[0]);
              const dLng = Math.abs(last[1] - newPt[1]);
              if (dLat < 0.00003 && dLng < 0.00003) return prev; // less than ~3 meters
            }
            return [...prev, newPt];
          });
        },
        err => {
          console.warn('Geolocation recording error:', err.message);
        },
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
      setWalkWatchId(id);

      return () => {
        navigator.geolocation.clearWatch(id);
      };
    } else if (walkWatchId !== null) {
      navigator.geolocation.clearWatch(walkWatchId);
      setWalkWatchId(null);
    }
  }, [isRecordingWalk]);

  // Handle map clicks
  const handleMapClick = (lat: number, lng: number) => {
    if (activeStep === 2 && pathMode === 'tap') {
      // Add point to path
      setPath(prev => [...prev, [lat, lng]]);
    } else if (activeStep === 1) {
      // Set start landmark
      setStartLandmark(prev => ({ ...prev, lat, lng }));
    } else if (activeStep === 4) {
      // Set destination point
      setDestination(prev => ({ ...prev, lat, lng }));
    } else if (activeStep === 3) {
      // Prepare marker at clicked point
      setNewMarkerLat(lat);
      setNewMarkerLng(lng);
      setShowAddMarkerModal(true);
    }
  };

  const handleUndoPoint = () => {
    setPath(prev => (prev.length > 0 ? prev.slice(0, -1) : []));
  };

  const handleClearPath = () => {
    if (confirm(lang === 'hi' ? 'क्या आप पूरा रास्ता मिटाना चाहते हैं?' : 'Clear all points from the drawn path?')) {
      setPath([]);
    }
  };

  // Simulated walk step for indoor/desktop testing
  const handleSimulateWalkStep = () => {
    if (path.length === 0) {
      setPath([[startLandmark.lat, startLandmark.lng]]);
      return;
    }
    const last = path[path.length - 1];
    // Step roughly 15m in a natural gali direction
    const nextLat = last[0] + (Math.random() * 0.0002 - 0.00005);
    const nextLng = last[1] + 0.00015;
    setPath(prev => [...prev, [nextLat, nextLng]]);
  };

  const handleSaveMarker = () => {
    if (!newMarkerTitle) return;

    const newMarker: LandmarkMarker = {
      id: `m_${Date.now()}`,
      orderIndex: markers.length,
      lat: newMarkerLat,
      lng: newMarkerLng,
      type: newMarkerType,
      title: newMarkerTitle,
      description: newMarkerDesc,
      badge: newMarkerBadge,
      photoUrl: newMarkerPhoto || undefined,
    };

    setMarkers(prev => [...prev, newMarker]);
    setShowAddMarkerModal(false);
    setNewMarkerTitle('');
    setNewMarkerDesc('');
    setNewMarkerPhoto('');
  };

  const handleDeleteMarker = (id: string) => {
    setMarkers(prev => prev.filter(m => m.id !== id));
  };

  const handleFinalPublish = async () => {
    if (!title) {
      alert(lang === 'hi' ? 'कृपया रास्ते का नाम दर्ज करें' : 'Please provide a route title');
      setActiveStep(1);
      return;
    }
    if (path.length < 2) {
      alert(lang === 'hi' ? 'कृपया कम से कम 2 बिंदु जोड़कर रास्ता बनाएं' : 'Please draw at least 2 points for the path');
      setActiveStep(2);
      return;
    }

    setSaving(true);
    try {
      const routeData: Partial<GaliRoute> = {
        id: initialRoute?.id,
        title,
        category,
        hostName: hostName || 'Gali Guide Host',
        hostPhone: hostPhone || '+91 98000 00000',
        startLandmark,
        destination,
        path,
        markers,
        distanceMeters,
        estimatedWalkMinutes: walkMinutes,
        isPublic: true,
      };

      const saved = await saveRouteApi(routeData);
      onSaved(saved);
    } catch (e) {
      console.error('Error saving route:', e);
      alert('Failed to save route. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Synthetic temporary route for map preview
  const previewRoute: Partial<GaliRoute> = {
    title,
    startLandmark,
    destination,
    path,
    markers,
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-100">
      {/* Left / Top Control Panel */}
      <div className="w-full lg:w-[440px] xl:w-[480px] bg-white border-r border-slate-200 flex flex-col h-full z-20 shadow-md">
        {/* Editor Top Bar */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-bold text-slate-900 line-clamp-1">
                {initialRoute ? 'Edit Route' : (lang === 'hi' ? 'नया रास्ता बनाएं' : 'Create Gali Route')}
              </h2>
              <p className="text-[11px] text-slate-500">
                {lang === 'hi' ? 'सटीक गली रास्ता और लैंडमार्क' : 'Host Path & Photo Landmarks'}
              </p>
            </div>
          </div>

          {/* Map Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMapEngine(prev => prev === 'google' ? 'leaflet' : 'google')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs"
              title="Toggle Map Engine"
            >
              <span className="text-orange-600">{mapEngine === 'google' ? 'Google Maps' : 'Leaflet'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMapLayer(prev => (prev === 'satellite' ? 'streets' : 'satellite'))}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs"
            >
              <Layers className="w-3.5 h-3.5 text-orange-600" />
              <span>{mapLayer === 'satellite' ? 'Satellite' : 'Street'}</span>
            </button>
          </div>
        </div>

        {/* Stepper Tabs */}
        <div className="grid grid-cols-4 border-b border-slate-200 text-center text-xs font-semibold bg-white">
          {[
            { num: 1, label: lang === 'hi' ? 'शुरुआत' : '1. Start' },
            { num: 2, label: lang === 'hi' ? 'रास्ता' : '2. Draw' },
            { num: 3, label: lang === 'hi' ? 'लैंडमार्क' : '3. Turns' },
            { num: 4, label: lang === 'hi' ? 'मंज़िल' : '4. Finish' },
          ].map(s => (
            <button
              key={s.num}
              onClick={() => setActiveStep(s.num)}
              className={`py-3 px-1 border-b-2 transition-colors ${
                activeStep === s.num
                  ? 'border-orange-600 text-orange-600 bg-orange-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Scrollable Step Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* STEP 1: Details & Starting Landmark */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {lang === 'hi' ? 'रास्ते का नाम' : 'Route Name (e.g. Sharma Ji Ka Ghar)'} *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Sharma Ji Ka Ghar / Gupta Clinic Entrance"
                  className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'hi' ? 'श्रेणी' : 'Category'}
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="home">Home / Relatives</option>
                    <option value="delivery">Delivery & Courier</option>
                    <option value="clinic">Clinic / Doctor</option>
                    <option value="event">Wedding & Event</option>
                    <option value="farmhouse">Farmhouse / Village</option>
                    <option value="shop">Shop / Business</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'hi' ? 'मेज़बान का फोन' : 'Host Contact Phone'}
                  </label>
                  <input
                    type="text"
                    value={hostPhone}
                    onChange={e => setHostPhone(e.target.value)}
                    placeholder="+91 98101 23456"
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Start Landmark Section */}
              <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200/80 space-y-3">
                <div className="flex items-center gap-2 text-orange-900 font-bold text-xs uppercase tracking-wider">
                  <MapPin className="w-4 h-4 text-orange-600" />
                  <span>{lang === 'hi' ? 'शुरुआती प्रसिद्ध लैंडमार्क' : 'Step 3: Starting Landmark'}</span>
                </div>
                <p className="text-xs text-slate-600">
                  {lang === 'hi'
                    ? 'कोई ऐसा लैंडमार्क जिसे सब जानते हों (जैसे मेट्रो स्टेशन, मंदिर, पेट्रोल पंप, मुख्य चौराहा)।'
                    : 'Choose a well-known spot everyone recognizes (metro gate, temple, petrol pump, main chowk).'}
                </p>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {lang === 'hi' ? 'लैंडमार्क का नाम' : 'Landmark Name'}
                  </label>
                  <input
                    type="text"
                    value={startLandmark.name}
                    onChange={e => setStartLandmark(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Chawri Bazar Metro Gate 3"
                    className="w-full text-xs border border-slate-300 bg-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {lang === 'hi' ? 'निर्देश' : 'Meeting / Starting Note'}
                  </label>
                  <input
                    type="text"
                    value={startLandmark.description}
                    onChange={e => setStartLandmark(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g. Exit Gate 3, stand next to Shyam Sweets"
                    className="w-full text-xs border border-slate-300 bg-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                  <span>Coordinates: {startLandmark.lat.toFixed(4)}, {startLandmark.lng.toFixed(4)}</span>
                  <span className="text-orange-700 font-medium">Tap map to reposition</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Draw or Walk Record */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {lang === 'hi' ? 'रास्ता खींचें या चलकर रिकॉर्ड करें' : 'Step 4: Draw or Record Path'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {distanceMeters > 0 ? `${formatDistance(distanceMeters)} · ${walkMinutes} min walk` : 'No points yet'}
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setPathMode('tap')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      pathMode === 'tap'
                        ? 'bg-white text-orange-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tap Mode
                  </button>
                  <button
                    onClick={() => setPathMode('walk')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      pathMode === 'walk'
                        ? 'bg-white text-orange-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Walk Mode
                  </button>
                </div>
              </div>

              {pathMode === 'tap' ? (
                <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-900">
                    <MapPin className="w-4 h-4 text-orange-600" />
                    <span>Tap on Satellite Map</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Zoom into the satellite map and tap consecutive points along the gali to draw the exact path around corners, walls, and narrow turns.
                  </p>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleUndoPoint}
                      disabled={path.length === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-40 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Undo Point
                    </button>
                    <button
                      onClick={handleClearPath}
                      disabled={path.length === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 disabled:opacity-40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Path
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <Footprints className="w-4 h-4 text-emerald-600" />
                    <span>Walk-and-Record Mode (Best Feature)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Walk from the landmark to the house holding your phone. The app automatically records the GPS trail. Perfect for unregistered alleys with zero road data!
                  </p>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => setIsRecordingWalk(prev => !prev)}
                      className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors ${
                        isRecordingWalk
                          ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Footprints className="w-4 h-4" />
                      {isRecordingWalk ? 'Stop Recording Trail' : 'Start Recording GPS Trail'}
                    </button>

                    <button
                      type="button"
                      onClick={handleSimulateWalkStep}
                      className="w-full py-2 px-3 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-[11px] font-semibold text-emerald-800 transition-colors"
                    >
                      + Simulate 15m Walk Step (Desktop/Testing)
                    </button>
                  </div>
                </div>
              )}

              {/* Path metrics */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Points Recorded</span>
                  <span className="text-base font-bold text-slate-800 tabular-nums">{path.length}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Distance</span>
                  <span className="text-base font-bold text-orange-600 tabular-nums">{formatDistance(distanceMeters)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Est. Walk Time</span>
                  <span className="text-base font-bold text-emerald-600 tabular-nums">{walkMinutes} min</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Add Turn Markers & Photos */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {lang === 'hi' ? 'मोड़ और लैंडमार्क जोड़ें' : 'Step 5: Add Turn Markers'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Photo, turn directions, warnings & parking
                  </p>
                </div>

                <button
                  onClick={() => setShowAddMarkerModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Marker
                </button>
              </div>

              <p className="text-xs text-slate-600">
                Tap anywhere along the route on the map or tap <strong>Add Marker</strong> to drop a photo of a gate, a turn instruction, or a dead-end warning.
              </p>

              {/* Markers List */}
              <div className="space-y-2.5">
                {markers.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                    <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600">No turn markers yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Add a photo of a blue gate, kirana store, or a warning
                    </p>
                  </div>
                ) : (
                  markers.map((marker, i) => (
                    <div
                      key={marker.id}
                      onClick={() => setSelectedMarkerId(marker.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        selectedMarkerId === marker.id
                          ? 'border-orange-500 bg-orange-50/40 ring-1 ring-orange-500'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {marker.photoUrl ? (
                        <img
                          src={marker.photoUrl}
                          alt={marker.title}
                          className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                          {marker.type === 'warning' ? (
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                          ) : marker.type === 'parking' ? (
                            <ParkingSquare className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <CornerDownRight className="w-5 h-5 text-orange-600" />
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                            {marker.badge || `Turn #${i + 1}`}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{marker.title}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{marker.description}</p>
                      </div>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteMarker(marker.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete marker"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Destination & Finish */}
          {activeStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'hi' ? 'मंज़िल (घर / दुकान / फ्लैट)' : 'Step 6: Mark Exact Destination'}
                </h3>
                <p className="text-xs text-slate-500">
                  Pin the exact door, floor and flat number
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Destination Name / House Title *
                </label>
                <input
                  type="text"
                  value={destination.name}
                  onChange={e => setDestination(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Sharma Niwas, Haveli 412"
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Floor, Flat or Door Details
                </label>
                <input
                  type="text"
                  value={destination.flatFloor}
                  onChange={e => setDestination(prev => ({ ...prev, flatFloor: e.target.value }))}
                  placeholder="e.g. 2nd Floor, Doorbell on Left with brass plate"
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Important Notes for Visitors / Couriers
                </label>
                <textarea
                  rows={2}
                  value={destination.notes}
                  onChange={e => setDestination(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Do not enter from main market gali after 8 PM; cars park outside."
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="parking-check"
                    checked={destination.parkingAvailable}
                    onChange={e => setDestination(prev => ({ ...prev, parkingAvailable: e.target.checked }))}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="parking-check" className="text-xs font-bold text-indigo-950">
                    Parking Available Nearby
                  </label>
                </div>
                {destination.parkingAvailable && (
                  <input
                    type="text"
                    value={destination.parkingInstructions || ''}
                    onChange={e => setDestination(prev => ({ ...prev, parkingInstructions: e.target.value }))}
                    placeholder="e.g. Scooter parking inside blue gate, cars at Metro MCD lot"
                    className="w-full text-xs bg-white border border-indigo-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation CTA */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-3">
          {activeStep > 1 && (
            <button
              onClick={() => setActiveStep(prev => prev - 1)}
              className="py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
            >
              Previous
            </button>
          )}

          {activeStep < 4 ? (
            <button
              onClick={() => setActiveStep(prev => prev + 1)}
              className="flex-1 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md transition-colors text-center"
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={handleFinalPublish}
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Publishing Route...' : 'Step 7: Publish & Generate Link'}
            </button>
          )}
        </div>
      </div>

      {/* Right / Bottom Live Map Viewport */}
      <div className="flex-1 h-[50vh] lg:h-full relative">
        <GaliMap
          route={previewRoute}
          mapLayer={mapLayer}
          mapEngine={mapEngine}
          googleMapsApiKey={googleMapsApiKey}
          onMapClick={handleMapClick}
          onMarkerClick={marker => setSelectedMarkerId(marker.id)}
          interactiveMode={activeStep === 2 ? 'draw' : 'view'}
          activeMarkerId={selectedMarkerId}
          className="h-full w-full"
        />

        {/* Floating Instruction Banner over Map */}
        <div className="absolute top-4 left-4 right-4 lg:right-auto lg:max-w-md z-30 pointer-events-none">
          <div className="bg-slate-900/90 text-white backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-lg border border-slate-700/60 flex items-center gap-2.5 pointer-events-auto">
            <Info className="w-4 h-4 text-orange-400 shrink-0" />
            <p className="text-xs">
              {activeStep === 1 && 'Tap on map to place the Starting Landmark pin.'}
              {activeStep === 2 && pathMode === 'tap' && 'Tap points along the gali to draw the exact path.'}
              {activeStep === 2 && pathMode === 'walk' && 'Tap "Start Recording GPS Trail" and walk the route.'}
              {activeStep === 3 && 'Tap anywhere on the path to add a photo or turn landmark.'}
              {activeStep === 4 && 'Tap on map to lock the exact Destination door / gate.'}
            </p>
          </div>
        </div>
      </div>

      {/* Add Landmark Modal */}
      {showAddMarkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Add Landmark / Turn Marker</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Marker Type</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { type: 'turn', label: 'Turn' },
                    { type: 'photo_landmark', label: 'Photo' },
                    { type: 'warning', label: 'Warning' },
                    { type: 'parking', label: 'Parking' },
                  ].map(item => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => {
                        setNewMarkerType(item.type as MarkerType);
                        if (item.type === 'warning') setNewMarkerBadge('Warning');
                        else if (item.type === 'parking') setNewMarkerBadge('Parking');
                        else if (item.type === 'turn') setNewMarkerBadge('Take Left');
                        else setNewMarkerBadge('Blue Gate');
                      }}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        newMarkerType === item.type
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Badge Text</label>
                <input
                  type="text"
                  value={newMarkerBadge}
                  onChange={e => setNewMarkerBadge(e.target.value)}
                  placeholder="e.g. Take Left, Blue Gate, No 4-Wheelers"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newMarkerTitle}
                  onChange={e => setNewMarkerTitle(e.target.value)}
                  placeholder="e.g. Turn Left after Gupta Kirana"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Instruction</label>
                <textarea
                  rows={2}
                  value={newMarkerDesc}
                  onChange={e => setNewMarkerDesc(e.target.value)}
                  placeholder="e.g. Look for the red awning. The lane looks narrow but leads to haveli."
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 resize-none"
                />
              </div>

              {/* Photo Landmark Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Photo Landmark</label>
                {newMarkerPhoto ? (
                  <div className="relative mb-2">
                    <img src={newMarkerPhoto} alt="Landmark" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => setNewMarkerPhoto('')}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/80 text-white text-[10px]"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-500">Pick a preset or enter photo URL:</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PRESET_PHOTOS.map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setNewMarkerPhoto(p.url)}
                          className="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 hover:border-orange-400 text-left text-[11px] text-slate-700"
                        >
                          <img src={p.url} alt={p.label} className="w-6 h-6 rounded object-cover" />
                          <span className="truncate">{p.label}</span>
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={newMarkerPhoto}
                      onChange={e => setNewMarkerPhoto(e.target.value)}
                      placeholder="Or paste photo image URL..."
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-1.5 mt-1"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMarkerModal(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMarker}
                  disabled={!newMarkerTitle}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  Save Marker
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

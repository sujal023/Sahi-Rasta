import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  Compass,
  Eye,
  Footprints,
  Home,
  MapPin,
  Navigation,
  Plus,
  QrCode,
  Share2,
  Stethoscope,
  Trash2,
  Truck,
  Trees,
  User,
  LogOut
} from 'lucide-react';
import { GaliRoute, HostUser } from '../types/route';
import { formatDistance, formatWalkTime } from '../utils/geo';
import { QRCodeModal } from './QRCodeModal';

interface HostDashboardProps {
  routes: GaliRoute[];
  currentUser: HostUser | null;
  onSelectRouteForNav: (route: GaliRoute) => void;
  onEditRoute: (route: GaliRoute) => void;
  onCreateRoute: () => void;
  onDeleteRoute: (routeId: string) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  lang?: 'en' | 'hi';
}

export const HostDashboard: React.FC<HostDashboardProps> = ({
  routes,
  currentUser,
  onSelectRouteForNav,
  onEditRoute,
  onCreateRoute,
  onDeleteRoute,
  onOpenAuth,
  onLogout,
  lang = 'en',
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedShareRoute, setSelectedShareRoute] = useState<GaliRoute | null>(null);

  const categories = [
    { id: 'all', label: lang === 'hi' ? 'सभी रास्ते' : 'All Routes', icon: Compass },
    { id: 'home', label: lang === 'hi' ? 'घर / रिश्तेदार' : 'Home / Guests', icon: Home },
    { id: 'delivery', label: lang === 'hi' ? 'डिलीवरी' : 'Delivery & Courier', icon: Truck },
    { id: 'clinic', label: lang === 'hi' ? 'क्लीनिक' : 'Clinics & Shops', icon: Stethoscope },
    { id: 'event', label: lang === 'hi' ? 'विवाह व इवेंट' : 'Weddings & Events', icon: Calendar },
    { id: 'farmhouse', label: lang === 'hi' ? 'फार्महाउस' : 'Farmhouses & Rural', icon: Trees },
  ];

  const filteredRoutes = routes.filter(r => {
    if (filterCategory === 'all') return true;
    return r.category === filterCategory;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Hero / Host Overview Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white p-6 sm:p-8 shadow-xl overflow-hidden">
        {/* Subtle decorative background pattern */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 text-orange-100 text-xs font-semibold backdrop-blur-xs">
              <Compass className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'गली और संकरी गलियों का सटीक रास्ता' : 'India\'s Last-Mile Gali Navigator'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {lang === 'hi'
                ? 'गूगल मैप्स नहीं, आप बनाएं सही रास्ता।'
                : 'Google Maps picks the wrong gali. You know the right path.'}
            </h1>
            <p className="text-sm text-orange-100 leading-relaxed">
              {lang === 'hi'
                ? 'एक बार रास्ता खींचें या चलकर रिकॉर्ड करें। कोई भी लिंक खोलकर सटीक नीले बिंदु के साथ पहुँच सकता है।'
                : 'Draw the path once or walk with your phone. Anyone can follow with real-time GPS and off-route alerts without installing an app.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={onCreateRoute}
              className="py-3 px-5 rounded-2xl bg-white text-orange-700 hover:bg-orange-50 font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            >
              <Plus className="w-5 h-5 text-orange-600" />
              {lang === 'hi' ? 'नया रास्ता बनाएं' : 'Create Gali Route'}
            </button>

            {!currentUser ? (
              <button
                onClick={onOpenAuth}
                className="py-3 px-4 rounded-2xl bg-black/30 hover:bg-black/40 text-white font-semibold text-sm border border-white/20 backdrop-blur-xs flex items-center justify-center gap-2 transition-colors"
              >
                <User className="w-4 h-4" />
                {lang === 'hi' ? 'मेज़बान साइन इन' : 'Host Sign In (OTP)'}
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded-2xl border border-white/20 text-xs">
                <span className="font-semibold text-white">{currentUser.name}</span>
                <button
                  onClick={onLogout}
                  className="p-1 rounded text-orange-200 hover:text-white"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map(cat => {
          const Icon = cat.icon;
          const isActive = filterCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Routes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRoutes.map(route => {
          const walkTime = formatWalkTime(route.distanceMeters);
          const distanceStr = formatDistance(route.distanceMeters);
          const photoCount = route.markers.filter(m => m.photoUrl).length;

          return (
            <div
              key={route.id}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                      {route.category.toUpperCase()}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-1">
                      {route.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => setSelectedShareRoute(route)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-orange-50 text-slate-600 hover:text-orange-600 transition-colors border border-slate-200"
                    title="Share & QR Code"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Starting Landmark */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{route.startLandmark.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1 pl-5">
                    {route.startLandmark.description}
                  </p>
                </div>

                {/* Destination info */}
                <div className="text-xs text-slate-600 flex items-center justify-between">
                  <span className="font-semibold text-slate-800 line-clamp-1 max-w-[200px]">
                    📍 {route.destination.name}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {route.destination.flatFloor}
                  </span>
                </div>

                {/* Metadata badges row */}
                <div className="flex items-center gap-3 text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <span className="font-bold text-orange-600 tabular-nums">{distanceStr}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{walkTime}</span>
                  <span aria-hidden="true">·</span>
                  <span>{photoCount} photo landmarks</span>
                </div>

                {/* Visit analytics counter */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 bg-orange-50/50 px-3 py-1.5 rounded-xl border border-orange-100">
                  <span className="flex items-center gap-1 font-medium text-orange-950">
                    <Eye className="w-3.5 h-3.5 text-orange-600" />
                    <span>Visits:</span>
                  </span>
                  <span className="font-bold text-orange-700 tabular-nums">
                    {route.visitsCount} visitors opened link
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => onSelectRouteForNav(route)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs active:scale-[0.99]"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  {lang === 'hi' ? 'नेविगेट करें' : 'Follow Route'}
                </button>

                <button
                  onClick={() => onEditRoute(route)}
                  className="py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
                >
                  Edit
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Delete route "${route.title}"?`)) {
                      onDeleteRoute(route.id);
                    }
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                  title="Delete Route"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredRoutes.length === 0 && (
        <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 p-8 space-y-3">
          <Footprints className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No routes found in this category</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Draw the first path for your home, clinic, or delivery partner now.
          </p>
          <button
            onClick={onCreateRoute}
            className="py-2.5 px-4 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors"
          >
            Create New Route
          </button>
        </div>
      )}

      {/* Share / QR Modal */}
      {selectedShareRoute && (
        <QRCodeModal
          route={selectedShareRoute}
          isOpen={true}
          onClose={() => setSelectedShareRoute(null)}
          lang={lang}
        />
      )}
    </div>
  );
};

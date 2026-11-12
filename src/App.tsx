import React, { useState, useEffect } from 'react';
import {
  Compass,
  Footprints,
  Globe,
  Plus,
  User,
  WifiOff,
  Sparkles,
  MapPin
} from 'lucide-react';
import { GaliRoute, HostUser } from './types/route';
import { fetchAllRoutes, getCurrentUser, logoutUser, deleteRouteApi, fetchGoogleMapsApiKey } from './utils/api';
import { HostDashboard } from './components/HostDashboard';
import { HostRouteEditor } from './components/HostRouteEditor';
import { VisitorNavigator } from './components/VisitorNavigator';
import { AuthModal } from './components/AuthModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { useOnlineStatus } from './utils/usePWAInstall';

export default function App() {
  const [routes, setRoutes] = useState<GaliRoute[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'editor' | 'navigator'>('dashboard');
  const [selectedRoute, setSelectedRoute] = useState<GaliRoute | null>(null);
  const [currentUser, setCurrentUser] = useState<HostUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [editingRoute, setEditingRoute] = useState<GaliRoute | null>(null);
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  const isOnline = useOnlineStatus();

  // Load routes, Google Maps key & user session
  useEffect(() => {
    setCurrentUser(getCurrentUser());
    loadRoutes();

    fetchGoogleMapsApiKey().then(key => {
      if (key) setGoogleMapsApiKey(key);
    });

    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);

    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuota);
    };
  }, []);

  useEffect(() => {
    // Check URL parameters for direct visitor link (e.g. ?route=sharma-ji-ka-ghar)
    const params = new URLSearchParams(window.location.search);
    const routeParam = params.get('route');
    if (routeParam) {
      fetchAllRoutes().then(allRoutes => {
        const target = allRoutes.find(r => r.slug === routeParam || r.id === routeParam);
        if (target) {
          setSelectedRoute(target);
          setCurrentView('navigator');
        }
      });
    }
  }, []);

  const loadRoutes = async () => {
    const data = await fetchAllRoutes();
    setRoutes(data);
  };

  const handleStartCreateRoute = () => {
    setEditingRoute(null);
    setCurrentView('editor');
  };

  const handleStartEditRoute = (route: GaliRoute) => {
    setEditingRoute(route);
    setCurrentView('editor');
  };

  const handleRouteSaved = (saved: GaliRoute) => {
    loadRoutes();
    setSelectedRoute(saved);
    setCurrentView('navigator');
  };

  const handleDeleteRoute = async (routeId: string) => {
    await deleteRouteApi(routeId);
    setRoutes(prev => prev.filter(r => r.id !== routeId));
  };

  const handleSelectRouteForNav = (route: GaliRoute) => {
    setSelectedRoute(route);
    setCurrentView('navigator');
  };

  const handleAuthSuccess = (user: HostUser) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Google Maps Quota Notice (Case A Demo Key) */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Offline Toast Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="w-4 h-4 animate-pulse" />
          <span>Offline Mode — All cached routes and photo landmarks remain available.</span>
        </div>
      )}

      {/* TOP NAVIGATION BAR: Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-8 h-16">
        {/* Zone 1: Single Text Element Brand Wordmark */}
        <button
          onClick={() => {
            setCurrentView('dashboard');
            setSelectedRoute(null);
          }}
          className="flex items-center gap-2 whitespace-nowrap shrink-0 group text-left focus:outline-none"
        >
          <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-600/20 group-hover:scale-105 transition-transform">
            <Footprints className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 group-hover:text-orange-600 transition-colors">
              Gali Guide
            </span>
            <span className="hidden sm:inline-block text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.2 rounded ml-1.5">
              INDIA
            </span>
          </div>
        </button>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              currentView === 'dashboard' ? 'text-orange-600 font-bold' : ''
            }`}
          >
            {lang === 'hi' ? 'सभी रास्ते' : 'All Routes'}
          </button>

          <button
            onClick={handleStartCreateRoute}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              currentView === 'editor' ? 'text-orange-600 font-bold' : ''
            }`}
          >
            {lang === 'hi' ? 'रास्ता बनाएं' : 'Draw Route'}
          </button>

          {/* Bilingual Switch */}
          <button
            onClick={() => setLang(prev => (prev === 'en' ? 'hi' : 'en'))}
            className="flex items-center gap-1 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 px-2 rounded-lg bg-slate-100 text-slate-700"
          >
            <Globe className="w-3.5 h-3.5 text-orange-600" />
            <span>{lang === 'en' ? 'English (EN)' : 'हिन्दी (HI)'}</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <PWAInstallButton />

          {currentView !== 'editor' ? (
            <button
              onClick={handleStartCreateRoute}
              className="px-3.5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'नया रास्ता' : 'Create Route'}</span>
            </button>
          ) : (
            <button
              onClick={() => setCurrentView('dashboard')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
          )}

          {/* Language toggle for mobile */}
          <button
            onClick={() => setLang(prev => (prev === 'en' ? 'hi' : 'en'))}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
            title="Switch Language"
          >
            <Globe className="w-4 h-4 text-orange-600" />
          </button>
        </div>
      </header>

      {/* MAIN VIEW CONTROLLER */}
      <main className="flex-1 flex flex-col">
        {currentView === 'dashboard' && (
          <HostDashboard
            routes={routes}
            currentUser={currentUser}
            onSelectRouteForNav={handleSelectRouteForNav}
            onEditRoute={handleStartEditRoute}
            onCreateRoute={handleStartCreateRoute}
            onDeleteRoute={handleDeleteRoute}
            onOpenAuth={() => setShowAuthModal(true)}
            onLogout={handleLogout}
            lang={lang}
          />
        )}

        {currentView === 'editor' && (
          <HostRouteEditor
            initialRoute={editingRoute}
            onCancel={() => setCurrentView('dashboard')}
            onSaved={handleRouteSaved}
            lang={lang}
            googleMapsApiKey={googleMapsApiKey}
          />
        )}

        {currentView === 'navigator' && selectedRoute && (
          <VisitorNavigator
            route={selectedRoute}
            onBackToHost={() => setCurrentView('dashboard')}
            lang={lang}
            googleMapsApiKey={googleMapsApiKey}
          />
        )}
      </main>

      {/* Phone OTP Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        lang={lang}
      />
    </div>
  );
}

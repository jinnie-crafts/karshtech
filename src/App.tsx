import React, { useEffect } from 'react';
import Lenis from 'lenis';
import { AuthProvider } from './context/AuthContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CustomCursor } from './components/CustomCursor';

// Public Pages
import { HomePage } from './pages/HomePage';
import { GamesPage } from './pages/GamesPage';
import { GameDetailPage } from './pages/GameDetailPage';
import { StudioPage } from './pages/StudioPage';
import { SupportPage } from './pages/SupportPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Admin Pages
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminGamesPage } from './pages/admin/AdminGamesPage';
import { AdminReleasesPage } from './pages/admin/AdminReleasesPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

const AppContent: React.FC = () => {
  const { path } = useRouter();

  // Smooth scrolling initialization via Lenis (matching reference portfolio)
  useEffect(() => {
    // Only enable smooth scrolling on desktop and if user doesn't prefer reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || window.innerWidth < 768) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const animId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animId);
      lenis.destroy();
    };
  }, []);

  // Admin routing check
  if (path === '/admin/login') {
    return <AdminLoginPage />;
  }
  if (path === '/admin') {
    return <AdminDashboardPage />;
  }
  if (path === '/admin/games') {
    return <AdminGamesPage />;
  }
  if (path === '/admin/releases') {
    return <AdminReleasesPage />;
  }
  if (path === '/admin/settings') {
    return <AdminSettingsPage />;
  }

  // Public routing
  const renderPublicPage = () => {
    const normalized = path.replace(/\/+$/, '') || '/';

    if (normalized === '/' || normalized === '/index.html') {
      return <HomePage />;
    }
    if (normalized === '/games') {
      return <GamesPage />;
    }
    if (normalized.startsWith('/games/')) {
      return <GameDetailPage />;
    }
    if (normalized === '/studio' || normalized === '/about') {
      return <StudioPage />;
    }
    if (normalized === '/support' || normalized === '/contact') {
      return <SupportPage />;
    }
    if (normalized === '/privacy') {
      return <PrivacyPage />;
    }
    if (normalized === '/terms') {
      return <TermsPage />;
    }

    return <NotFoundPage />;
  };

  return (
    <div className="w-full min-h-screen bg-[#07090E] text-[#E4E7EC] flex flex-col selection:bg-violet-600/30 selection:text-cyan-300">
      <CustomCursor />
      <Navbar />
      <main className="flex-1">{renderPublicPage()}</main>
      <Footer />
    </div>
  );
};

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </RouterProvider>
  );
}

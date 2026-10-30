import React, { useState } from 'react';
import { useRouter, Link } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Gamepad2,
  UploadCloud,
  Settings,
  LogOut,
  ExternalLink,
  Shield,
  Menu,
  X,
  Plus,
  Package,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  onNewGame?: () => void;
  onNewRelease?: () => void;
  onNewProduct?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  title,
  onNewGame,
  onNewRelease,
  onNewProduct,
}) => {
  const { path, navigate } = useRouter();
  const { user, loading, logout } = useAuth();
  const [mobileSidebar, setMobileSidebar] = useState(false);

  // Auth Guard
  if (!loading && !user) {
    if (typeof window !== 'undefined') {
      navigate('/admin/login');
    }
    return null;
  }

  const menuItems = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Products', href: '/admin/products', icon: Package },
    { label: 'Game Catalog', href: '/admin/games', icon: Gamepad2 },
    { label: 'Releases & APKs', href: '/admin/releases', icon: UploadCloud },
    { label: 'Studio Settings', href: '/admin/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const isActive = (href: string) => {
    if (href === '/admin') return path === '/admin';
    return path.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-[#101014] text-[#C2BEC1] flex font-sans">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col justify-between w-64 bg-[#1A191F] border-r border-[#39363A] p-6 flex-shrink-0">
        <div className="space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-3 px-1">
            <img src="/brand/karsh-tech-k.png" alt="Karsh Tech Logo" className="w-7 h-7 object-contain" />
            <div>
              <div className="font-display font-bold text-base tracking-wider uppercase text-[#F4F0E8]">
                KARSH <span className="text-[#FF5A36]">TECH</span>
              </div>
              <div className="text-[9px] uppercase tracking-[0.2em] font-semibold text-[#96929A]">
                STUDIO &amp; CONSOLE
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded text-xs uppercase tracking-wider font-semibold transition-all ${
                    active
                      ? 'bg-[#242329] text-[#FF5A36] border-l-2 border-[#FF5A36]'
                      : 'text-[#96929A] hover:text-[#F4F0E8] hover:bg-[#242329]/50 border-l-2 border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-[#FF5A36]' : 'text-[#96929A]'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-6 border-t border-[#39363A] space-y-1">
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 text-xs uppercase tracking-wider font-semibold text-[#96929A] hover:text-[#F4F0E8] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#FF5A36]" />
            <span>Public Website</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs uppercase tracking-wider font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 px-6 sm:px-8 border-b border-[#39363A] bg-[#1A191F]/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebar(!mobileSidebar)}
              className="lg:hidden p-2 rounded border border-[#39363A] bg-[#242329] text-[#F4F0E8]"
            >
              {mobileSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-[#F4F0E8] uppercase">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {onNewProduct && (
              <button
                onClick={onNewProduct}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Product</span>
              </button>
            )}

            {onNewGame && (
              <button
                onClick={onNewGame}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Game</span>
              </button>
            )}

            {onNewRelease && (
              <button
                onClick={onNewRelease}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded border border-[#39363A] bg-[#242329] hover:border-[#FF5A36] text-[#F4F0E8] text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5 text-[#FF5A36]" />
                <span>Upload APK</span>
              </button>
            )}

            <div className="flex items-center gap-2 pl-3 border-l border-[#39363A] text-xs font-mono-code text-[#96929A]">
              <div className="w-7 h-7 rounded-full bg-[#242329] text-[#FF5A36] border border-[#39363A] flex items-center justify-center font-bold">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <span className="hidden md:inline uppercase text-xs font-bold text-[#F4F0E8]">{user?.username || 'khrgosh'}</span>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Dropdown */}
        {mobileSidebar && (
          <div className="lg:hidden bg-[#1A191F] border-b border-[#39363A] p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileSidebar(false)}
                  className="flex items-center gap-3 px-3 py-2 text-xs uppercase tracking-wider font-semibold text-[#96929A] hover:text-[#F4F0E8] hover:bg-[#242329] rounded"
                >
                  <Icon className="w-4 h-4 text-[#FF5A36]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t border-[#39363A] flex items-center justify-between">
              <Link href="/" className="text-xs uppercase tracking-wider text-[#FF5A36] font-semibold">
                Public Site →
              </Link>
              <button onClick={handleLogout} className="text-xs uppercase tracking-wider text-red-400 font-semibold">
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Page Content Body */}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto bg-[#101014]">
          {children}
        </main>
      </div>
    </div>
  );
};

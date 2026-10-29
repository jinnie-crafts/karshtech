import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, Link } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { Menu, X, Shield, Lock, Gamepad2 } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { path } = useRouter();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'CATALOG', href: '/games' },
    { label: 'STUDIO', href: '/studio' },
    { label: 'SUPPORT', href: '/support' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return path === '/';
    return path.startsWith(href);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 font-sans ${
        scrolled
          ? 'bg-[#101014]/95 backdrop-blur-md border-b border-[#39363A] py-3.5 shadow-xl'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex items-center justify-between">
        {/* Brand Logo & Wordmark */}
        <Link href="/" className="group flex items-center space-x-3 z-20" title="Karsh Tech Home">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <img
              src="/logo.svg"
              alt="Karsh Tech Logo"
              className="w-8 h-8 object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-base font-bold tracking-[0.14em] uppercase text-[#F4F0E8] group-hover:text-[#FF5A36] transition-colors">
              KARSH <span className="text-[#FF5A36]">TECH</span>
            </span>
            <span className="text-[9px] font-semibold tracking-[0.22em] uppercase text-[#96929A] -mt-1">
              GAME PUBLISHER
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links (Editorial Minimalist) */}
        <nav className="hidden md:flex items-center space-x-8 text-xs tracking-[0.16em] font-semibold uppercase text-[#C2BEC1]">
          {navLinks.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`relative py-1 transition-colors duration-200 flex items-center gap-1.5 ${
                  active ? 'text-[#F4F0E8]' : 'hover:text-[#F4F0E8]'
                }`}
              >
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A36] animate-pulse" />
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Action Buttons */}
        <div className="hidden md:flex items-center space-x-3 z-20">
          <Link
            href="/games/arrow-puzzle"
            className="flex items-center space-x-2 text-xs tracking-[0.14em] font-bold uppercase py-2 px-3.5 rounded bg-[#1A191F] border border-[#39363A] hover:border-[#FF5A36] text-[#F4F0E8] hover:text-[#FF5A36] transition-all duration-200"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-[#FF5A36]" />
            <span>PLAY ARROW PUZZLE</span>
          </Link>

          {user ? (
            <Link
              href="/admin"
              className="flex items-center space-x-1.5 text-xs tracking-[0.14em] font-bold uppercase py-2 px-3.5 rounded bg-[#FF5A36] text-[#101014] hover:bg-[#FF7454] transition-all duration-200 shadow-md shadow-[#FF5A36]/20"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>CONSOLE</span>
            </Link>
          ) : (
            <Link
              href="/admin/login"
              className="flex items-center space-x-1 text-xs tracking-[0.14em] font-medium uppercase py-2 px-2.5 text-[#96929A] hover:text-[#F4F0E8] transition-colors"
              title="Studio Portal Sign In"
            >
              <Lock className="w-3 h-3 text-[#96929A]" />
              <span>PORTAL</span>
            </Link>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded border border-[#39363A] bg-[#1A191F] text-[#F4F0E8] hover:border-[#FF5A36]"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden bg-[#101014]/98 border-b border-[#39363A] px-6 py-6 overflow-hidden shadow-2xl"
          >
            <div className="flex flex-col space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`text-xs tracking-[0.16em] uppercase py-2.5 border-b border-[#39363A]/40 flex items-center justify-between ${
                    isActive(link.href) ? 'text-[#FF5A36] font-bold' : 'text-[#C2BEC1]'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive(link.href) && <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A36]" />}
                </Link>
              ))}

              <div className="pt-3 flex flex-col space-y-2.5">
                <Link
                  href="/games/arrow-puzzle"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center space-x-2 py-3 rounded border border-[#39363A] bg-[#1A191F] text-[#F4F0E8] hover:border-[#FF5A36] text-xs tracking-[0.14em] font-bold uppercase"
                >
                  <Gamepad2 className="w-4 h-4 text-[#FF5A36]" />
                  <span>PLAY ARROW PUZZLE</span>
                </Link>

                {user ? (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center space-x-2 py-3 rounded bg-[#FF5A36] text-[#101014] font-bold text-xs tracking-[0.14em] uppercase"
                  >
                    <Shield className="w-4 h-4" />
                    <span>ADMIN CONSOLE</span>
                  </Link>
                ) : (
                  <Link
                    href="/admin/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center space-x-2 py-2 text-[#96929A] hover:text-[#F4F0E8] text-xs tracking-[0.14em] uppercase"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>STUDIO LOGIN</span>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

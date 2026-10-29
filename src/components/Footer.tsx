import React from 'react';
import { Link } from '../context/RouterContext';
import { ShieldCheck, Mail, ArrowUpRight } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="relative bg-[#101014] border-t border-[#39363A] text-[#96929A] text-xs pt-16 pb-12 font-sans">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-14">
          {/* Studio Brand & Mission */}
          <div className="md:col-span-1 space-y-4">
            <Link href="/" className="flex items-center space-x-3">
              <img src="/logo.svg" alt="Karsh Tech Logo" className="w-8 h-8 object-contain" />
              <div className="flex flex-col">
                <span className="font-display font-bold text-base tracking-[0.14em] uppercase text-[#F4F0E8]">
                  KARSH <span className="text-[#FF5A36]">TECH</span>
                </span>
                <span className="text-[9px] font-semibold tracking-[0.22em] uppercase text-[#96929A] -mt-1">
                  GAME PUBLISHER
                </span>
              </div>
            </Link>
            <p className="text-xs text-[#C2BEC1] leading-relaxed">
              An independent studio and publisher engineering tactile, spatial, and mindful gaming experiences.
              Directly distributing cryptographically signed production builds for Android.
            </p>
            <div className="flex items-center space-x-2 text-[10px] tracking-[0.14em] uppercase text-[#FF5A36] border border-[#39363A] bg-[#1A191F] px-3 py-1.5 w-fit rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A36] animate-pulse" />
              <span>PUBLISHING NETWORK ONLINE</span>
            </div>
          </div>

          {/* Games Library */}
          <div className="space-y-3.5">
            <div className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              GAMES CATALOG
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/games/arrow-puzzle"
                  className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 group text-[#C2BEC1]"
                >
                  <span className="text-[#FF5A36]">›</span>
                  <span>Arrow Puzzle (Latest Release)</span>
                  <ArrowUpRight className="w-3 h-3 text-[#96929A] group-hover:text-[#FF5A36] transition-colors" />
                </Link>
              </li>
              <li>
                <Link href="/games" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>All Studio Titles</span>
                </Link>
              </li>
              <li>
                <Link href="/games" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>Release Pipeline</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Studio & Support */}
          <div className="space-y-3.5">
            <div className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              STUDIO &amp; SUPPORT
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/studio" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>About Karsh Tech</span>
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>Direct Support &amp; Feedback</span>
                </Link>
              </li>
              <li>
                <Link href="/support#faq" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>APK Installation FAQ</span>
                </Link>
              </li>
              <li>
                <a
                  href="mailto:contact@karshtech.com"
                  className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-2 text-[#C2BEC1]"
                >
                  <Mail className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>contact@karshtech.com</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Trust */}
          <div className="space-y-3.5">
            <div className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              LEGAL &amp; VERIFICATION
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/privacy" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>Privacy Policy</span>
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>Terms of Service</span>
                </Link>
              </li>
              <li className="pt-2">
                <div className="p-3 border border-[#39363A] bg-[#1A191F] rounded flex items-center space-x-2.5 text-[11px] text-[#C2BEC1]">
                  <ShieldCheck className="w-4 h-4 text-[#FF5A36] flex-shrink-0" />
                  <span>Verified production binaries with integrity hash</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-[#39363A] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#96929A] tracking-wider uppercase">
          <p>© {new Date().getFullYear()} Karsh Tech. Independent Game Publisher.</p>
          <div className="flex items-center space-x-6">
            <span>CRAFTED FOR MINDFUL PLAYERS</span>
            <Link href="/admin/login" className="hover:text-[#FF5A36] transition-colors">
              STUDIO PORTAL
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

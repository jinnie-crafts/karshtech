import React from 'react';
import { Link } from '../context/RouterContext';
import { Mail, ArrowUpRight, Code2 } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="relative bg-[#101014] border-t border-[#39363A] text-[#96929A] text-xs pt-16 pb-12 font-sans">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-14">
          {/* Brand & Mission */}
          <div className="md:col-span-1 space-y-4">
            <Link href="/" className="flex items-center space-x-3">
              <img src="/brand/karsh-tech-k.png" alt="Karsh Tech Logo" className="w-8 h-8 object-contain" />
              <div className="flex flex-col">
                <span className="font-display font-bold text-base tracking-[0.14em] uppercase text-[#F4F0E8]">
                  KARSH <span className="text-[#FF5A36]">TECH</span>
                </span>
                <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-[#96929A] -mt-1">
                  DIGITAL ENGINEERING
                </span>
              </div>
            </Link>
            <p className="text-xs text-[#C2BEC1] leading-relaxed">
              An independent technology and digital product development organization.
              We build purposeful websites, web applications, mobile applications, games, and custom software through thoughtful engineering.
            </p>
            <div className="flex items-center space-x-2 text-[10px] tracking-[0.14em] uppercase text-[#FF5A36] border border-[#39363A] bg-[#1A191F] px-3 py-1.5 w-fit rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A36] animate-pulse" />
              <span>DIGITAL LABS ACTIVE</span>
            </div>
          </div>

          {/* Services & Capabilities */}
          <div className="space-y-3.5">
            <div className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              SERVICES
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/services#websites" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#FF5A36]">›</span>
                  <span>Website Development</span>
                </Link>
              </li>
              <li>
                <Link href="/services#web-applications" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#FF5A36]">›</span>
                  <span>Web Applications &amp; Portals</span>
                </Link>
              </li>
              <li>
                <Link href="/services#mobile-applications" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#FF5A36]">›</span>
                  <span>Mobile Applications &amp; Android</span>
                </Link>
              </li>
              <li>
                <Link href="/services#games" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#FF5A36]">›</span>
                  <span>Game Engineering</span>
                </Link>
              </li>
              <li>
                <Link href="/services#custom-software" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#FF5A36]">›</span>
                  <span>Custom Software Solutions</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Products & Catalog */}
          <div className="space-y-3.5">
            <div className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              PRODUCTS &amp; WORK
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/products" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 group text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>Products Catalog</span>
                  <ArrowUpRight className="w-3 h-3 text-[#96929A] group-hover:text-[#FF5A36] transition-colors" />
                </Link>
              </li>
              <li>
                <Link href="/games/arrow-puzzle" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>Arrow Puzzle (Android Game)</span>
                </Link>
              </li>
              <li>
                <Link href="/games" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>Games Catalog</span>
                </Link>
              </li>
              <li className="pt-2">
                <Link
                  href="/contact"
                  className="p-3 border border-[#39363A] bg-[#1A191F] rounded flex items-center space-x-2.5 text-[11px] text-[#C2BEC1] hover:border-[#FF5A36] transition-colors"
                >
                  <Code2 className="w-4 h-4 text-[#FF5A36] flex-shrink-0" />
                  <span>Request a Custom Build</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Support */}
          <div className="space-y-3.5">
            <div className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              COMPANY &amp; CONTACT
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/studio" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>About Karsh Tech</span>
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>Discuss a Project</span>
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-1.5 text-[#C2BEC1]">
                  <span className="text-[#96929A]">•</span>
                  <span>Support &amp; FAQ</span>
                </Link>
              </li>
              <li>
                <a
                  href="mailto:karshhtech@gmail.com"
                  className="hover:text-[#F4F0E8] transition-colors flex items-center space-x-2 text-[#C2BEC1]"
                >
                  <Mail className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>karshhtech@gmail.com</span>
                </a>
              </li>
              <li className="pt-2 border-t border-[#39363A]/60 flex items-center space-x-4">
                <Link href="/privacy" className="hover:text-[#F4F0E8] transition-colors text-[11px] text-[#96929A]">
                  Privacy Policy
                </Link>
                <span className="text-[#39363A]">•</span>
                <Link href="/terms" className="hover:text-[#F4F0E8] transition-colors text-[11px] text-[#96929A]">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-[#39363A] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#96929A] tracking-wider uppercase">
          <p>© {new Date().getFullYear()} Karsh Tech. Technology &amp; Digital Product Development.</p>
          <div className="flex items-center space-x-6">
            <span>PURPOSEFUL DESIGN &amp; RELIABLE ENGINEERING</span>
            <Link href="/admin/login" className="hover:text-[#FF5A36] transition-colors">
              STUDIO CONSOLE
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

import React from 'react';
import { Link } from '../context/RouterContext';
import { Compass, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen pt-32 pb-24 flex items-center justify-center px-4 bg-[#101014] text-[#C2BEC1] font-sans relative overflow-hidden">
      {/* Background ambient ember aura */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#FF5A36]/5 blur-[120px] pointer-events-none" />

      <div className="relative max-w-md w-full p-8 sm:p-10 rounded-xl bg-[#1A191F] border border-[#39363A] text-center shadow-2xl">
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-14 h-14 rounded-full border border-[#39363A] bg-[#242329] text-[#FF5A36] flex items-center justify-center mb-5">
            <Compass className="w-7 h-7 text-[#FF5A36]" />
          </div>

          <div className="inline-block px-3 py-1 mb-2.5 rounded border border-[#39363A] bg-[#101014] text-[10px] uppercase font-mono-code tracking-wider text-[#FF5A36]">
            ERROR 404 // SIGNAL LOST
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#F4F0E8] uppercase mb-2">
            PAGE NOT FOUND
          </h1>

          <p className="text-xs sm:text-sm text-[#C2BEC1] mb-7 leading-relaxed max-w-sm">
            The studio resource or catalog link you requested does not exist or has been shifted in our distribution network.
          </p>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] font-bold text-xs uppercase tracking-wider transition-colors shadow-md shadow-[#FF5A36]/20"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Studio Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

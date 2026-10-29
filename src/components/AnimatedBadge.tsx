import React from 'react';
import type { ReleaseStatus } from '../types';

interface AnimatedBadgeProps {
  status: ReleaseStatus | string;
  size?: 'sm' | 'md';
}

export const AnimatedBadge: React.FC<AnimatedBadgeProps> = ({ status, size = 'md' }) => {
  const getStyles = () => {
    switch (status) {
      case 'Available':
        return {
          bg: 'bg-[#1A191F] border-[#39363A] text-[#F4F0E8]',
          dot: 'bg-[#FF5A36]',
          pulse: 'bg-[#FF5A36]/40',
        };
      case 'Updated':
        return {
          bg: 'bg-[#242329] border-[#39363A] text-[#F4F0E8]',
          dot: 'bg-[#FF7454]',
          pulse: 'bg-[#FF7454]/40',
        };
      case 'In Beta':
        return {
          bg: 'bg-[#1A191F] border-[#39363A] text-[#C2BEC1]',
          dot: 'bg-amber-400',
          pulse: 'bg-amber-400/40',
        };
      case 'Coming Soon':
      default:
        return {
          bg: 'bg-[#101014] border-[#39363A] text-[#96929A]',
          dot: 'bg-[#96929A]',
          pulse: 'bg-[#96929A]/30',
        };
    }
  };

  const style = getStyles();
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-sans font-semibold uppercase tracking-[0.14em] ${style.bg} ${pad}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${style.pulse}`} />
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${style.dot}`} />
      </span>
      {status}
    </span>
  );
};

import React from 'react';
import type { Game } from '../types';
import { Link } from '../context/RouterContext';
import { AnimatedBadge } from './AnimatedBadge';
import { Download, Smartphone, Monitor, ArrowUpRight } from 'lucide-react';

interface GameCardProps {
  game: Game;
  index?: number;
}

export const GameCard: React.FC<GameCardProps> = ({ game }) => {
  return (
    <div className="group relative rounded-lg border border-[#39363A] bg-[#1A191F] p-5 shadow-lg hover:border-[#FF5A36]/60 hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden">
      {/* Media / Artwork Header */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded border border-[#39363A] bg-[#101014] mb-4">
        <img
          src={game.cover_image || '/uploads/images/default_cover.jpg'}
          alt={game.title}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A191F] via-transparent to-transparent opacity-75" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
          <AnimatedBadge status={game.status} size="sm" />
          {game.featured && (
            <span className="px-2 py-0.5 rounded bg-[#FF5A36] text-[#101014] text-[9.5px] font-bold tracking-[0.14em] uppercase">
              FEATURED
            </span>
          )}
        </div>

        {/* Version Indicator */}
        {game.latest_release && (
          <div className="absolute bottom-2.5 right-2.5 z-10 px-2 py-0.5 rounded bg-[#0A0A0D]/90 border border-[#39363A] text-[10px] font-mono-code text-[#F4F0E8]">
            v{game.latest_release.version_name}
          </div>
        )}
      </div>

      {/* Game Content */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Platform row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1.5">
              {game.platforms.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[9.5px] font-semibold tracking-wider uppercase text-[#96929A] border border-[#39363A] bg-[#101014]"
                >
                  {p.toLowerCase().includes('android') ? (
                    <Smartphone className="w-2.5 h-2.5 text-[#FF5A36]" />
                  ) : (
                    <Monitor className="w-2.5 h-2.5 text-[#C2BEC1]" />
                  )}
                  <span>{p}</span>
                </span>
              ))}
            </div>

            <span className="text-[10px] uppercase tracking-wider text-[#96929A] font-semibold">
              {game.developer}
            </span>
          </div>

          <h3 className="font-display text-2xl font-bold tracking-tight text-[#F4F0E8] group-hover:text-[#FF5A36] transition-colors leading-tight mb-1.5">
            {game.title}
          </h3>

          <p className="text-xs text-[#C2BEC1] line-clamp-2 leading-relaxed mb-4">
            {game.tagline || game.description}
          </p>

          {/* Genre Chips */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {game.genre.slice(0, 3).map((g) => (
              <span
                key={g}
                className="px-2 py-0.5 text-[9.5px] font-medium tracking-wider uppercase rounded border border-[#39363A]/80 bg-[#101014] text-[#96929A]"
              >
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="pt-3.5 border-t border-[#39363A] flex items-center justify-between">
          <Link
            href={`/games/${game.slug}`}
            className="text-xs font-semibold tracking-wider uppercase text-[#C2BEC1] group-hover:text-[#F4F0E8] flex items-center space-x-1 transition-colors"
          >
            <span>EXPLORE</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#96929A] group-hover:text-[#FF5A36] transition-colors" />
          </Link>

          {game.latest_release?.apk_download_url ? (
            <a
              href={game.latest_release.apk_download_url}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
              title={`Download ${game.title} APK`}
            >
              <Download className="w-3 h-3" />
              <span>APK ({(game.latest_release.apk_file_size / 1024 / 1024).toFixed(1)}MB)</span>
            </a>
          ) : (
            <span className="text-[10px] tracking-wider text-[#96929A] font-mono-code uppercase">
              COMING SOON
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

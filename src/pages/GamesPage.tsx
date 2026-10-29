import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Game } from '../types';
import { api } from '../lib/api';
import { GameCard } from '../components/GameCard';
import { Search, Filter, X, RefreshCw, Gamepad2 } from 'lucide-react';

export const GamesPage: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');

  useEffect(() => {
    async function fetchGames() {
      try {
        setLoading(true);
        const data = await api.getGames();
        setGames(data);
      } catch (err) {
        console.error('Failed to load games', err);
      } finally {
        setLoading(false);
      }
    }
    fetchGames();
  }, []);

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => g.genre.forEach((genre) => set.add(genre)));
    return ['All', ...Array.from(set)];
  }, [games]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesSearch =
          game.title.toLowerCase().includes(q) ||
          game.tagline.toLowerCase().includes(q) ||
          game.description.toLowerCase().includes(q) ||
          game.genre.some((g) => g.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      if (selectedPlatform !== 'All') {
        const matchesPlatform = game.platforms.some(
          (p) => p.toLowerCase() === selectedPlatform.toLowerCase()
        );
        if (!matchesPlatform) return false;
      }

      if (selectedStatus !== 'All') {
        if (game.status !== selectedStatus) return false;
      }

      if (selectedGenre !== 'All') {
        if (!game.genre.includes(selectedGenre)) return false;
      }

      return true;
    });
  }, [games, search, selectedPlatform, selectedStatus, selectedGenre]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedPlatform('All');
    setSelectedStatus('All');
    setSelectedGenre('All');
  };

  return (
    <div className="min-h-screen pt-28 pb-24 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto bg-[#101014] text-[#C2BEC1] font-sans">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center space-x-2.5 mb-2.5">
          <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
          <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
            STUDIO RELEASES // PUBLIC ARCHIVE
          </span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight uppercase text-[#F4F0E8] leading-tight">
          GAME CATALOG &amp; <span className="text-[#FF5A36]">ARCHIVE</span>
        </h1>

        <p className="text-xs sm:text-sm text-[#C2BEC1] mt-2 max-w-xl leading-relaxed">
          Explore all official games developed and published by Karsh Tech. Download signed release APKs,
          read release changelogs, and inspect mechanical specifications.
        </p>
      </div>

      {/* Search & Filter Deck (Charcoal surface with restrained borders) */}
      <div className="p-5 sm:p-6 rounded-xl bg-[#1A191F] border border-[#39363A] mb-10 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3.5">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#96929A]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, genre, keyword..."
              className="w-full pl-10 pr-10 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A] focus:outline-none focus:border-[#FF5A36] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#96929A] hover:text-[#F4F0E8]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Platform Filters */}
          <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['All', 'Android', 'PC', 'Web'].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPlatform(p)}
                className={`px-3 py-2 text-xs font-semibold tracking-wider uppercase rounded border transition-all ${
                  selectedPlatform === p
                    ? 'border-[#FF5A36] bg-[#FF5A36] text-[#101014] font-bold shadow-sm'
                    : 'border-[#39363A] bg-[#101014] text-[#C2BEC1] hover:text-[#F4F0E8] hover:border-[#96929A]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Status Filters */}
          <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['All', 'Available', 'Coming Soon'].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={`px-3 py-2 text-xs font-semibold tracking-wider uppercase rounded border transition-all ${
                  selectedStatus === s
                    ? 'border-[#FF5A36] bg-[#242329] text-[#FF5A36] font-bold'
                    : 'border-[#39363A] bg-[#101014] text-[#C2BEC1] hover:text-[#F4F0E8] hover:border-[#96929A]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Genre Tags */}
        <div className="pt-3 border-t border-[#39363A]/80 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] flex items-center space-x-1 flex-shrink-0">
            <Filter className="w-3 h-3 text-[#FF5A36]" />
            <span>GENRE:</span>
          </span>
          {availableGenres.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-2.5 py-1 text-[11px] font-mono-code tracking-wider uppercase rounded transition-colors ${
                selectedGenre === genre
                  ? 'border border-[#FF5A36] bg-[#242329] text-[#FF5A36] font-bold'
                  : 'text-[#96929A] hover:text-[#F4F0E8]'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between mb-6 text-xs font-mono-code text-[#96929A]">
        <div>
          SHOWING <span className="text-[#F4F0E8] font-bold">{filteredGames.length}</span> RELEASES
        </div>
        {(search || selectedPlatform !== 'All' || selectedStatus !== 'All' || selectedGenre !== 'All') && (
          <button
            onClick={handleResetFilters}
            className="flex items-center space-x-1 text-[#FF5A36] hover:underline"
          >
            <RefreshCw className="w-3 h-3" />
            <span>RESET FILTERS</span>
          </button>
        )}
      </div>

      {/* Games Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-80 rounded-lg bg-[#1A191F] border border-[#39363A] animate-pulse"
            />
          ))}
        </div>
      ) : filteredGames.length > 0 ? (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredGames.map((game, idx) => (
              <motion.div
                layout
                key={game.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
              >
                <GameCard game={game} index={idx + 1} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        /* Empty State */
        <div className="py-20 text-center rounded-xl bg-[#1A191F] border border-[#39363A] p-8 shadow-xl">
          <div className="w-12 h-12 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center mx-auto mb-3">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <h3 className="font-display text-2xl uppercase tracking-tight text-[#F4F0E8]">
            NO GAMES FOUND
          </h3>
          <p className="text-xs text-[#96929A] max-w-sm mx-auto mt-1 leading-relaxed">
            No games currently match the specified search or filter parameters.
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-5 px-5 py-2.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold tracking-wider uppercase transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Game, DashboardStats } from '../types';
import { api } from '../lib/api';
import { Link } from '../context/RouterContext';
import { GameCard } from '../components/GameCard';
import {
  containerVariants,
  fadeUpVariants,
} from '../lib/motion';
import {
  Download,
  Gamepad2,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  Smartphone,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [, setLoading] = useState(true);
  const [activeScreenshotIdx, setActiveScreenshotIdx] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const [gamesData, statsData] = await Promise.all([
          api.getGames(),
          api.getStats(),
        ]);
        setGames(gamesData);
        setStats(statsData.stats);
      } catch (err) {
        console.error('Error loading homepage data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const featuredGame = games.find((g) => g.featured) || games[0];
  const otherGames = games.filter((g) => g.id !== featuredGame?.id);

  const heroScreenshots = featuredGame?.screenshots?.length
    ? featuredGame.screenshots
    : [
        '/uploads/images/arrow_puzzle_screenshot_1.jpg',
        '/uploads/images/arrow_puzzle_screenshot_2.jpg',
        '/uploads/images/arrow_puzzle_screenshot_3.jpg',
      ];

  return (
    <div className="relative w-full min-h-screen bg-[#101014] text-[#C2BEC1] font-sans overflow-hidden">
      {/* =========================================================================
          HERO SECTION (Cinematic Editorial Game Publisher)
          ========================================================================= */}
      <section className="relative min-h-[92vh] flex items-center justify-center pt-28 pb-16 px-6 sm:px-8 lg:px-12">
        {/* Subtle Ember Ambient Gradient in Top Center */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#FF5A36]/8 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            
            {/* Left Column: Bold Headline & Publisher Mission */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="lg:col-span-7 space-y-6"
            >
              {/* Studio Micro Header */}
              <motion.div variants={fadeUpVariants} className="flex items-center space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-[#FF5A36] animate-pulse" />
                <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
                  INDEPENDENT GAME PUBLISHER // EST. 2026
                </span>
                <span className="text-[#39363A]">|</span>
                <span className="text-xs text-[#96929A] tracking-wider uppercase font-mono-code">
                  DIRECT RELEASES
                </span>
              </motion.div>

              {/* Bold Editorial Headline */}
              <motion.div variants={fadeUpVariants}>
                <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[5.4rem] font-bold tracking-tight uppercase leading-[0.92] text-[#F4F0E8]">
                  CRAFTING GAMES OF <span className="text-[#FF5A36]">DEPTH</span>, TACTILITY, AND FOCUS.
                </h1>
              </motion.div>

              {/* Editorial Description */}
              <motion.p
                variants={fadeUpVariants}
                className="text-sm sm:text-base text-[#C2BEC1] leading-relaxed max-w-xl"
              >
                Karsh Tech builds pure, distraction-free games designed to stimulate spatial focus.
                Zero predatory timers, zero ad bloat—just verified, cryptographically signed Android releases distributed directly from our central platform.
              </motion.p>

              {/* Primary Call to Action Buttons */}
              <motion.div
                variants={fadeUpVariants}
                className="flex flex-wrap items-center gap-3.5 pt-2"
              >
                <Link
                  href="/games/arrow-puzzle"
                  className="inline-flex items-center justify-center space-x-2.5 px-6 py-3.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold tracking-[0.14em] uppercase transition-all shadow-md shadow-[#FF5A36]/25 hover:shadow-lg hover:shadow-[#FF5A36]/40 hover:-translate-y-0.5"
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>PLAY ARROW PUZZLE</span>
                </Link>

                <Link
                  href="/games"
                  className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded border border-[#39363A] bg-[#1A191F] hover:border-[#FF5A36] hover:text-[#FF5A36] text-[#F4F0E8] text-xs font-bold tracking-[0.14em] uppercase transition-all"
                >
                  <span>BROWSE CATALOG</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div variants={fadeUpVariants} className="pt-2 flex flex-wrap items-center gap-5 text-xs text-[#96929A]">
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>Signed Release APKs</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>100% Offline-First</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>Zero Telemetry Bloat</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Right Column: Hero Real Game Spotlight Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="lg:col-span-5 relative"
            >
              <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-4 sm:p-5 shadow-2xl relative overflow-hidden">
                {/* Visual Header */}
                <div className="relative aspect-[16/10] w-full rounded-lg overflow-hidden border border-[#39363A] bg-[#101014] mb-4">
                  <img
                    src={heroScreenshots[activeScreenshotIdx] || '/uploads/images/arrow_puzzle_screenshot_1.jpg'}
                    alt="Arrow Puzzle Gameplay"
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101014]/90 via-transparent to-transparent" />

                  <div className="absolute top-3 left-3 flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded bg-[#FF5A36] text-[#101014] text-[10px] font-bold uppercase tracking-wider">
                      FLAGSHIP TITLE
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#101014]/85 border border-[#39363A] text-[#F4F0E8] text-[10px] font-mono-code">
                      v1.0.0
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-[#F4F0E8]">
                    <span className="font-semibold">Tactile Corridor Puzzle</span>
                    <span className="text-[#FF5A36] font-mono-code font-bold">2.4 MB APK</span>
                  </div>
                </div>

                {/* Thumbnail Switcher for Real Screenshots */}
                {heroScreenshots.length > 1 && (
                  <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-1">
                    {heroScreenshots.map((shot, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveScreenshotIdx(idx)}
                        className={`relative w-14 h-9 rounded overflow-hidden border transition-all flex-shrink-0 ${
                          activeScreenshotIdx === idx
                            ? 'border-[#FF5A36] scale-105'
                            : 'border-[#39363A] opacity-50 hover:opacity-100'
                        }`}
                      >
                        <img src={shot} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick Info Box */}
                <div className="p-3 rounded bg-[#101014] border border-[#39363A] flex items-center justify-between text-xs mb-4">
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-[#96929A] tracking-wider">PLATFORM</div>
                    <div className="text-[#F4F0E8] font-bold flex items-center space-x-1 mt-0.5">
                      <Smartphone className="w-3.5 h-3.5 text-[#FF5A36]" />
                      <span>Android 8.0 – 15</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-[#96929A] tracking-wider">ENGINE</div>
                    <div className="text-[#F4F0E8] font-bold mt-0.5">Jetpack Compose</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-[#96929A] tracking-wider">NETWORK</div>
                    <div className="text-[#FF5A36] font-bold mt-0.5">100% Offline</div>
                  </div>
                </div>

                {/* Direct APK Link */}
                {featuredGame?.latest_release?.apk_download_url ? (
                  <a
                    href={featuredGame.latest_release.apk_download_url}
                    className="w-full inline-flex items-center justify-center space-x-2 py-3 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>DOWNLOAD OFFICIAL APK (2.4 MB)</span>
                  </a>
                ) : (
                  <Link
                    href={`/games/${featuredGame?.slug || 'arrow-puzzle'}`}
                    className="w-full inline-flex items-center justify-center space-x-2 py-3 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    <span>EXPLORE ARROW PUZZLE</span>
                  </Link>
                )}
              </div>
            </motion.div>

          </div>

          {/* Metrics Counter Strip (Clean Editorial Panels) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-16 pt-8 border-t border-[#39363A]">
            <div className="p-4 rounded-lg border border-[#39363A] bg-[#1A191F]">
              <span className="text-[10px] font-mono-code uppercase text-[#96929A] tracking-wider block mb-1">
                // ACTIVE TITLES
              </span>
              <div className="font-display text-3xl font-bold text-[#F4F0E8]">
                {stats?.total_games || games.length || 1} TITLE
              </div>
              <span className="text-xs text-[#C2BEC1] mt-0.5 block">
                Handcrafted spatial puzzle
              </span>
            </div>

            <div className="p-4 rounded-lg border border-[#39363A] bg-[#1A191F]">
              <span className="text-[10px] font-mono-code uppercase text-[#96929A] tracking-wider block mb-1">
                // DIRECT DELIVERIES
              </span>
              <div className="font-display text-3xl font-bold text-[#FF5A36]">
                {stats?.total_downloads ? `${stats.total_downloads}+` : 'OFFICIAL'} APKS
              </div>
              <span className="text-xs text-[#C2BEC1] mt-0.5 block">
                Direct signed distribution
              </span>
            </div>

            <div className="p-4 rounded-lg border border-[#39363A] bg-[#1A191F]">
              <span className="text-[10px] font-mono-code uppercase text-[#96929A] tracking-wider block mb-1">
                // RENDERING PERFORMANCE
              </span>
              <div className="font-display text-3xl font-bold text-[#F4F0E8]">
                60+ FPS
              </div>
              <span className="text-xs text-[#C2BEC1] mt-0.5 block">
                Native Jetpack Compose
              </span>
            </div>

            <div className="p-4 rounded-lg border border-[#39363A] bg-[#1A191F]">
              <span className="text-[10px] font-mono-code uppercase text-[#96929A] tracking-wider block mb-1">
                // CONNECTIVITY
              </span>
              <div className="font-display text-3xl font-bold text-[#F4F0E8]">
                100% OFFLINE
              </div>
              <span className="text-xs text-[#C2BEC1] mt-0.5 block">
                Zero telemetry or accounts
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FEATURED TITLE SHOWCASE (Arrow Puzzle Cinematic Deep Dive)
          ========================================================================= */}
      {featuredGame && (
        <section className="relative py-20 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#39363A]">
          <div className="flex items-center space-x-2.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              FLAGSHIP SHOWCASE // CURRENT RELEASE
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight uppercase text-[#F4F0E8] leading-tight">
                ARROW PUZZLE: <span className="text-[#FF5A36]">MIND PURIFIED.</span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#C2BEC1] max-w-md leading-relaxed">
              Inspect corridors. Discover unobstructed paths. Disentangle dense clusters of interlocking arrows with tactile satisfaction.
            </p>
          </div>

          {/* Staging Layout */}
          <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 sm:p-10 shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column (7 cols): Gameplay Overview & Mechanics */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <div className="flex items-center space-x-2 text-xs font-mono-code text-[#FF5A36] uppercase tracking-wider mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Android Exclusive • Spatial Logic</span>
                  </div>

                  <h3 className="font-display text-3xl sm:text-4xl font-bold text-[#F4F0E8] mb-3">
                    {featuredGame.tagline}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#C2BEC1] leading-relaxed mb-6">
                    {featuredGame.description}
                  </p>
                </div>

                {/* Core Rules & Mechanics List */}
                <div className="p-4 rounded-lg bg-[#101014] border border-[#39363A] space-y-3">
                  <div className="text-xs font-bold font-display uppercase tracking-wider text-[#F4F0E8]">
                    TACTILE GAMEPLAY PRINCIPLES
                  </div>
                  <div className="space-y-2 text-xs text-[#C2BEC1]">
                    {featuredGame.features.slice(0, 3).map((feat, idx) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <span className="text-[#FF5A36] font-bold font-mono">›</span>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Genre Tags */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {featuredGame.genre.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider bg-[#242329] border border-[#39363A] text-[#F4F0E8]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right Column (5 cols): Real Screenshot & Download CTA */}
              <div className="lg:col-span-5 space-y-5 lg:pl-6 lg:border-l lg:border-[#39363A]">
                <div className="relative aspect-[16/10] rounded-lg overflow-hidden border border-[#39363A] bg-[#101014]">
                  <img
                    src={featuredGame.cover_image}
                    alt={featuredGame.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101014]/85 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-[#F4F0E8]">
                    <span className="flex items-center space-x-1 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#FF5A36]" />
                      <span>Release Keystore Signed</span>
                    </span>
                    <span className="font-mono-code text-[11px] text-[#96929A]">API 26–35</span>
                  </div>
                </div>

                {/* Architecture Specifications */}
                <div className="space-y-2 text-xs font-mono-code">
                  <div className="p-2.5 rounded bg-[#101014] border border-[#39363A] flex items-center justify-between">
                    <span className="text-[#96929A]">TARGET PLATFORM</span>
                    <span className="text-[#F4F0E8] font-bold">Android 8.0 – 15</span>
                  </div>
                  <div className="p-2.5 rounded bg-[#101014] border border-[#39363A] flex items-center justify-between">
                    <span className="text-[#96929A]">BINARY SIZE</span>
                    <span className="text-[#F4F0E8] font-bold">
                      {featuredGame.latest_release
                        ? `${(featuredGame.latest_release.apk_file_size / 1024 / 1024).toFixed(2)} MB`
                        : '2.40 MB'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-[#101014] border border-[#39363A] flex items-center justify-between">
                    <span className="text-[#96929A]">NETWORK</span>
                    <span className="text-[#FF5A36] font-bold">100% Offline Capable</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                  {featuredGame.latest_release?.apk_download_url ? (
                    <a
                      href={featuredGame.latest_release.apk_download_url}
                      className="w-full inline-flex items-center justify-center space-x-2 py-3.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold tracking-[0.14em] uppercase transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>DOWNLOAD OFFICIAL APK</span>
                    </a>
                  ) : null}

                  <Link
                    href={`/games/${featuredGame.slug}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3.5 rounded border border-[#39363A] bg-[#242329] hover:border-[#FF5A36] text-[#F4F0E8] text-xs font-bold tracking-wider uppercase transition-colors"
                  >
                    <span>OVERVIEW</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#FF5A36]" />
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          MORE TITLES / CATALOG PREVIEW
          ========================================================================= */}
      {otherGames.length > 0 && (
        <section className="relative py-16 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-t border-[#39363A]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
                STUDIO RELEASES
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase text-[#F4F0E8] mt-1">
                MORE TITLES
              </h2>
            </div>
            <Link
              href="/games"
              className="text-xs font-bold tracking-[0.14em] uppercase text-[#C2BEC1] hover:text-[#FF5A36] transition-colors"
            >
              VIEW FULL CATALOG →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherGames.map((game, idx) => (
              <GameCard key={game.id} game={game} index={idx + 2} />
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          PUBLISHING MANIFESTO & STUDIO ARCHITECTURE
          ========================================================================= */}
      <section className="relative py-20 px-6 sm:px-8 lg:px-12 border-t border-[#39363A] bg-[#101014]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center space-x-2.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              PUBLISHING PHILOSOPHY
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <h2 className="font-display text-4xl sm:text-5xl font-bold uppercase text-[#F4F0E8] leading-tight">
              ENGINEERED FOR PLAY. <span className="text-[#FF5A36]">RESPECTING THE PLAYER.</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#C2BEC1] max-w-md leading-relaxed">
              How Karsh Tech approaches game craft: zero predatory dark patterns, native execution, and rigorous puzzle mechanics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="rounded-lg border border-[#39363A] bg-[#1A191F] p-6 hover:border-[#FF5A36]/60 transition-all">
              <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36] mb-5">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono-code uppercase text-[#96929A] tracking-wider block mb-1">
                // MECHANICS
              </span>
              <h3 className="font-display text-2xl font-bold text-[#F4F0E8] mb-2">
                SPATIAL CLARITY
              </h3>
              <p className="text-xs text-[#C2BEC1] leading-relaxed">
                Handcrafted board configurations with algorithmic solvability guarantees. No brute-force guessing or random luck.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-lg border border-[#39363A] bg-[#1A191F] p-6 hover:border-[#FF5A36]/60 transition-all">
              <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36] mb-5">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono-code uppercase text-[#96929A] tracking-wider block mb-1">
                // PERFORMANCE
              </span>
              <h3 className="font-display text-2xl font-bold text-[#F4F0E8] mb-2">
                NATIVE EXECUTION
              </h3>
              <p className="text-xs text-[#C2BEC1] leading-relaxed">
                Written in native Jetpack Compose for Android. Sub-16ms frame times, 60+ FPS touch response, and minimal thermal footprint.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-lg border border-[#39363A] bg-[#1A191F] p-6 hover:border-[#FF5A36]/60 transition-all">
              <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36] mb-5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono-code uppercase text-[#96929A] tracking-wider block mb-1">
                // INDEPENDENCE
              </span>
              <h3 className="font-display text-2xl font-bold text-[#F4F0E8] mb-2">
                AUTONOMOUS PUBLISHING
              </h3>
              <p className="text-xs text-[#C2BEC1] leading-relaxed">
                Direct studio distribution with cryptographically signed release APKs. Immediate updates, privacy-first, zero intermediary lock-in.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import type { Game, Release } from '../types';
import { api } from '../lib/api';
import { useRouter, Link } from '../context/RouterContext';
import { AnimatedBadge } from '../components/AnimatedBadge';
import { ScreenshotModal } from '../components/ScreenshotModal';
import { GameCard } from '../components/GameCard';
import {
  Download,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowLeft,
  Share2,
  HelpCircle,
  Maximize2,
  FileCheck,
} from 'lucide-react';

export const GameDetailPage: React.FC = () => {
  const { params } = useRouter();
  const slug = params.slug || '';

  const [game, setGame] = useState<(Game & { releases: Release[] }) | null>(null);
  const [relatedGames, setRelatedGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadGame() {
      if (!slug) {
        setError('Game not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await api.getGameBySlug(slug);
        setGame(data.game);

        const all = await api.getGames();
        setRelatedGames(all.filter((g) => g.slug !== slug).slice(0, 3));
      } catch (err: any) {
        setGame(null);
        setError(err.message || 'Game not found');
      } finally {
        setLoading(false);
      }
    }

    loadGame();

    const handleGamesChanged = () => {
      loadGame();
    };

    window.addEventListener('karshtech:games-updated', handleGamesChanged);
    return () => {
      window.removeEventListener('karshtech:games-updated', handleGamesChanged);
    };
  }, [slug]);

  useEffect(() => {
    if (!game) return;
    document.title = `${game.title} — Official Download & Specs | Karsh Tech`;

    const scriptId = 'game-jsonld-schema';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    const schemaData = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'applicationCategory': 'GameApplication',
      'name': game.title,
      'operatingSystem': 'Android',
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD',
      },
      'author': {
        '@type': 'Organization',
        'name': 'Karsh Tech',
        'url': 'https://tech.aadirishi.in',
      },
      'publisher': {
        '@type': 'Organization',
        'name': 'Karsh Tech',
        'url': 'https://tech.aadirishi.in',
      },
      'description': game.description,
      'image': game.cover_image,
      'downloadUrl': game.latest_release?.apk_download_url || `https://tech.aadirishi.in/games/${game.slug}`,
      'softwareVersion': game.latest_release?.version_name || '1.0.0',
    };

    script.text = JSON.stringify(schemaData);

    return () => {
      const existing = document.getElementById(scriptId);
      if (existing) {
        existing.remove();
      }
    };
  }, [game]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 pb-20 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-32 bg-[#1A191F] border border-[#39363A] rounded" />
          <div className="h-80 w-full bg-[#1A191F] border border-[#39363A] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen pt-32 pb-20 max-w-2xl mx-auto px-6 text-center">
        <div className="p-10 rounded-xl bg-[#1A191F] border border-[#39363A] shadow-xl">
          <h2 className="font-display text-3xl text-[#F4F0E8] uppercase tracking-tight mb-2">
            TITLE NOT LOCATED
          </h2>
          <p className="text-xs text-[#96929A] mb-6">
            No published release catalogued for slug &quot;{slug}&quot;.
          </p>
          <Link
            href="/games"
            className="px-6 py-3 rounded bg-[#FF5A36] text-[#101014] text-xs font-bold uppercase tracking-wider"
          >
            RETURN TO CATALOG
          </Link>
        </div>
      </div>
    );
  }

  const latestRelease = game.latest_release;

  return (
    <div className="min-h-screen pt-28 pb-24 text-[#C2BEC1] bg-[#101014] font-sans">
      {/* Top Breadcrumb Navigation */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pb-6 flex items-center justify-between">
        <Link
          href="/games"
          className="inline-flex items-center space-x-2 text-xs font-mono-code text-[#96929A] hover:text-[#FF5A36] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>CATALOG / {game.slug.toUpperCase()}</span>
        </Link>

        <button
          onClick={handleShare}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded border border-[#39363A] bg-[#1A191F] hover:border-[#FF5A36] text-xs font-mono-code text-[#C2BEC1] transition-colors"
        >
          <Share2 className="w-3.5 h-3.5 text-[#FF5A36]" />
          <span>{copied ? 'COPIED' : 'SHARE'}</span>
        </button>
      </div>

      {/* Main Game Showcase Card (Cinematic Charcoal with Ember Accents) */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mb-14">
        <div className="rounded-xl bg-[#1A191F] border border-[#39363A] p-6 sm:p-10 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column (7 Cols) */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <AnimatedBadge status={game.status} />
                {game.platforms.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded border border-[#39363A] bg-[#101014] text-[10px] font-mono-code text-[#F4F0E8]"
                  >
                    <Smartphone className="w-3 h-3 text-[#FF5A36]" />
                    <span>{p.toUpperCase()}</span>
                  </span>
                ))}
                {latestRelease && (
                  <span className="px-2.5 py-0.5 rounded border border-[#39363A] bg-[#101014] text-[10px] font-mono-code text-[#F4F0E8]">
                    BUILD #{latestRelease.version_code}
                  </span>
                )}
              </div>

              <div>
                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tight text-[#F4F0E8] leading-tight">
                  {game.title}
                </h1>
                <p className="text-sm sm:text-base text-[#F4F0E8] font-medium tracking-wide mt-1.5">
                  {game.tagline}
                </p>
                <p className="text-xs sm:text-sm text-[#C2BEC1] mt-3 leading-relaxed max-w-xl">
                  {game.description}
                </p>
              </div>

              {/* Genre Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {game.genre.map((g) => (
                  <span
                    key={g}
                    className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded border border-[#39363A] bg-[#242329] text-[#C2BEC1]"
                  >
                    {g}
                  </span>
                ))}
              </div>

              {/* Primary APK Download Action */}
              <div className="pt-3 space-y-3">
                {latestRelease?.apk_download_url ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={latestRelease.apk_download_url}
                      className="inline-flex items-center space-x-3 px-7 py-3.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold tracking-[0.14em] uppercase transition-all shadow-md shadow-[#FF5A36]/20"
                    >
                      <Download className="w-4 h-4" />
                      <div className="text-left">
                        <div className="leading-none">DOWNLOAD OFFICIAL RELEASE APK</div>
                        <div className="text-[10px] font-mono-code text-[#101014]/80 mt-1 font-semibold">
                          v{latestRelease.version_name} • {(latestRelease.apk_file_size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </a>

                    <Link
                      href="/support#faq"
                      className="inline-flex items-center space-x-1.5 px-4 py-3.5 rounded border border-[#39363A] bg-[#242329] hover:border-[#FF5A36] text-xs font-mono-code text-[#C2BEC1] hover:text-[#F4F0E8] transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-[#FF5A36]" />
                      <span>INSTALL FAQ</span>
                    </Link>
                  </div>
                ) : (
                  <div className="p-3.5 rounded border border-[#39363A] bg-[#101014] text-xs font-mono-code text-[#96929A]">
                    Release binary compilation in progress.
                  </div>
                )}

                <div className="flex items-center space-x-3 text-xs font-mono-code text-[#96929A]">
                  <span className="flex items-center space-x-1 text-[#F4F0E8]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#FF5A36]" />
                    <span>Cryptographically Signed Keystore</span>
                  </span>
                  <span>•</span>
                  <span>Developer: {game.developer}</span>
                </div>
              </div>
            </div>

            {/* Right Media Preview (5 Cols) */}
            <div className="lg:col-span-5 relative">
              <div
                onClick={() => {
                  setLightboxIndex(0);
                  setLightboxOpen(true);
                }}
                className="relative aspect-[16/10] sm:aspect-[4/3] rounded-lg overflow-hidden border border-[#39363A] bg-[#101014] cursor-pointer group shadow-xl"
              >
                <img
                  src={game.cover_image}
                  alt={game.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#101014]/90 via-transparent to-transparent" />
                <div className="absolute bottom-3 right-3 px-3 py-1 rounded border border-[#39363A] bg-[#1A191F]/90 text-[10.5px] font-mono-code text-[#F4F0E8] flex items-center space-x-1.5">
                  <Maximize2 className="w-3 h-3 text-[#FF5A36]" />
                  <span>VIEW SCREENSHOTS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left 8 Cols: Screenshots, Mechanics, Features, Changelog */}
        <div className="lg:col-span-8 space-y-12">
          
          {/* Screenshot Gallery */}
          {game.screenshots.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-mono-code uppercase tracking-wider text-[#FF5A36] font-bold">
                  // GAMEPLAY ARCHIVE
                </span>
                <span className="text-xs font-mono-code text-[#96929A]">
                  ({game.screenshots.length} CAPTURES)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {game.screenshots.map((shot, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setLightboxIndex(idx);
                      setLightboxOpen(true);
                    }}
                    className="relative aspect-[16/10] rounded-lg overflow-hidden border border-[#39363A] bg-[#1A191F] cursor-pointer group shadow hover:border-[#FF5A36] transition-colors"
                  >
                    <img
                      src={shot}
                      alt={`${game.title} screenshot ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-[#101014]/20 group-hover:bg-transparent transition-colors" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="p-2 rounded border border-[#FF5A36] bg-[#101014]/90 text-[#FF5A36]">
                        <Maximize2 className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Core Features */}
          {game.features.length > 0 && (
            <section className="space-y-4">
              <div className="text-xs font-mono-code uppercase tracking-wider text-[#FF5A36] font-bold">
                // CORE GAME PILLARS
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {game.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-[#39363A] bg-[#1A191F] flex items-start space-x-3"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#FF5A36] flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-[#C2BEC1] leading-relaxed">
                      {feat}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* How to Play & Controls */}
          {game.controls.length > 0 && (
            <section className="space-y-4">
              <div className="text-xs font-mono-code uppercase tracking-wider text-[#FF5A36] font-bold">
                // HOW TO PLAY &amp; CONTROLS
              </div>

              <div className="p-5 rounded-lg border border-[#39363A] bg-[#1A191F] space-y-2.5">
                {game.controls.map((ctrl, idx) => (
                  <div key={idx} className="flex items-start space-x-3 text-xs text-[#C2BEC1]">
                    <span className="w-5 h-5 rounded border border-[#39363A] bg-[#242329] text-[#FF5A36] font-mono-code font-bold flex items-center justify-center flex-shrink-0 text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed pt-0.5">{ctrl}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Version History & Changelog */}
          {game.releases && game.releases.length > 0 && (
            <section className="space-y-4">
              <div className="text-xs font-mono-code uppercase tracking-wider text-[#FF5A36] font-bold">
                // VERSION HISTORY &amp; BUILDS
              </div>

              <div className="space-y-3">
                {game.releases.map((rel) => (
                  <div
                    key={rel.id}
                    className="p-5 rounded-lg border border-[#39363A] bg-[#1A191F] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-display text-xl font-bold text-[#F4F0E8]">
                          VERSION {rel.version_name}
                        </span>
                        <span className="text-xs font-mono-code text-[#96929A]">
                          (BUILD #{rel.version_code})
                        </span>
                        {rel.id === latestRelease?.id && (
                          <span className="px-2 py-0.5 text-[9px] font-mono-code tracking-wider uppercase rounded bg-[#FF5A36] text-[#101014] font-bold">
                            LATEST
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#C2BEC1] leading-relaxed">
                        {rel.release_notes}
                      </p>
                      <div className="flex items-center space-x-3 text-xs font-mono-code text-[#96929A] pt-1">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-[#FF5A36]" />
                          <span>{rel.release_date}</span>
                        </span>
                        <span>•</span>
                        <span>{(rel.apk_file_size / 1024 / 1024).toFixed(2)} MB</span>
                        <span>•</span>
                        <span>{rel.download_count} Downloads</span>
                      </div>
                    </div>

                    <a
                      href={rel.apk_download_url}
                      className="inline-flex items-center space-x-2 px-4 py-2 rounded bg-[#242329] border border-[#39363A] hover:border-[#FF5A36] text-xs font-mono-code text-[#F4F0E8] transition-colors self-start sm:self-center"
                    >
                      <Download className="w-3.5 h-3.5 text-[#FF5A36]" />
                      <span>DOWNLOAD</span>
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right 4 Cols: Technical Specifications Deck */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-5 rounded-lg border border-[#39363A] bg-[#1A191F] space-y-4 shadow-xl">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#FF5A36]" />
              <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[#F4F0E8]">
                SPECIFICATIONS
              </h3>
            </div>

            <div className="space-y-1.5">
              <div className="p-2.5 rounded bg-[#101014] border border-[#39363A] flex justify-between text-xs font-mono-code">
                <span className="text-[#96929A]">MINIMUM OS</span>
                <span className="text-[#F4F0E8] font-bold">{game.requirements.min_android || 'Android 8.0+'}</span>
              </div>
              <div className="p-2.5 rounded bg-[#101014] border border-[#39363A] flex justify-between text-xs font-mono-code">
                <span className="text-[#96929A]">TARGET OS</span>
                <span className="text-[#F4F0E8] font-bold">{game.requirements.target_android || 'Android 15'}</span>
              </div>
              <div className="p-2.5 rounded bg-[#101014] border border-[#39363A] flex justify-between text-xs font-mono-code">
                <span className="text-[#96929A]">STORAGE REQUIRED</span>
                <span className="text-[#F4F0E8] font-bold">{game.requirements.storage || '25 MB'}</span>
              </div>
              <div className="p-2.5 rounded bg-[#101014] border border-[#39363A] flex justify-between text-xs font-mono-code">
                <span className="text-[#96929A]">RECOMMENDED RAM</span>
                <span className="text-[#F4F0E8] font-bold">{game.requirements.ram || '2 GB'}</span>
              </div>
              <div className="p-2.5 rounded bg-[#101014] border border-[#39363A] flex justify-between text-xs font-mono-code">
                <span className="text-[#96929A]">INTERNET ACCESS</span>
                <span className="text-[#FF5A36] font-bold">{game.requirements.internet || '100% Offline'}</span>
              </div>
              <div className="p-2.5 rounded bg-[#101014] border border-[#39363A] flex justify-between text-xs font-mono-code">
                <span className="text-[#96929A]">ARCHITECTURE</span>
                <span className="text-[#F4F0E8] font-bold">ARM64-v8a / v7a</span>
              </div>
            </div>

            <div className="p-3 rounded border border-[#39363A] bg-[#242329] text-[11px] font-mono-code text-[#C2BEC1] flex items-start space-x-2">
              <FileCheck className="w-4 h-4 text-[#FF5A36] flex-shrink-0 mt-0.5" />
              <span>Full ProGuard minification, resource shrinking, and private release keystore verification.</span>
            </div>
          </div>

          {/* Need Support Box */}
          <div className="p-5 rounded-lg border border-[#39363A] bg-[#1A191F] space-y-3">
            <h3 className="font-display text-xl font-bold uppercase tracking-tight text-[#F4F0E8]">
              NEED ASSISTANCE?
            </h3>
            <p className="text-xs text-[#C2BEC1] leading-relaxed">
              Encountered an issue on a specific level or device? Report directly to our engineering team.
            </p>
            <Link
              href="/support"
              className="block w-full text-center py-2.5 rounded border border-[#39363A] bg-[#242329] hover:border-[#FF5A36] hover:text-[#FF5A36] text-xs font-bold tracking-wider uppercase text-[#F4F0E8] transition-colors"
            >
              CONTACT SUPPORT
            </Link>
          </div>
        </div>
      </div>

      {/* Related Titles */}
      {relatedGames.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mt-20 pt-12 border-t border-[#39363A]">
          <div className="flex items-center space-x-2.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              MORE FROM KARSH TECH
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedGames.map((rg, idx) => (
              <GameCard key={rg.id} game={rg} index={idx + 2} />
            ))}
          </div>
        </section>
      )}

      {/* Lightbox Modal */}
      <ScreenshotModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        screenshots={game.screenshots}
        currentIndex={lightboxIndex}
        onSelectIndex={(idx) => setLightboxIndex(idx)}
      />
    </div>
  );
};

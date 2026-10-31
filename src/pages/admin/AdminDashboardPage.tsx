import React, { useState, useEffect } from 'react';
import type { DashboardStats, Release, Game } from '../../types';
import { api } from '../../lib/api';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { GameFormModal } from '../../components/admin/GameFormModal';
import { ReleaseUploadModal } from '../../components/admin/ReleaseUploadModal';
import { ToastContainer, type ToastMessage } from '../../components/admin/Toast';
import { Link } from '../../context/RouterContext';
import {
  Gamepad2,
  UploadCloud,
  Download,
  ShieldCheck,
  Plus,
  ArrowRight,
  Sparkles,
  Package,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentReleases, setRecentReleases] = useState<(Release & { game_title: string })[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [adminStats, gamesList] = await Promise.all([
        api.getAdminStats(),
        api.getAdminGames(),
      ]);
      setStats(adminStats.stats);
      setRecentReleases(adminStats.recent_releases);
      setGames(gamesList);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <AdminLayout
      title="Publishing Telemetry"
      onNewGame={() => setIsGameModalOpen(true)}
      onNewRelease={async () => {
        try {
          const freshGames = await api.getAdminGames();
          setGames(freshGames);
        } catch {}
        setIsReleaseModalOpen(true);
      }}
    >
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Products */}
          <div className="p-5 bg-[#1A191F] border border-[#39363A] rounded-md transition-colors hover:border-[#FF5A36]/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#96929A]">
                Digital Products
              </span>
              <div className="p-2 rounded bg-[#242329] text-[#F4F0E8] border border-[#39363A]">
                <Package className="w-4 h-4 text-[#FF5A36]" />
              </div>
            </div>
            <div className="font-display text-3xl font-bold text-[#F4F0E8] mt-3 tracking-tight">
              {stats?.total_products ?? 0}
            </div>
            <div className="text-[11px] tracking-wider text-[#96929A] mt-1 font-mono">
              {stats?.published_products ?? 0} published live
            </div>
          </div>

          {/* Card 2: Games */}
          <div className="p-5 bg-[#1A191F] border border-[#39363A] rounded-md transition-colors hover:border-[#FF5A36]/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#96929A]">
                Catalog Titles
              </span>
              <div className="p-2 rounded bg-[#242329] text-[#F4F0E8] border border-[#39363A]">
                <Gamepad2 className="w-4 h-4 text-[#FF5A36]" />
              </div>
            </div>
            <div className="font-display text-3xl font-bold text-[#F4F0E8] mt-3 tracking-tight">
              {stats?.total_games ?? 0}
            </div>
            <div className="text-[11px] tracking-wider text-[#96929A] mt-1 font-mono">
              {stats?.published_games ?? 0} active in distribution
            </div>
          </div>

          {/* Card 3: Releases */}
          <div className="p-5 bg-[#1A191F] border border-[#39363A] rounded-md transition-colors hover:border-[#FF5A36]/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#96929A]">
                Deployed Builds
              </span>
              <div className="p-2 rounded bg-[#242329] text-[#F4F0E8] border border-[#39363A]">
                <UploadCloud className="w-4 h-4 text-[#FF5A36]" />
              </div>
            </div>
            <div className="font-display text-3xl font-bold text-[#F4F0E8] mt-3 tracking-tight">
              {stats?.total_releases ?? 0}
            </div>
            <div className="text-[11px] tracking-wider text-[#96929A] mt-1 font-mono">
              Signed APK production artifacts
            </div>
          </div>

          {/* Card 4: Downloads */}
          <div className="p-5 bg-[#1A191F] border border-[#39363A] rounded-md transition-colors hover:border-[#FF5A36]/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#96929A]">
                Direct Deliveries
              </span>
              <div className="p-2 rounded bg-[#242329] text-[#FF5A36] border border-[#39363A]">
                <Download className="w-4 h-4" />
              </div>
            </div>
            <div className="font-display text-3xl font-bold text-[#FF5A36] mt-3 tracking-tight">
              {stats?.total_downloads ?? 0}
            </div>
            <div className="text-[11px] tracking-wider text-[#96929A] mt-1 font-mono">
              Independent sideload verification
            </div>
          </div>

          {/* Card 5: Security */}
          <div className="p-5 bg-[#1A191F] border border-[#39363A] rounded-md transition-colors hover:border-[#FF5A36]/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#96929A]">
                Console Guard
              </span>
              <div className="p-2 rounded bg-[#242329] text-[#34D399] border border-[#39363A]">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="font-display text-xl font-bold text-[#F4F0E8] mt-4 tracking-tight uppercase">
              ENCRYPTED
            </div>
            <div className="text-[11px] tracking-wider text-[#34D399] mt-1 font-mono font-medium">
              Bcrypt &amp; Session Verified
            </div>
          </div>
        </div>

        {/* Quick Action Pipeline Banner */}
        <div className="p-6 bg-[#1A191F] border border-[#39363A] rounded-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#242329] border border-[#39363A] text-[10px] font-mono uppercase tracking-widest text-[#FF5A36] mb-2">
              <Sparkles className="w-3 h-3" />
              Autonomous Distribution Pipeline
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F4F0E8]">
              STUDIO PUBLISHING PIPELINE
            </h3>
            <p className="text-xs text-[#96929A] mt-1 max-w-xl leading-relaxed">
              Publish new titles or deploy release APK builds directly to the public showcase without modifying client code or triggering external redeployments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Link
              href="/admin/products"
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#FF5A36] text-[#101014] font-bold text-xs uppercase tracking-[0.16em] rounded transition-all hover:brightness-110 active:scale-95 shadow-[0_2px_12px_rgba(255,90,54,0.3)]"
            >
              <Package className="w-4 h-4" />
              <span>Products Console</span>
            </Link>

            <button
              onClick={() => setIsGameModalOpen(true)}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#242329] border border-[#39363A] text-[#F4F0E8] hover:border-[#FF5A36]/60 text-xs font-semibold uppercase tracking-[0.16em] rounded transition-all"
            >
              <Plus className="w-4 h-4 text-[#FF5A36]" />
              <span>Create Game</span>
            </button>

            <button
              onClick={async () => {
                try {
                  const freshGames = await api.getAdminGames();
                  setGames(freshGames);
                } catch {}
                setIsReleaseModalOpen(true);
              }}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#242329] border border-[#39363A] text-[#F4F0E8] hover:border-[#FF5A36]/60 text-xs font-semibold uppercase tracking-[0.16em] rounded transition-all"
            >
              <UploadCloud className="w-4 h-4 text-[#FF5A36]" />
              <span>Deploy APK</span>
            </button>
          </div>
        </div>

        {/* Recent Releases Table */}
        <div className="p-6 bg-[#1A191F] border border-[#39363A] rounded-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#39363A]">
            <div>
              <h3 className="font-display text-lg font-bold tracking-tight text-[#F4F0E8]">
                RECENT BUILDS &amp; RELEASES
              </h3>
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#96929A] mt-0.5">
                Distribution log &amp; download telemetry
              </p>
            </div>
            <Link
              href="/admin/releases"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-[#FF5A36] hover:text-[#F4F0E8] flex items-center gap-1.5 transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentReleases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#39363A] text-[10px] font-mono uppercase tracking-[0.18em] text-[#96929A]">
                    <th className="pb-3 font-semibold">Title</th>
                    <th className="pb-3 font-semibold">Version</th>
                    <th className="pb-3 font-semibold">Build #</th>
                    <th className="pb-3 font-semibold">File Size</th>
                    <th className="pb-3 font-semibold">Downloads</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Binary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#39363A]/60">
                  {recentReleases.map((rel) => (
                    <tr key={rel.id} className="hover:bg-[#242329]/60 transition-colors">
                      <td className="py-3.5 text-[#F4F0E8] font-bold text-sm">
                        <div>{rel.game_title}</div>
                        <div
                          className="text-[10px] font-mono text-[#96929A] font-normal truncate max-w-[160px] mt-0.5"
                          title={rel.original_filename || rel.apk_filename}
                        >
                          {rel.original_filename || rel.apk_filename}
                        </div>
                      </td>
                      <td className="py-3.5 text-[#FF5A36] font-mono text-xs">v{rel.version_name}</td>
                      <td className="py-3.5 text-[#96929A] font-mono text-xs">#{rel.version_code}</td>
                      <td className="py-3.5 text-[#C2BEC1] font-mono text-xs">
                        {(rel.apk_file_size / 1024 / 1024).toFixed(2)} MB
                      </td>
                      <td className="py-3.5 text-[#F4F0E8] font-mono font-bold text-xs">
                        {rel.download_count}
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider font-semibold ${
                            rel.is_published
                              ? 'bg-[#FF5A36]/10 text-[#FF5A36] border border-[#FF5A36]/30'
                              : 'bg-[#242329] text-[#96929A] border border-[#39363A]'
                          }`}
                        >
                          {rel.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <a
                          href={rel.apk_download_url}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#242329] border border-[#39363A] text-[#F4F0E8] hover:border-[#FF5A36] text-[10px] font-mono tracking-wider transition-colors"
                          title="Download APK binary"
                        >
                          <Download className="w-3 h-3 text-[#FF5A36]" />
                          <span>Get</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[#96929A] font-mono tracking-wider">
              No release artifacts deployed yet.
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <GameFormModal
        isOpen={isGameModalOpen}
        onClose={() => setIsGameModalOpen(false)}
        onSaved={() => {
          showToast('success', 'Game listing saved successfully!');
          loadDashboardData();
        }}
      />

      <ReleaseUploadModal
        isOpen={isReleaseModalOpen}
        onClose={() => setIsReleaseModalOpen(false)}
        games={games}
        onSaved={() => {
          showToast('success', 'Release APK deployed successfully!');
          loadDashboardData();
        }}
      />

      {/* Toasts */}
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </AdminLayout>
  );
};

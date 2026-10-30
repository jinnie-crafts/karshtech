import React, { useState, useEffect } from 'react';
import type { Release, Game } from '../../types';
import { api } from '../../lib/api';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { ReleaseUploadModal } from '../../components/admin/ReleaseUploadModal';
import { ToastContainer, type ToastMessage } from '../../components/admin/Toast';
import {
  UploadCloud,
  Download,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
} from 'lucide-react';

export const AdminReleasesPage: React.FC = () => {
  const [releases, setReleases] = useState<(Release & { game_title: string })[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [relList, gamesList] = await Promise.all([
        api.getAdminReleases(),
        api.getAdminGames(),
      ]);
      setReleases(relList);
      setGames(gamesList);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load releases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTogglePublished = async (rel: Release) => {
    try {
      const nextState = !rel.is_published;
      await api.updateRelease(rel.id, { is_published: nextState });
      showToast(
        'success',
        nextState ? `v${rel.version_name} is now Published.` : `v${rel.version_name} is now in Draft.`
      );
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update publication status');
    }
  };

  const handleDelete = async (rel: Release) => {
    if (
      !window.confirm(
        `Are you sure you want to delete release v${rel.version_name}? Downloads for this build will be disabled.`
      )
    ) {
      return;
    }

    try {
      await api.deleteRelease(rel.id);
      showToast('success', `Release v${rel.version_name} deleted.`);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete release.');
    }
  };

  const handleCreate = async () => {
    try {
      const freshGames = await api.getAdminGames();
      setGames(freshGames);
    } catch (err) {
      console.error('Failed to refresh games list:', err);
    }
    setSelectedRelease(null);
    setIsModalOpen(true);
  };

  const handleEdit = async (rel: Release) => {
    try {
      const freshGames = await api.getAdminGames();
      setGames(freshGames);
    } catch (err) {
      console.error('Failed to refresh games list:', err);
    }
    setSelectedRelease(rel);
    setIsModalOpen(true);
  };

  return (
    <AdminLayout title="Releases &amp; APKs" onNewRelease={handleCreate}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Action */}
        <div className="p-5 bg-[#1A191F] border border-[#39363A] rounded-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold tracking-tight text-[#F4F0E8]">
              RELEASE PIPELINE &amp; BINARIES
            </h3>
            <p className="text-xs text-[#96929A] mt-0.5">
              Manage compiled signed Android APK artifacts, target SDK constraints, and direct download distribution.
            </p>
          </div>

          <button
            onClick={handleCreate}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#FF5A36] text-[#101014] font-bold text-xs uppercase tracking-[0.16em] rounded transition-all hover:brightness-110 active:scale-95 shadow-[0_2px_12px_rgba(255,90,54,0.3)]"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Release APK</span>
          </button>
        </div>

        {/* Releases Table */}
        <div className="bg-[#1A191F] border border-[#39363A] rounded-md overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-xs font-mono uppercase tracking-widest text-[#96929A]">
              Fetching release repository...
            </div>
          ) : releases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#39363A] bg-[#242329]/50 text-[10px] font-mono uppercase tracking-[0.18em] text-[#96929A]">
                    <th className="py-3.5 px-5 font-semibold">Game</th>
                    <th className="py-3.5 px-4 font-semibold">Version</th>
                    <th className="py-3.5 px-4 font-semibold">Build #</th>
                    <th className="py-3.5 px-4 font-semibold">Target SDK</th>
                    <th className="py-3.5 px-4 font-semibold">File Size</th>
                    <th className="py-3.5 px-4 font-semibold">Downloads</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#39363A]/60">
                  {releases.map((rel) => (
                    <tr key={rel.id} className="hover:bg-[#242329]/50 transition-colors">
                      {/* Game */}
                      <td className="py-3.5 px-5 text-[#F4F0E8] font-bold text-sm">
                        {rel.game_title}
                      </td>

                      {/* Version */}
                      <td className="py-3.5 px-4 text-[#FF5A36] font-mono text-xs font-bold">
                        v{rel.version_name}
                      </td>

                      {/* Version Code */}
                      <td className="py-3.5 px-4 text-[#96929A] font-mono text-xs">
                        #{rel.version_code}
                      </td>

                      {/* SDKs */}
                      <td className="py-3.5 px-4 text-[#C2BEC1] font-mono text-xs">
                        API {rel.min_sdk}–{rel.target_sdk}
                      </td>

                      {/* File Size */}
                      <td className="py-3.5 px-4 text-[#C2BEC1] font-mono text-xs">
                        {(rel.apk_file_size / 1024 / 1024).toFixed(2)} MB
                      </td>

                      {/* Downloads */}
                      <td className="py-3.5 px-4 text-[#F4F0E8] font-mono font-bold text-xs">
                        {rel.download_count}
                      </td>

                      {/* Published Toggle */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleTogglePublished(rel)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-mono uppercase tracking-wider font-semibold transition-all ${
                            rel.is_published
                              ? 'bg-[#FF5A36]/10 text-[#FF5A36] border border-[#FF5A36]/40 hover:bg-[#FF5A36]/20'
                              : 'bg-[#242329] text-[#96929A] border border-[#39363A] hover:text-[#F4F0E8]'
                          }`}
                        >
                          {rel.is_published ? (
                            <>
                              <Eye className="w-3 h-3 text-[#FF5A36]" />
                              <span>Live</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-[#96929A]" />
                              <span>Draft</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={rel.apk_download_url}
                            className="p-1.5 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] hover:text-[#F4F0E8] hover:border-[#FF5A36] transition-colors"
                            title="Direct download test"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          <button
                            onClick={() => handleEdit(rel)}
                            className="p-1.5 rounded bg-[#242329] border border-[#39363A] text-[#C2BEC1] hover:text-[#F4F0E8] hover:border-[#FF5A36]/60 transition-colors"
                            title="Edit Release Notes"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(rel)}
                            className="p-1.5 rounded bg-[#242329] border border-red-500/30 text-red-400 hover:text-red-300 hover:border-red-500/60 transition-colors"
                            title="Delete Release"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-16 text-center text-xs font-mono text-[#96929A] uppercase tracking-wider">
              No release artifacts uploaded yet.
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <ReleaseUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        games={games}
        initialRelease={selectedRelease}
        onSaved={() => {
          showToast(
            'success',
            selectedRelease ? 'Release updated!' : 'Release deployed successfully!'
          );
          loadData();
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

import React, { useState, useEffect } from 'react';
import type { Game } from '../../types';
import { api } from '../../lib/api';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { GameFormModal } from '../../components/admin/GameFormModal';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { ToastContainer, type ToastMessage } from '../../components/admin/Toast';
import { AnimatedBadge } from '../../components/AnimatedBadge';
import { Link } from '../../context/RouterContext';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  Smartphone,
  Monitor,
  Star,
} from 'lucide-react';

export const AdminGamesPage: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const loadGames = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminGames();
      setGames(data);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to fetch games');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  const handleEdit = (game: Game) => {
    setSelectedGame(game);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedGame(null);
    setIsModalOpen(true);
  };

  const handleDelete = (game: Game) => {
    setGameToDelete(game);
    setDeleteModalOpen(true);
  };

  const filteredGames = games.filter(
    (g) =>
      g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.slug.toLowerCase().includes(search.toLowerCase()) ||
      g.genre.some((gr) => gr.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AdminLayout title="Game Catalog" onNewGame={handleCreate}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Controls */}
        <div className="p-4 sm:p-5 bg-[#1A191F] border border-[#39363A] rounded-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#96929A]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search titles, slugs, genres..."
              className="w-full pl-10 pr-4 py-2 bg-[#0A0A0D] border border-[#39363A] rounded text-xs text-[#F4F0E8] placeholder-[#96929A] focus:outline-none focus:border-[#FF5A36] transition-colors"
            />
          </div>

          <button
            onClick={handleCreate}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 bg-[#FF5A36] text-[#101014] font-bold text-xs uppercase tracking-[0.16em] rounded transition-all hover:brightness-110 active:scale-95 shadow-[0_2px_12px_rgba(255,90,54,0.3)]"
          >
            <Plus className="w-4 h-4" />
            <span>New Game</span>
          </button>
        </div>

        {/* Games Table */}
        <div className="bg-[#1A191F] border border-[#39363A] rounded-md overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-xs font-mono uppercase tracking-widest text-[#96929A]">
              Loading catalog entries...
            </div>
          ) : filteredGames.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#39363A] bg-[#242329]/50 text-[10px] font-mono uppercase tracking-[0.18em] text-[#96929A]">
                    <th className="py-3.5 px-5 font-semibold">Game Title &amp; Slug</th>
                    <th className="py-3.5 px-4 font-semibold">Platforms</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold">Latest Release</th>
                    <th className="py-3.5 px-4 font-semibold">Featured</th>
                    <th className="py-3.5 px-5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#39363A]/60">
                  {filteredGames.map((game) => (
                    <tr key={game.id} className="hover:bg-[#242329]/50 transition-colors">
                      {/* Title & Cover */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-8 rounded bg-[#0A0A0D] border border-[#39363A] overflow-hidden flex-shrink-0">
                            <img
                              src={game.cover_image || '/uploads/images/default_cover.jpg'}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-[#F4F0E8]">
                              {game.title}
                            </div>
                            <div className="text-[10px] text-[#96929A] font-mono">
                              /games/{game.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Platforms */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {game.platforms.map((p) => (
                            <span
                              key={p}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#242329] border border-[#39363A] text-[9px] font-mono uppercase tracking-wider text-[#C2BEC1]"
                            >
                              {p.toLowerCase().includes('android') ? (
                                <Smartphone className="w-2.5 h-2.5 text-[#FF5A36]" />
                              ) : (
                                <Monitor className="w-2.5 h-2.5 text-[#96929A]" />
                              )}
                              <span>{p}</span>
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <AnimatedBadge status={game.status} size="sm" />
                      </td>

                      {/* Latest Release */}
                      <td className="py-3.5 px-4 font-mono text-xs text-[#FF5A36]">
                        {game.latest_release ? (
                          <span>v{game.latest_release.version_name}</span>
                        ) : (
                          <span className="text-[#96929A]">None yet</span>
                        )}
                      </td>

                      {/* Featured */}
                      <td className="py-3.5 px-4">
                        {game.featured ? (
                          <span className="inline-flex items-center gap-1 text-[#FF5A36] font-bold text-[10px] font-mono uppercase tracking-wider">
                            <Star className="w-3.5 h-3.5 fill-[#FF5A36]" />
                            <span>Featured</span>
                          </span>
                        ) : (
                          <span className="text-[#96929A]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/games/${game.slug}`}
                            className="p-1.5 rounded bg-[#242329] border border-[#39363A] text-[#96929A] hover:text-[#F4F0E8] hover:border-[#FF5A36]/60 transition-colors"
                            title="Preview Public Page"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          <button
                            onClick={() => handleEdit(game)}
                            className="p-1.5 rounded bg-[#242329] border border-[#39363A] text-[#F4F0E8] hover:border-[#FF5A36]/60 transition-colors"
                            title="Edit Game"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(game)}
                            className="p-1.5 rounded bg-[#242329] border border-red-500/30 text-red-400 hover:text-red-300 hover:border-red-500/60 transition-colors"
                            title="Delete Game"
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
              No titles matching &quot;{search}&quot;.
            </div>
          )}
        </div>
      </div>

      {/* Game Edit / Create Modal */}
      <GameFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialGame={selectedGame}
        onSaved={() => {
          showToast(
            'success',
            selectedGame ? 'Game updated successfully!' : 'Game created successfully!'
          );
          loadGames();
        }}
      />

      {/* Game Permanent Deletion Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        game={gameToDelete}
        onClose={() => {
          setDeleteModalOpen(false);
          setGameToDelete(null);
        }}
        onSuccess={(title) => {
          showToast('success', `"${title}" and all associated releases were permanently deleted.`);
          loadGames();
        }}
        onError={(msg) => {
          showToast('error', msg);
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

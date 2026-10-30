import React, { useState } from 'react';
import type { Game } from '../../types';
import { api } from '../../lib/api';
import { AlertTriangle, Trash2, X, Loader2, ShieldAlert } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  game: Game | null;
  onClose: () => void;
  onSuccess: (gameTitle: string) => void;
  onError: (errorMessage: string) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  game,
  onClose,
  onSuccess,
  onError,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !game) return null;

  const handleConfirmDelete = async () => {
    if (isDeleting) return; // Prevent duplicate requests

    try {
      setIsDeleting(true);
      await api.deleteGame(game.id);
      onSuccess(game.title);
      onClose();
    } catch (err: any) {
      onError(err.message || `Failed to delete "${game.title}". Please try again.`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans animate-fade-in">
      <div className="max-w-md w-full bg-[#1A191F] border border-red-500/40 rounded-xl shadow-2xl p-6 sm:p-7 relative overflow-hidden">
        {/* Subtle Ambient Red Glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Close Button */}
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 text-[#96929A] hover:text-[#F4F0E8] p-1.5 rounded transition-colors disabled:opacity-40"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-red-400 font-semibold block mb-0.5">
              CONFIRM TITLE REMOVAL
            </span>
            <h3 className="font-display text-xl font-bold uppercase text-[#F4F0E8] tracking-tight">
              Permanently Delete Game?
            </h3>
          </div>
        </div>

        {/* Target Game Identification Panel */}
        <div className="p-3.5 rounded bg-[#101014] border border-[#39363A] mb-5 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-9 rounded bg-[#242329] border border-[#39363A] overflow-hidden flex-shrink-0">
              <img
                src={game.cover_image || '/uploads/images/default_cover.jpg'}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm text-[#F4F0E8] truncate">
                {game.title}
              </div>
              <div className="text-[11px] font-mono-code text-[#FF5A36] truncate">
                /games/{game.slug}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#39363A]/60 text-[11px] font-mono-code text-[#96929A]">
            <span>STATUS: <span className="text-[#F4F0E8]">{game.status}</span></span>
            <span>PLATFORMS: <span className="text-[#F4F0E8]">{game.platforms.join(', ')}</span></span>
          </div>
        </div>

        {/* Warning Explanation */}
        <div className="text-xs text-[#C2BEC1] leading-relaxed mb-6 space-y-2">
          <p>
            This action will permanently delete <strong className="text-[#F4F0E8]">{game.title}</strong> from the database.
          </p>
          <ul className="text-[11px] text-[#96929A] space-y-1 list-disc list-inside">
            <li>Removed immediately from public homepage showcase</li>
            <li>Removed from public game catalog and search results</li>
            <li>All associated release APK records unlinked</li>
            <li>Direct URL requests will return a 404 Not Found error</li>
          </ul>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded border border-[#39363A] bg-[#242329] hover:bg-[#2c2b33] text-[#C2BEC1] hover:text-[#F4F0E8] text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-red-900/40 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting Title...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Permanent Deletion</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

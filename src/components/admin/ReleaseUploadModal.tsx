import React, { useState, useEffect } from 'react';
import type { Game, Release } from '../../types';
import { api } from '../../lib/api';
import { X, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';

interface ReleaseUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (release: Release) => void;
  games: Game[];
  initialGameId?: string;
  initialRelease?: Release | null;
}

export const ReleaseUploadModal: React.FC<ReleaseUploadModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  games,
  initialGameId,
  initialRelease,
}) => {
  const isEditing = !!initialRelease;

  const [gameId, setGameId] = useState<string>(initialRelease?.game_id || initialGameId || '');
  const [versionName, setVersionName] = useState(initialRelease?.version_name || '1.0.0');
  const [versionCode, setVersionCode] = useState(initialRelease?.version_code || 1);
  const [minSdk, setMinSdk] = useState(initialRelease?.min_sdk || 26);
  const [targetSdk, setTargetSdk] = useState(initialRelease?.target_sdk || 35);
  const [releaseNotes, setReleaseNotes] = useState(
    initialRelease?.release_notes || 'Performance improvements, touch latency optimization, and level adjustments.'
  );
  const [isPublished, setIsPublished] = useState(initialRelease ? initialRelease.is_published : true);

  // APK file upload state
  const [apkFilename, setApkFilename] = useState(initialRelease?.apk_filename || '');
  const [originalFilename, setOriginalFilename] = useState(
    initialRelease?.original_filename || initialRelease?.apk_filename || ''
  );
  const [apkFileSize, setApkFileSize] = useState<number>(initialRelease?.apk_file_size || 0);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(!!initialRelease?.apk_filename);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize modal state whenever opened or when target release/game changes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialRelease) {
        setGameId(initialRelease.game_id || '');
        setVersionName(initialRelease.version_name || '1.0.0');
        setVersionCode(initialRelease.version_code || 1);
        setMinSdk(initialRelease.min_sdk || 26);
        setTargetSdk(initialRelease.target_sdk || 35);
        setReleaseNotes(initialRelease.release_notes || '');
        setIsPublished(initialRelease.is_published ?? true);
        setApkFilename(initialRelease.apk_filename || '');
        setOriginalFilename(initialRelease.original_filename || initialRelease.apk_filename || '');
        setApkFileSize(initialRelease.apk_file_size || 0);
        setUploadSuccess(!!initialRelease.apk_filename);
      } else {
        // Create mode: use initialGameId if provided; otherwise if games has only 1 game, default to it, else empty
        const defaultGameId = initialGameId || '';
        setGameId(defaultGameId);
        setVersionName('1.0.0');
        setVersionCode(1);
        setMinSdk(26);
        setTargetSdk(35);
        setReleaseNotes('Performance improvements, touch latency optimization, and level adjustments.');
        setIsPublished(true);
        setApkFilename('');
        setOriginalFilename('');
        setApkFileSize(0);
        setUploadSuccess(false);
      }
    }
  }, [isOpen, initialRelease, initialGameId]);

  if (!isOpen) return null;

  const handleApkFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.apk')) {
      setError('Only signed Android Package files (.apk) can be uploaded.');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const res = await api.uploadApk(file);
      setApkFilename(res.filename);
      setOriginalFilename(res.original_filename || file.name);
      setApkFileSize(res.size);
      setUploadSuccess(true);
    } catch (err: any) {
      setError(err.message || 'APK upload failed');
      setUploadSuccess(false);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameId || gameId.trim() === '') {
      setError('Please select a game for this release.');
      return;
    }

    const targetGame = games.find((g) => g.id === gameId);
    if (!targetGame) {
      setError('The selected game does not exist or has been removed from the catalog.');
      return;
    }

    if (!apkFilename || apkFilename.trim() === '') {
      setError('Please upload a release APK file.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      game_id: targetGame.id,
      version_name: versionName.trim(),
      version_code: Number(versionCode),
      min_sdk: Number(minSdk),
      target_sdk: Number(targetSdk),
      release_notes: releaseNotes.trim(),
      apk_filename: apkFilename,
      original_filename: originalFilename || apkFilename,
      apk_file_size: apkFileSize,
      is_published: isPublished,
      release_date: new Date().toISOString().split('T')[0],
    };

    try {
      let savedRelease: Release;
      if (isEditing && initialRelease) {
        const res = await api.updateRelease(initialRelease.id, payload);
        savedRelease = res.release;
      } else {
        const res = await api.createRelease(payload);
        savedRelease = res.release;
      }
      onSaved(savedRelease);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save release');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      <div className="relative max-w-xl w-full bg-[#1A191F] border border-[#39363A] rounded-lg shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-[#39363A] flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-[#F4F0E8]">
              {isEditing ? `EDIT RELEASE: v${initialRelease?.version_name}` : 'DEPLOY SIGNED RELEASE APK'}
            </h2>
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#96929A]">
              Production Android binary pipeline
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded bg-[#242329] border border-[#39363A] text-[#96929A] hover:text-[#F4F0E8] hover:border-[#FF5A36]/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-4 rounded bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Game Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="release-target-game"
                className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] font-medium"
              >
                Target Game *
              </label>
              <span className="text-[10px] font-mono text-[#FF5A36]">
                {games.length} {games.length === 1 ? 'title available' : 'titles available'}
              </span>
            </div>
            <select
              id="release-target-game"
              required
              value={gameId}
              onChange={(e) => {
                setGameId(e.target.value);
                if (error) setError(null);
              }}
              className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] cursor-pointer"
            >
              {games.length === 0 ? (
                <option value="" disabled>
                  No games found in catalog
                </option>
              ) : (
                <>
                  <option value="" disabled>
                    Select a game
                  </option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title} {g.platforms && g.platforms.length > 0 ? `(${g.platforms.join(', ')})` : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
            {games.length === 0 ? (
              <p className="text-[11px] font-mono text-amber-400 mt-1.5">
                No games found in catalog. Create a game first in Game Catalog before uploading a release.
              </p>
            ) : !gameId ? (
              <p className="text-[10px] font-mono text-[#96929A] mt-1">
                Select the target game from your catalog to attach this APK binary release.
              </p>
            ) : null}
          </div>

          {/* Real APK Upload Area */}
          <div className="space-y-2">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] font-medium">
              Signed Release APK Binary *
            </label>

            <div className="relative border border-dashed border-[#39363A] rounded-md p-6 text-center hover:border-[#FF5A36]/60 transition-colors bg-[#0A0A0D]">
              {uploading ? (
                <div className="py-4 space-y-2">
                  <div className="w-8 h-8 border-2 border-[#FF5A36] border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="text-xs font-mono uppercase tracking-wider text-[#FF5A36]">
                    Uploading &amp; Verifying APK Binary...
                  </div>
                </div>
              ) : uploadSuccess ? (
                <div className="space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#34D399] mx-auto" />
                  <div className="text-xs font-mono text-[#F4F0E8] font-bold break-all" title={originalFilename || apkFilename}>
                    {originalFilename || apkFilename}
                  </div>
                  <div className="text-[11px] font-mono text-[#96929A]">
                    File Size: {(apkFileSize / 1024 / 1024).toFixed(2)} MB ({apkFileSize.toLocaleString()} bytes)
                  </div>
                  <label className="inline-block mt-2 text-xs font-mono uppercase tracking-wider text-[#FF5A36] hover:text-[#F4F0E8] cursor-pointer">
                    Replace APK Binary
                    <input
                      type="file"
                      accept=".apk"
                      onChange={handleApkFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <UploadCloud className="w-8 h-8 text-[#FF5A36] mx-auto" />
                  <div className="text-xs text-[#F4F0E8]">
                    Drag and drop release APK, or <span className="text-[#FF5A36] font-bold">browse</span>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#96929A]">
                    Signed production APKs only. Max size: 150 MB.
                  </div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 mt-2 rounded bg-[#242329] border border-[#39363A] text-[#F4F0E8] hover:border-[#FF5A36]/60 text-xs font-mono uppercase tracking-wider cursor-pointer transition-colors">
                    <span>Choose .APK File</span>
                    <input
                      type="file"
                      accept=".apk"
                      onChange={handleApkFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Version Specs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                Version Name *
              </label>
              <input
                type="text"
                required
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="1.0.0"
                className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] font-mono focus:border-[#FF5A36]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                Version Code (Build #) *
              </label>
              <input
                type="number"
                required
                min={1}
                value={versionCode}
                onChange={(e) => setVersionCode(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] font-mono focus:border-[#FF5A36]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                Minimum SDK (API Level)
              </label>
              <input
                type="number"
                value={minSdk}
                onChange={(e) => setMinSdk(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] font-mono focus:border-[#FF5A36]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                Target SDK (API Level)
              </label>
              <input
                type="number"
                value={targetSdk}
                onChange={(e) => setTargetSdk(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] font-mono focus:border-[#FF5A36]"
              />
            </div>
          </div>

          {/* Release Notes */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
              Release Notes &amp; Changelog
            </label>
            <textarea
              rows={3}
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="Highlight bug fixes, new features, or level additions..."
              className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] focus:border-[#FF5A36] resize-none"
            />
          </div>

          {/* Publish Toggle */}
          <div className="flex items-center gap-3 p-3.5 rounded bg-[#0A0A0D] border border-[#39363A]">
            <input
              type="checkbox"
              id="publishCheckbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="w-4 h-4 accent-[#FF5A36]"
            />
            <label htmlFor="publishCheckbox" className="text-xs uppercase tracking-wider font-semibold text-[#F4F0E8] cursor-pointer">
              Publish immediately on public website and enable APK downloads
            </label>
          </div>

          {/* Submit Actions */}
          <div className="pt-3 border-t border-[#39363A] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-[#242329] border border-[#39363A] text-xs font-mono uppercase tracking-wider text-[#96929A] hover:text-[#F4F0E8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-5 py-2 bg-[#FF5A36] text-[#101014] font-bold text-xs uppercase tracking-[0.16em] rounded transition-all hover:brightness-110 active:scale-95 shadow-[0_2px_12px_rgba(255,90,54,0.3)] disabled:opacity-50"
            >
              {saving ? 'Processing...' : isEditing ? 'Save Changes' : 'Deploy Release'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

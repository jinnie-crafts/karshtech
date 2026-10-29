import React, { useState } from 'react';
import type { Game, Platform, ReleaseStatus } from '../../types';
import { api } from '../../lib/api';
import { X, Upload, Plus, Trash2, Image as ImageIcon } from 'lucide-react';

interface GameFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (game: Game) => void;
  initialGame?: Game | null;
}

export const GameFormModal: React.FC<GameFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialGame,
}) => {
  const isEditing = !!initialGame;

  const [title, setTitle] = useState(initialGame?.title || '');
  const [slug, setSlug] = useState(initialGame?.slug || '');
  const [tagline, setTagline] = useState(initialGame?.tagline || '');
  const [description, setDescription] = useState(initialGame?.description || '');
  const [genreText, setGenreText] = useState(initialGame?.genre.join(', ') || 'Puzzle, Logic');
  const [platforms, setPlatforms] = useState<Platform[]>(initialGame?.platforms || ['Android']);
  const [status, setStatus] = useState<ReleaseStatus>(initialGame?.status || 'Available');
  const [featured, setFeatured] = useState<boolean>(initialGame?.featured || false);
  const [developer, setDeveloper] = useState(initialGame?.developer || 'Karsh Tech');

  // Media
  const [coverImage, setCoverImage] = useState(initialGame?.cover_image || '/uploads/images/default_cover.jpg');
  const [screenshots, setScreenshots] = useState<string[]>(initialGame?.screenshots || []);

  // Features & Controls
  const [features, setFeatures] = useState<string[]>(initialGame?.features || ['Tactile Directional Mechanics']);
  const [newFeature, setNewFeature] = useState('');

  const [controls, setControls] = useState<string[]>(initialGame?.controls || ['Tap an arrow to attempt its release']);
  const [newControl, setNewControl] = useState('');

  // Specs
  const [minAndroid, setMinAndroid] = useState(initialGame?.requirements.min_android || 'Android 8.0 (API 26)');
  const [targetAndroid, setTargetAndroid] = useState(initialGame?.requirements.target_android || 'Android 15 (API 35)');
  const [storage, setStorage] = useState(initialGame?.requirements.storage || '25 MB');
  const [ram, setRam] = useState(initialGame?.requirements.ram || '2 GB');
  const [internet, setInternet] = useState(initialGame?.requirements.internet || 'None (100% Offline)');

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingShot, setUploadingShot] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isEditing && (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingCover(true);
      setError(null);
      const res = await api.uploadImage(file);
      setCoverImage(res.url);
    } catch (err: any) {
      setError(err.message || 'Cover upload failed');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingShot(true);
      setError(null);
      const res = await api.uploadImage(file);
      setScreenshots((prev) => [...prev, res.url]);
    } catch (err: any) {
      setError(err.message || 'Screenshot upload failed');
    } finally {
      setUploadingShot(false);
    }
  };

  const handleTogglePlatform = (p: Platform) => {
    if (platforms.includes(p)) {
      if (platforms.length > 1) {
        setPlatforms(platforms.filter((item) => item !== p));
      }
    } else {
      setPlatforms([...platforms, p]);
    }
  };

  const handleAddFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (idx: number) => {
    setFeatures(features.filter((_, i) => i !== idx));
  };

  const handleAddControl = () => {
    if (newControl.trim()) {
      setControls([...controls, newControl.trim()]);
      setNewControl('');
    }
  };

  const handleRemoveControl = (idx: number) => {
    setControls(controls.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const genreList = genreText
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    const gamePayload = {
      title,
      slug: slug.trim(),
      tagline,
      description,
      genre: genreList,
      platforms,
      status,
      featured,
      cover_image: coverImage,
      screenshots,
      features,
      controls,
      developer,
      requirements: {
        min_android: minAndroid,
        target_android: targetAndroid,
        storage,
        ram,
        internet,
      },
    };

    try {
      let savedGame: Game;
      if (isEditing && initialGame) {
        const res = await api.updateGame(initialGame.id, gamePayload);
        savedGame = res.game;
      } else {
        const res = await api.createGame(gamePayload);
        savedGame = res.game;
      }
      onSaved(savedGame);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save game');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      <div className="relative max-w-4xl w-full bg-[#1A191F] border border-[#39363A] rounded-lg shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-[#39363A] flex items-center justify-between sticky top-0 bg-[#1A191F] z-20">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F4F0E8]">
              {isEditing ? `EDIT TITLE: ${initialGame?.title}` : 'PUBLISH NEW GAME TITLE'}
            </h2>
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#96929A]">
              Catalog metadata, visual assets &amp; specifications
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded bg-[#242329] border border-[#39363A] text-[#96929A] hover:text-[#F4F0E8] hover:border-[#FF5A36]/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-4 rounded bg-red-950/40 border border-red-500/40 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="font-display text-sm font-bold tracking-wider text-[#FF5A36] uppercase">
              1. Title &amp; Core Classification
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                  Game Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Arrow Puzzle"
                  className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                  Public URL Slug *
                </label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. arrow-puzzle"
                  className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] font-mono transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                Tagline / Elevator Pitch
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="A Calming, Tactile Logic Puzzle for Mindful Focus"
                className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                Detailed Description *
              </label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe core mechanics, design philosophy, aesthetic ambiance..."
                className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                  Genres (Comma Separated)
                </label>
                <input
                  type="text"
                  value={genreText}
                  onChange={(e) => setGenreText(e.target.value)}
                  placeholder="Puzzle, Minimalist, Indie"
                  className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                  Release Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ReleaseStatus)}
                  className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36]"
                >
                  <option value="Available">Available (Live)</option>
                  <option value="Beta">Beta (Testing)</option>
                  <option value="Coming Soon">Coming Soon</option>
                  <option value="In Development">In Development</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1.5 font-medium">
                  Studio Lead / Dev
                </label>
                <input
                  type="text"
                  value={developer}
                  onChange={(e) => setDeveloper(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36]"
                />
              </div>
            </div>

            {/* Platforms & Featured */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
              <div>
                <span className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-2 font-medium">
                  Target Platforms
                </span>
                <div className="flex items-center gap-2">
                  {(['Android', 'PC', 'Web'] as Platform[]).map((p) => {
                    const active = platforms.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleTogglePlatform(p)}
                        className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider font-semibold transition-all ${
                          active
                            ? 'bg-[#FF5A36] text-[#101014]'
                            : 'bg-[#242329] border border-[#39363A] text-[#96929A] hover:text-[#F4F0E8]'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded bg-[#0A0A0D] border border-[#39363A]">
                <input
                  type="checkbox"
                  id="featuredToggle"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-4 h-4 accent-[#FF5A36]"
                />
                <label htmlFor="featuredToggle" className="text-xs uppercase tracking-wider font-semibold text-[#F4F0E8] cursor-pointer">
                  Featured on Homepage Showcase
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Media Assets */}
          <div className="space-y-4 pt-4 border-t border-[#39363A]">
            <h3 className="font-display text-sm font-bold tracking-wider text-[#FF5A36] uppercase">
              2. Promotional Visual Assets
            </h3>

            {/* Cover Image */}
            <div className="space-y-2">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] font-medium">
                Cover / Hero Image
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded bg-[#0A0A0D] border border-[#39363A]">
                <div className="w-32 h-20 rounded bg-[#101014] border border-[#39363A] overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {coverImage ? (
                    <img src={coverImage} alt="Cover preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-[#96929A]" />
                  )}
                </div>
                <div className="space-y-2 text-center sm:text-left flex-1">
                  <div className="text-xs text-[#C2BEC1]">
                    Recommended 1920x1080 or 16:9 banner PNG / JPG.
                  </div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#242329] border border-[#39363A] text-xs font-mono uppercase tracking-wider text-[#F4F0E8] hover:border-[#FF5A36]/60 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-[#FF5A36]" />
                    <span>{uploadingCover ? 'Uploading...' : 'Upload Cover'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      disabled={uploadingCover}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Screenshot Gallery */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] font-medium">
                  Gameplay Screenshots ({screenshots.length})
                </label>
                <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#242329] border border-[#39363A] text-[11px] font-mono uppercase tracking-wider text-[#F4F0E8] hover:border-[#FF5A36]/60 cursor-pointer transition-colors">
                  <Upload className="w-3 h-3 text-[#FF5A36]" />
                  <span>{uploadingShot ? 'Uploading...' : 'Add Screenshot'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotUpload}
                    disabled={uploadingShot}
                    className="hidden"
                  />
                </label>
              </div>

              {screenshots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {screenshots.map((s, idx) => (
                    <div key={idx} className="relative group rounded bg-[#0A0A0D] border border-[#39363A] overflow-hidden aspect-[9/16]">
                      <img src={s} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setScreenshots(screenshots.filter((_, i) => i !== idx))}
                        className="absolute top-1.5 right-1.5 p-1 rounded bg-black/80 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove screenshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs font-mono text-[#96929A] rounded bg-[#0A0A0D] border border-dashed border-[#39363A]">
                  No screenshots uploaded yet.
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Features */}
          <div className="space-y-3 pt-4 border-t border-[#39363A]">
            <h3 className="font-display text-sm font-bold tracking-wider text-[#FF5A36] uppercase">
              3. Key Gameplay Features
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}
                placeholder="e.g. Tactile Directional Mechanics"
                className="flex-1 px-3.5 py-2 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] focus:border-[#FF5A36]"
              />
              <button
                type="button"
                onClick={handleAddFeature}
                className="px-4 py-2 rounded bg-[#242329] border border-[#39363A] text-xs font-mono text-[#F4F0E8] hover:border-[#FF5A36]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {features.map((feat, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#242329] border border-[#39363A] text-xs text-[#C2BEC1]"
                >
                  <span>{feat}</span>
                  <button type="button" onClick={() => handleRemoveFeature(idx)} className="text-[#96929A] hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Section 4: Controls */}
          <div className="space-y-3 pt-4 border-t border-[#39363A]">
            <h3 className="font-display text-sm font-bold tracking-wider text-[#FF5A36] uppercase">
              4. Control Schema
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newControl}
                onChange={(e) => setNewControl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddControl())}
                placeholder="e.g. Tap an arrow to release"
                className="flex-1 px-3.5 py-2 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] focus:border-[#FF5A36]"
              />
              <button
                type="button"
                onClick={handleAddControl}
                className="px-4 py-2 rounded bg-[#242329] border border-[#39363A] text-xs font-mono text-[#F4F0E8] hover:border-[#FF5A36]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {controls.map((ctrl, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#242329] border border-[#39363A] text-xs text-[#C2BEC1]"
                >
                  <span>{ctrl}</span>
                  <button type="button" onClick={() => handleRemoveControl(idx)} className="text-[#96929A] hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Section 5: Technical Specs */}
          <div className="space-y-4 pt-4 border-t border-[#39363A]">
            <h3 className="font-display text-sm font-bold tracking-wider text-[#FF5A36] uppercase">
              5. Runtime Specifications
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1">Min Android</label>
                <input
                  type="text"
                  value={minAndroid}
                  onChange={(e) => setMinAndroid(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] font-mono focus:border-[#FF5A36]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1">Target Android</label>
                <input
                  type="text"
                  value={targetAndroid}
                  onChange={(e) => setTargetAndroid(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] font-mono focus:border-[#FF5A36]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1">Required Storage</label>
                <input
                  type="text"
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] font-mono focus:border-[#FF5A36]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#96929A] mb-1">Network Requirement</label>
                <input
                  type="text"
                  value={internet}
                  onChange={(e) => setInternet(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] font-mono focus:border-[#FF5A36]"
                />
              </div>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-[#39363A] flex items-center justify-end gap-3 sticky bottom-0 bg-[#1A191F] py-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-[#242329] border border-[#39363A] text-xs font-mono uppercase tracking-wider text-[#96929A] hover:text-[#F4F0E8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#FF5A36] text-[#101014] font-bold text-xs uppercase tracking-[0.16em] rounded transition-all hover:brightness-110 active:scale-95 shadow-[0_2px_12px_rgba(255,90,54,0.3)] disabled:opacity-50"
            >
              {saving ? 'Processing...' : isEditing ? 'Update Game Listing' : 'Publish Game Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

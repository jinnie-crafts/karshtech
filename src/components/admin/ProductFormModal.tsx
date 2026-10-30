import React, { useState } from 'react';
import type { Product, ProductCategory, ProductPlatform, ProductStatus } from '../../types';
import { api } from '../../lib/api';
import { X, Upload, Plus, Trash2, Image as ImageIcon, Globe, GitBranch, Smartphone, Download, Loader2 } from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (product: Product) => void;
  initialProduct?: Product | null;
}

const CATEGORIES: ProductCategory[] = [
  'Websites',
  'Web Applications',
  'Mobile Applications',
  'Games',
  'Custom Software',
];

const PLATFORMS: ProductPlatform[] = [
  'Web',
  'Android',
  'iOS',
  'Desktop',
  'Cross-platform',
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialProduct,
}) => {
  const isEditing = !!initialProduct;

  // Form State
  const [name, setName] = useState(initialProduct?.name || '');
  const [slug, setSlug] = useState(initialProduct?.slug || '');
  const [shortDescription, setShortDescription] = useState(initialProduct?.short_description || '');
  const [description, setDescription] = useState(initialProduct?.description || '');
  const [category, setCategory] = useState<ProductCategory>(initialProduct?.category || 'Web Applications');
  const [platform, setPlatform] = useState<ProductPlatform>(initialProduct?.platform || 'Web');
  const [technologiesText, setTechnologiesText] = useState(initialProduct?.technologies?.join(', ') || 'React, TypeScript, Node.js');
  
  // URLs
  const [projectUrl, setProjectUrl] = useState(initialProduct?.project_url || '');
  const [githubUrl, setGithubUrl] = useState(initialProduct?.github_url || '');
  const [playStoreUrl, setPlayStoreUrl] = useState(initialProduct?.play_store_url || '');
  const [apkDownloadUrl, setApkDownloadUrl] = useState(initialProduct?.apk_download_url || '');

  // Media
  const [coverImage, setCoverImage] = useState(initialProduct?.cover_image || '/brand/karsh-tech-k.png');
  const [gallery, setGallery] = useState<string[]>(initialProduct?.gallery || []);

  // Settings
  const [status, setStatus] = useState<ProductStatus>(initialProduct?.status || 'Published');
  const [featured, setFeatured] = useState<boolean>(initialProduct?.featured || false);
  const [displayOrder, setDisplayOrder] = useState<number>(initialProduct?.display_order || 0);

  // States
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing && (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      );
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

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingGallery(true);
      setError(null);
      const res = await api.uploadImage(file);
      setGallery((prev) => [...prev, res.url]);
    } catch (err: any) {
      setError(err.message || 'Gallery image upload failed');
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = (idx: number) => {
    setGallery((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const trimmedName = name.trim();
    const trimmedSlug = (slug || trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();
    const trimmedDesc = description.trim();

    if (!trimmedName) {
      setError('Product Name is required.');
      return;
    }
    if (!trimmedSlug) {
      setError('URL Slug is required.');
      return;
    }
    if (!trimmedDesc) {
      setError('Full Description is required.');
      return;
    }

    const techList = technologiesText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setSaving(true);
    setError(null);

    const payload: Partial<Product> = {
      name: trimmedName,
      slug: trimmedSlug,
      short_description: shortDescription.trim() || trimmedName,
      description: trimmedDesc,
      category,
      platform,
      technologies: techList,
      cover_image: coverImage || '/brand/karsh-tech-k.png',
      gallery,
      project_url: projectUrl.trim() || undefined,
      github_url: githubUrl.trim() || undefined,
      play_store_url: playStoreUrl.trim() || undefined,
      apk_download_url: apkDownloadUrl.trim() || undefined,
      status,
      featured,
      display_order: Number(displayOrder) || 0,
    };

    try {
      if (isEditing && initialProduct) {
        const res = await api.updateProduct(initialProduct.id, payload);
        onSaved(res.product);
      } else {
        const res = await api.createProduct(payload);
        onSaved(res.product);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product. Please verify fields and retry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans animate-fade-in">
      <div className="max-w-3xl w-full bg-[#1A191F] border border-[#39363A] rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#39363A] flex items-center justify-between flex-shrink-0 bg-[#141318]">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
            <h2 className="font-display font-bold text-lg uppercase tracking-tight text-[#F4F0E8]">
              {isEditing ? `Edit Product // ${initialProduct.name}` : 'Add New Product'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-[#96929A] hover:text-[#F4F0E8] p-1.5 rounded transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded bg-red-950/30 border border-red-500/50 text-xs text-red-200 font-mono-code flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-[10px] tracking-wider uppercase text-red-400 hover:text-white ml-2"
              >
                DISMISS
              </button>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <div className="text-[10px] font-mono-code uppercase tracking-wider text-[#FF5A36] font-semibold border-b border-[#39363A]/40 pb-1.5">
              // 01. BASIC INFORMATION
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Karsh Analytics Dashboard"
                  className="w-full px-3.5 py-2 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] focus:border-[#FF5A36] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold">
                  URL Slug *
                </label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                  placeholder="e.g. karsh-analytics-dashboard"
                  className="w-full px-3.5 py-2 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] font-mono-code focus:border-[#FF5A36] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ProductCategory)}
                  className="w-full px-3.5 py-2 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] focus:border-[#FF5A36] focus:outline-none transition-colors cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#1A191F]">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold">
                  Primary Platform *
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as ProductPlatform)}
                  className="w-full px-3.5 py-2 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] focus:border-[#FF5A36] focus:outline-none transition-colors cursor-pointer"
                >
                  {PLATFORMS.map((plat) => (
                    <option key={plat} value={plat} className="bg-[#1A191F]">
                      {plat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold">
                Short Tagline / Summary *
              </label>
              <input
                type="text"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="High-level single-sentence summary of the product..."
                className="w-full px-3.5 py-2 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] focus:border-[#FF5A36] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold">
                Full Product Description *
              </label>
              <textarea
                required
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Comprehensive technical write-up, architecture notes, problems solved, and capabilities..."
                className="w-full px-3.5 py-2.5 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] focus:border-[#FF5A36] focus:outline-none transition-colors leading-relaxed resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold">
                Technologies / Stack (Comma-separated)
              </label>
              <input
                type="text"
                value={technologiesText}
                onChange={(e) => setTechnologiesText(e.target.value)}
                placeholder="e.g. React 19, TypeScript, Kotlin, Node.js, Tailwind CSS"
                className="w-full px-3.5 py-2 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] font-mono-code focus:border-[#FF5A36] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Section 2: Visual Assets */}
          <div className="space-y-4">
            <div className="text-[10px] font-mono-code uppercase tracking-wider text-[#FF5A36] font-semibold border-b border-[#39363A]/40 pb-1.5">
              // 02. VISUAL ASSETS
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] font-semibold">
                Cover Image Thumbnail
              </label>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="w-28 h-20 rounded-lg border border-[#39363A] bg-[#101014] overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {coverImage ? (
                    <img src={coverImage} alt="Cover Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-[#96929A]" />
                  )}
                </div>
                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#242329] border border-[#39363A] hover:border-[#FF5A36] text-[#F4F0E8] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-[#FF5A36]" />
                      <span>{uploadingCover ? 'Uploading...' : 'Upload Image'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleCoverUpload}
                        disabled={uploadingCover}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[10px] text-[#96929A] font-mono-code">or paste URL:</span>
                  </div>
                  <input
                    type="text"
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                    placeholder="https://... or /uploads/images/..."
                    className="w-full px-3 py-1.5 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] font-mono-code focus:border-[#FF5A36] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Gallery Screenshots */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] font-semibold">
                  Additional Screenshots / Gallery ({gallery.length})
                </label>
                <label className="inline-flex items-center gap-1 text-[10px] font-mono-code text-[#FF5A36] hover:text-[#FF7454] cursor-pointer">
                  <Plus className="w-3 h-3" />
                  <span>{uploadingGallery ? 'Uploading...' : 'Add Screenshot'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGalleryUpload}
                    disabled={uploadingGallery}
                    className="hidden"
                  />
                </label>
              </div>

              {gallery.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {gallery.map((imgUrl, idx) => (
                    <div key={idx} className="relative aspect-video rounded border border-[#39363A] bg-[#101014] overflow-hidden group">
                      <img src={imgUrl} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(idx)}
                        className="absolute top-1 right-1 p-1 rounded bg-black/80 text-red-400 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove screenshot"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] font-mono-code text-[#96929A]">No extra gallery screenshots attached.</p>
              )}
            </div>
          </div>

          {/* Section 3: Project Links & Delivery */}
          <div className="space-y-4">
            <div className="text-[10px] font-mono-code uppercase tracking-wider text-[#FF5A36] font-semibold border-b border-[#39363A]/40 pb-1.5">
              // 03. EXTERNAL &amp; DISTRIBUTION LINKS
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-[#FF5A36]" />
                  <span>Live Project URL (Optional)</span>
                </label>
                <input
                  type="url"
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3.5 py-2 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] font-mono-code focus:border-[#FF5A36] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold flex items-center gap-1.5">
                  <GitBranch className="w-3 h-3 text-[#FF5A36]" />
                  <span>GitHub Repository (Optional)</span>
                </label>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full px-3.5 py-2 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] font-mono-code focus:border-[#FF5A36] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3 text-[#FF5A36]" />
                  <span>Google Play Store URL (Optional)</span>
                </label>
                <input
                  type="url"
                  value={playStoreUrl}
                  onChange={(e) => setPlayStoreUrl(e.target.value)}
                  placeholder="https://play.google.com/store/apps/..."
                  className="w-full px-3.5 py-2 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] font-mono-code focus:border-[#FF5A36] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold flex items-center gap-1.5">
                  <Download className="w-3 h-3 text-[#FF5A36]" />
                  <span>APK Download Link (Optional)</span>
                </label>
                <input
                  type="text"
                  value={apkDownloadUrl}
                  onChange={(e) => setApkDownloadUrl(e.target.value)}
                  placeholder="/api/releases/.../download or URL"
                  className="w-full px-3.5 py-2 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] font-mono-code focus:border-[#FF5A36] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Publishing Settings */}
          <div className="space-y-4">
            <div className="text-[10px] font-mono-code uppercase tracking-wider text-[#FF5A36] font-semibold border-b border-[#39363A]/40 pb-1.5">
              // 04. PUBLISHING &amp; VISIBILITY SETTINGS
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div>
                <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProductStatus)}
                  className="w-full px-3.5 py-2 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] focus:border-[#FF5A36] focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="Published" className="bg-[#1A191F]">Published (Visible Publicly)</option>
                  <option value="Draft" className="bg-[#1A191F]">Draft (Hidden from Public)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] mb-1 font-semibold">
                  Display Order
                </label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] font-mono-code focus:border-[#FF5A36] focus:outline-none"
                />
              </div>

              <div className="pt-4 sm:pt-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="w-4 h-4 rounded border-[#39363A] text-[#FF5A36] focus:ring-0 bg-[#101014]"
                  />
                  <span className="text-xs font-semibold text-[#F4F0E8]">Feature on Products Page</span>
                </label>
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#39363A] bg-[#141318] flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-[#C2BEC1] hover:text-[#F4F0E8] border border-[#39363A] hover:bg-[#242329] transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-md shadow-[#FF5A36]/20 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Product...</span>
              </>
            ) : (
              <span>{isEditing ? 'Save Changes' : 'Create Product'}</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

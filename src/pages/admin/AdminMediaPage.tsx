import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { ToastContainer, type ToastMessage } from '../../components/admin/Toast';
import { api } from '../../lib/api';
import type { MediaAsset, MediaStats, MediaBucket, Game, Product } from '../../types';
import {
  UploadCloud,
  Image as ImageIcon,
  Images,
  FolderLock,
  Lock,
  Unlock,
  Shield,
  Trash2,
  Copy,
  Check,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Eye,
  Grid,
  List,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  AlertTriangle,
  Info,
  Layers,
  Gamepad2,
  Package,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i >= 2 ? 2 : 1)} ${sizes[i]}`;
}

export const AdminMediaPage: React.FC = () => {
  // Navigation & View
  const [activeTab, setActiveTab] = useState<
    'images' | 'apks' | 'screenshots' | 'galleries' | 'upload'
  >('images');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Data
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [bucketFilter, setBucketFilter] = useState<'all' | 'game-assets' | 'product-assets'>('all');
  const [associationFilter, setAssociationFilter] = useState<'all' | 'associated' | 'unassociated'>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'size_desc' | 'size_asc'>('date_desc');

  // Modals & Inspect
  const [inspectAsset, setInspectAsset] = useState<MediaAsset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<MediaAsset | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Screenshot & Gallery Management State
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [reorderingInProgress, setReorderingInProgress] = useState(false);
  const [attachUrlInput, setAttachUrlInput] = useState('');
  const [showAttachUrlModal, setShowAttachUrlModal] = useState(false);
  const [attachTargetType, setAttachTargetType] = useState<'game' | 'product'>('game');

  // Upload Manager State
  const [uploadBucket, setUploadBucket] = useState<MediaBucket>('game-assets');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessUrl, setUploadSuccessUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Copy Clipboard Helper
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Load Data
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const [mediaRes, statsRes, gamesRes, productsRes] = await Promise.all([
        api.getAdminMedia({ sort: sortBy }),
        api.getAdminMediaStats(),
        api.getGames(),
        api.getAdminProducts(),
      ]);

      setAssets(mediaRes.assets || []);
      setStats(statsRes.stats || null);
      setGames(gamesRes || []);
      setProducts(productsRes || []);

      if (gamesRes.length > 0 && !selectedGameId) {
        setSelectedGameId(gamesRes[0].id);
      }
      if (productsRes.length > 0 && !selectedProductId) {
        setSelectedProductId(productsRes[0].id);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load media assets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sortBy, selectedGameId, selectedProductId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Copy to clipboard helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    showToast('success', 'URL copied to clipboard');
    setTimeout(() => {
      setCopiedUrl(null);
    }, 2500);
  };

  // Filtered Assets for Images Tab
  const imageAssets = useMemo(() => {
    return assets.filter((a) => {
      if (a.bucket === 'release-apks') return false;
      if (bucketFilter !== 'all' && a.bucket !== bucketFilter) return false;
      if (associationFilter === 'associated' && !a.is_referenced) return false;
      if (associationFilter === 'unassociated' && a.is_referenced) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.path.toLowerCase().includes(q);
      }
      return true;
    });
  }, [assets, bucketFilter, associationFilter, searchQuery]);

  // Filtered Assets for APKs Tab
  const apkAssets = useMemo(() => {
    return assets.filter((a) => {
      if (a.bucket !== 'release-apks') return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.path.toLowerCase().includes(q);
      }
      return true;
    });
  }, [assets, searchQuery]);

  // Selected Game and Product for screenshot / gallery tabs
  const activeGame = useMemo(() => {
    return games.find((g) => g.id === selectedGameId) || games[0];
  }, [games, selectedGameId]);

  const activeProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  // Delete Action Handler
  const handleDeleteConfirm = async () => {
    if (!assetToDelete) return;
    if (assetToDelete.is_protected) {
      showToast('error', `Cannot delete protected production asset "${assetToDelete.name}".`);
      setDeleteConfirmOpen(false);
      return;
    }
    if (assetToDelete.is_referenced) {
      showToast('error', `Cannot delete asset "${assetToDelete.name}". It is actively referenced by database entities.`);
      setDeleteConfirmOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await api.deleteAdminMedia(assetToDelete.bucket, assetToDelete.path);
      showToast('success', res.message || 'Asset deleted successfully.');
      setDeleteConfirmOpen(false);
      setInspectAsset(null);
      setAssetToDelete(null);
      await loadData(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete asset');
    } finally {
      setIsDeleting(false);
    }
  };

  // Upload File Handler
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setUploadError(null);
    setUploadSuccessUrl(null);

    const isApk = file.name.toLowerCase().endsWith('.apk');
    if (uploadBucket === 'release-apks') {
      if (!isApk) {
        setUploadError('Only .apk Android packages are allowed in release-apks bucket.');
        setSelectedFile(null);
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setUploadError(`APK exceeds maximum size of 50 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
        setSelectedFile(null);
        return;
      }
    } else {
      if (isApk) {
        setUploadError('APK packages must be uploaded to the private "release-apks" bucket.');
        setSelectedFile(null);
        return;
      }
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
      if (!allowed.includes(ext)) {
        setUploadError(`Invalid image extension. Allowed: PNG, JPG, JPEG, WEBP, GIF.`);
        setSelectedFile(null);
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setUploadError(`Image exceeds maximum size of 15 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
        setSelectedFile(null);
        return;
      }
    }

    setSelectedFile(file);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadProgress(25);
    setUploadError(null);
    setUploadSuccessUrl(null);

    try {
      setUploadProgress(50);
      if (uploadBucket === 'release-apks') {
        const res = await api.uploadApk(selectedFile);
        setUploadProgress(100);
        showToast('success', `APK "${res.filename}" uploaded successfully to private storage.`);
        setUploadSuccessUrl(`/api/releases (stored: ${res.filename})`);
      } else {
        const res = await api.uploadImage(selectedFile, uploadBucket);
        setUploadProgress(100);
        showToast('success', `Image "${res.filename}" uploaded successfully to ${uploadBucket}.`);
        setUploadSuccessUrl(res.url);
      }

      setSelectedFile(null);
      await loadData(true);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
      showToast('error', err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 1000);
    }
  };

  // Screenshot Reordering Handlers
  const handleReorderScreenshot = async (index: number, direction: 'up' | 'down') => {
    if (!activeGame || !activeGame.screenshots) return;
    const list = [...activeGame.screenshots];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Swap
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    setReorderingInProgress(true);
    try {
      const res = await api.reorderGameScreenshots(activeGame.id, list);
      showToast('success', 'Screenshots reordered successfully.');
      setGames((prev) =>
        prev.map((g) => (g.id === activeGame.id ? { ...g, screenshots: res.screenshots } : g))
      );
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reorder screenshots');
    } finally {
      setReorderingInProgress(false);
    }
  };

  const handleDetachScreenshot = async (url: string) => {
    if (!activeGame) return;
    if (!window.confirm('Detach this screenshot from the game? The storage asset will remain safely in the Media Library.')) {
      return;
    }

    try {
      const res = await api.removeGameScreenshot(activeGame.id, url);
      showToast('success', 'Screenshot detached from game (storage object preserved).');
      setGames((prev) =>
        prev.map((g) => (g.id === activeGame.id ? { ...g, screenshots: res.screenshots } : g))
      );
      await loadData(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to detach screenshot');
    }
  };

  // Product Gallery Reordering Handlers
  const handleReorderGallery = async (index: number, direction: 'up' | 'down') => {
    if (!activeProduct || !activeProduct.gallery) return;
    const list = [...activeProduct.gallery];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Swap
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    setReorderingInProgress(true);
    try {
      const res = await api.reorderProductGallery(activeProduct.id, list);
      showToast('success', 'Gallery images reordered successfully.');
      setProducts((prev) =>
        prev.map((p) => (p.id === activeProduct.id ? { ...p, gallery: res.gallery } : p))
      );
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reorder gallery');
    } finally {
      setReorderingInProgress(false);
    }
  };

  const handleDetachGalleryImage = async (url: string) => {
    if (!activeProduct) return;
    if (!window.confirm('Detach this image from the product gallery? The storage asset will remain safely in the Media Library.')) {
      return;
    }

    try {
      const res = await api.removeProductGalleryImage(activeProduct.id, url);
      showToast('success', 'Image detached from gallery (storage object preserved).');
      setProducts((prev) =>
        prev.map((p) => (p.id === activeProduct.id ? { ...p, gallery: res.gallery } : p))
      );
      await loadData(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to detach gallery image');
    }
  };

  // Direct Attachment Handler
  const handleAttachSubmit = async () => {
    if (!attachUrlInput.trim()) return;
    const url = attachUrlInput.trim();

    try {
      if (attachTargetType === 'game' && activeGame) {
        const res = await api.addGameScreenshot(activeGame.id, url);
        showToast('success', `Attached screenshot to ${activeGame.title}.`);
        setGames((prev) =>
          prev.map((g) => (g.id === activeGame.id ? { ...g, screenshots: res.screenshots } : g))
        );
      } else if (attachTargetType === 'product' && activeProduct) {
        const res = await api.addProductGalleryImage(activeProduct.id, url);
        showToast('success', `Attached image to ${activeProduct.name} gallery.`);
        setProducts((prev) =>
          prev.map((p) => (p.id === activeProduct.id ? { ...p, gallery: res.gallery } : p))
        );
      }
      setShowAttachUrlModal(false);
      setAttachUrlInput('');
      await loadData(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to attach image');
    }
  };

  return (
    <AdminLayout title="Media Library">
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#242329] pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF5A36]/10 border border-[#FF5A36]/30 flex items-center justify-center text-[#FF5A36]">
                <Images className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#F4F0E8]">
                  Media & Asset Manager
                </h1>
                <p className="text-sm text-[#94908D]">
                  Centralized Supabase Storage orchestration, reference safeguards, and game/product gallery asset management.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#1A191F] border border-[#242329] text-xs font-medium text-[#F4F0E8] hover:border-[#FF5A36]/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#FF5A36]' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5A36] text-black text-xs font-bold hover:bg-[#ff6f4f] transition-colors shadow-lg shadow-[#FF5A36]/20"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Asset
            </button>
          </div>
        </div>

        {/* Section 1: Overview & Metrics */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="p-4 rounded-xl bg-[#1A191F] border border-[#242329] relative overflow-hidden">
              <div className="text-xs uppercase tracking-wider text-[#94908D] font-mono mb-1">
                Total Storage
              </div>
              <div className="text-xl font-bold font-mono text-[#F4F0E8]">
                {formatBytes(stats.total_storage_bytes)}
              </div>
              <div className="text-xs text-[#94908D] mt-1 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-[#FF5A36]" />
                {stats.total_assets} total objects
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1A191F] border border-[#242329]">
              <div className="text-xs uppercase tracking-wider text-[#94908D] font-mono mb-1">
                Game Assets
              </div>
              <div className="text-xl font-bold font-mono text-[#F4F0E8]">
                {stats.game_images}
              </div>
              <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                PUBLIC CDN
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1A191F] border border-[#242329]">
              <div className="text-xs uppercase tracking-wider text-[#94908D] font-mono mb-1">
                Product Assets
              </div>
              <div className="text-xl font-bold font-mono text-[#F4F0E8]">
                {stats.product_images}
              </div>
              <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                PUBLIC CDN
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1A191F] border border-[#242329]">
              <div className="text-xs uppercase tracking-wider text-[#94908D] font-mono mb-1">
                Release APKs
              </div>
              <div className="text-xl font-bold font-mono text-[#F4F0E8]">
                {stats.apk_releases}
              </div>
              <div className="text-xs text-amber-400 mt-1 flex items-center gap-1 font-mono">
                <Lock className="w-3 h-3 text-amber-400" />
                PRIVATE BUCKET
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1A191F] border border-[#242329]">
              <div className="text-xs uppercase tracking-wider text-[#94908D] font-mono mb-1">
                Image Library
              </div>
              <div className="text-xl font-bold font-mono text-[#FF5A36]">
                {stats.image_assets}
              </div>
              <div className="text-xs text-[#94908D] mt-1 font-mono">
                Across 2 buckets
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-[#242329] gap-2 overflow-x-auto pb-px">
          {[
            { id: 'images', label: 'Images & Visuals', icon: ImageIcon, count: imageAssets.length },
            { id: 'apks', label: 'Release APKs (Private)', icon: Lock, count: apkAssets.length },
            { id: 'screenshots', label: 'Game Screenshots', icon: Gamepad2, count: activeGame?.screenshots?.length || 0 },
            { id: 'galleries', label: 'Product Galleries', icon: Package, count: activeProduct?.gallery?.length || 0 },
            { id: 'upload', label: 'Upload Manager', icon: UploadCloud },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2.5 px-4 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-[#FF5A36] text-[#FF5A36] bg-[#FF5A36]/5'
                    : 'border-transparent text-[#94908D] hover:text-[#F4F0E8] hover:border-[#242329]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      isActive
                        ? 'bg-[#FF5A36] text-black font-bold'
                        : 'bg-[#242329] text-[#94908D]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: IMAGES */}
        {activeTab === 'images' && (
          <div className="space-y-6">
            {/* Filter & Search Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-[#1A191F] border border-[#242329]">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                {/* Search */}
                <div className="relative min-w-[220px] flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-[#94908D] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search filename or path..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#101014] border border-[#242329] text-xs text-[#F4F0E8] placeholder-[#94908D] focus:outline-none focus:border-[#FF5A36]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94908D] hover:text-[#F4F0E8]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Bucket Filter */}
                <div className="flex items-center gap-1 bg-[#101014] p-1 rounded-lg border border-[#242329]">
                  {(['all', 'game-assets', 'product-assets'] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setBucketFilter(b)}
                      className={`px-2.5 py-1 text-xs rounded font-mono transition-colors ${
                        bucketFilter === b
                          ? 'bg-[#242329] text-[#F4F0E8] font-bold shadow-sm'
                          : 'text-[#94908D] hover:text-[#F4F0E8]'
                      }`}
                    >
                      {b === 'all' ? 'All Buckets' : b}
                    </button>
                  ))}
                </div>

                {/* Association Filter */}
                <div className="flex items-center gap-1 bg-[#101014] p-1 rounded-lg border border-[#242329]">
                  {(['all', 'associated', 'unassociated'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAssociationFilter(a)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        associationFilter === a
                          ? 'bg-[#242329] text-[#F4F0E8] font-bold shadow-sm'
                          : 'text-[#94908D] hover:text-[#F4F0E8]'
                      }`}
                    >
                      {a === 'all' ? 'All Links' : a === 'associated' ? 'Referenced' : 'Unreferenced'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sorting & View Toggle */}
              <div className="flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 rounded-lg bg-[#101014] border border-[#242329] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] font-mono"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="name_asc">Name (A-Z)</option>
                  <option value="name_desc">Name (Z-A)</option>
                  <option value="size_desc">Size (Largest)</option>
                  <option value="size_asc">Size (Smallest)</option>
                </select>

                <div className="flex items-center bg-[#101014] p-1 rounded-lg border border-[#242329]">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'grid' ? 'bg-[#242329] text-[#FF5A36]' : 'text-[#94908D]'
                    }`}
                    title="Grid View"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'table' ? 'bg-[#242329] text-[#FF5A36]' : 'text-[#94908D]'
                    }`}
                    title="Table View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Results Count */}
            <div className="text-xs text-[#94908D] font-mono flex items-center justify-between">
              <span>Showing {imageAssets.length} image asset{imageAssets.length === 1 ? '' : 's'}</span>
              <span className="text-[#FF5A36]/80 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Protected assets & referenced objects cannot be deleted
              </span>
            </div>

            {/* Images Grid / Table View */}
            {imageAssets.length === 0 ? (
              <div className="p-12 text-center rounded-xl bg-[#1A191F] border border-[#242329] space-y-3">
                <ImageIcon className="w-10 h-10 text-[#94908D] mx-auto opacity-50" />
                <h3 className="text-sm font-bold text-[#F4F0E8]">No image assets found</h3>
                <p className="text-xs text-[#94908D] max-w-sm mx-auto">
                  No images match the current filters. Try resetting search or upload a new asset.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setBucketFilter('all');
                    setAssociationFilter('all');
                  }}
                  className="px-3 py-1.5 text-xs text-[#FF5A36] border border-[#FF5A36]/30 rounded-lg hover:bg-[#FF5A36]/10"
                >
                  Reset Filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {imageAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="group rounded-xl bg-[#1A191F] border border-[#242329] overflow-hidden hover:border-[#FF5A36]/40 transition-all flex flex-col justify-between"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-[#101014] overflow-hidden flex items-center justify-center border-b border-[#242329]">
                      {asset.url ? (
                        <img
                          src={asset.url}
                          alt={asset.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-[#94908D] opacity-40" />
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-black/80 backdrop-blur-md text-[#F4F0E8] border border-white/10">
                          {asset.bucket}
                        </span>
                        {asset.is_protected && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/90 text-black flex items-center gap-1 shadow-sm">
                            <Shield className="w-2.5 h-2.5" />
                            PROTECTED
                          </span>
                        )}
                      </div>

                      {/* Reference Badge */}
                      <div className="absolute bottom-2 left-2">
                        {asset.is_referenced ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#FF5A36]/90 text-black font-bold flex items-center gap-1 shadow-sm">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {asset.referenced_by.length} Link{asset.referenced_by.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-black/80 text-[#94908D] border border-white/10">
                            Unreferenced
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <div
                          className="text-xs font-mono font-medium text-[#F4F0E8] truncate"
                          title={asset.name}
                        >
                          {asset.name}
                        </div>
                        <div className="text-[11px] font-mono text-[#94908D] flex items-center justify-between mt-1">
                          <span>{formatBytes(asset.size)}</span>
                          <span>{asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-[#242329]">
                        <button
                          onClick={() => setInspectAsset(asset)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#101014] border border-[#242329] text-[11px] text-[#F4F0E8] hover:border-[#FF5A36]/40 flex items-center justify-center gap-1 transition-colors"
                          title="Inspect Metadata & Details"
                        >
                          <Eye className="w-3 h-3 text-[#FF5A36]" />
                          Inspect
                        </button>

                        {asset.url && (
                          <button
                            onClick={() => handleCopy(asset.url!)}
                            className="p-1.5 rounded-lg bg-[#101014] border border-[#242329] text-[#94908D] hover:text-[#F4F0E8] hover:border-[#FF5A36]/40 transition-colors"
                            title="Copy Canonical CDN URL"
                          >
                            {copiedUrl === asset.url ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setAssetToDelete(asset);
                            setDeleteConfirmOpen(true);
                          }}
                          disabled={asset.is_protected || asset.is_referenced}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            asset.is_protected || asset.is_referenced
                              ? 'bg-[#101014] border-[#242329] text-[#94908D]/40 cursor-not-allowed'
                              : 'bg-[#101014] border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40'
                          }`}
                          title={
                            asset.is_protected
                              ? 'Protected production asset cannot be deleted'
                              : asset.is_referenced
                              ? 'Asset is actively referenced in database; detach reference first'
                              : 'Delete unreferenced asset'
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Table View */
              <div className="rounded-xl bg-[#1A191F] border border-[#242329] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#101014] border-b border-[#242329] text-[#94908D] font-mono uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Preview</th>
                      <th className="py-3 px-4">Filename & Path</th>
                      <th className="py-3 px-4">Bucket</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Reference Status</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242329] text-[#F4F0E8]">
                    {imageAssets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-[#242329]/30 transition-colors">
                        <td className="py-2 px-4 w-16">
                          <div className="w-10 h-10 rounded bg-[#101014] border border-[#242329] overflow-hidden flex items-center justify-center">
                            {asset.url ? (
                              <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-[#94908D]" />
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium max-w-xs truncate" title={asset.path}>
                          {asset.name}
                          {asset.is_protected && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                              PROTECTED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#94908D]">{asset.bucket}</td>
                        <td className="py-3 px-4 font-mono">{formatBytes(asset.size)}</td>
                        <td className="py-3 px-4 font-mono">
                          {asset.is_referenced ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {asset.referenced_by.map((r) => `${r.title} (${r.field})`).join(', ')}
                            </span>
                          ) : (
                            <span className="text-[#94908D]">Unreferenced</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#94908D]">
                          {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setInspectAsset(asset)}
                              className="p-1.5 rounded hover:bg-[#242329] text-[#94908D] hover:text-[#F4F0E8]"
                              title="Inspect Details"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#FF5A36]" />
                            </button>
                            {asset.url && (
                              <button
                                onClick={() => handleCopy(asset.url!)}
                                className="p-1.5 rounded hover:bg-[#242329] text-[#94908D] hover:text-[#F4F0E8]"
                                title="Copy CDN URL"
                              >
                                {copiedUrl === asset.url ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setAssetToDelete(asset);
                                setDeleteConfirmOpen(true);
                              }}
                              disabled={asset.is_protected || asset.is_referenced}
                              className={`p-1.5 rounded transition-colors ${
                                asset.is_protected || asset.is_referenced
                                  ? 'text-[#94908D]/40 cursor-not-allowed'
                                  : 'text-red-400 hover:bg-red-500/10'
                              }`}
                              title={
                                asset.is_protected
                                  ? 'Protected production asset'
                                  : asset.is_referenced
                                  ? 'Referenced asset'
                                  : 'Delete asset'
                              }
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
            )}
          </div>
        )}

        {/* TAB 2: RELEASE APKS */}
        {activeTab === 'apks' && (
          <div className="space-y-6">
            {/* Security Notice Banner */}
            <div className="p-4 rounded-xl bg-[#1A191F] border border-amber-500/30 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-bold text-[#F4F0E8] flex items-center gap-2">
                  <span>Private Storage Bucket: release-apks</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    ISOLATED & ENCRYPTED
                  </span>
                </div>
                <p className="text-[#94908D] leading-relaxed">
                  APK release binaries are strictly shielded from public indexing and anonymous access. Binaries are streamed via the authenticated Express API (<code>/api/releases/:id/download</code>) with real-time download tracking. Direct Supabase Storage URLs and access tokens are never exposed.
                </p>
              </div>
            </div>

            {/* APKs Table */}
            <div className="rounded-xl bg-[#1A191F] border border-[#242329] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#101014] border-b border-[#242329] text-[#94908D] font-mono uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Binary Package</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Associated Entity</th>
                    <th className="py-3 px-4">Storage Visibility</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Protection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242329] text-[#F4F0E8]">
                  {apkAssets.map((apk) => (
                    <tr key={apk.id} className="hover:bg-[#242329]/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#101014] border border-[#242329] flex items-center justify-center text-emerald-400 flex-shrink-0">
                            <FolderLock className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-mono font-medium text-[#F4F0E8]">{apk.name}</div>
                            <div className="text-[11px] font-mono text-[#94908D]">{apk.path}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">{formatBytes(apk.size)}</td>
                      <td className="py-3 px-4 font-mono">
                        {apk.referenced_by.length > 0 ? (
                          <div className="space-y-0.5">
                            {apk.referenced_by.map((r) => (
                              <span
                                key={r.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#FF5A36]/10 text-[#FF5A36] border border-[#FF5A36]/30 font-bold"
                              >
                                {r.title}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#94908D]">Unlinked Binary</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="inline-flex items-center gap-1 text-amber-400">
                          <Lock className="w-3 h-3" />
                          PRIVATE
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#94908D]">
                        {apk.createdAt ? new Date(apk.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {apk.is_protected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                            <Shield className="w-3 h-3" />
                            CANONICAL RELEASE
                          </span>
                        ) : apk.is_referenced ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                            REFERENCED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-[#242329] text-[#94908D] font-mono">
                            RELEASE MANAGER ONLY
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {apkAssets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#94908D]">
                        No APK packages currently stored in release-apks.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: GAME SCREENSHOTS */}
        {activeTab === 'screenshots' && (
          <div className="space-y-6">
            {/* Game Selector Header */}
            <div className="p-4 rounded-xl bg-[#1A191F] border border-[#242329] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Gamepad2 className="w-5 h-5 text-[#FF5A36]" />
                <div>
                  <h3 className="text-sm font-bold text-[#F4F0E8]">Game Screenshot Orchestrator</h3>
                  <p className="text-xs text-[#94908D]">
                    Attach, preview, reorder, or detach screenshots. Detaching preserves the underlying Storage asset.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedGameId}
                  onChange={(e) => setSelectedGameId(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#101014] border border-[#242329] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] font-mono"
                >
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title} ({g.screenshots?.length || 0} screenshots)
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setAttachTargetType('game');
                    setShowAttachUrlModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FF5A36] text-black text-xs font-bold hover:bg-[#ff6f4f] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Attach Screenshot
                </button>
              </div>
            </div>

            {/* Screenshots List */}
            {activeGame && activeGame.screenshots && activeGame.screenshots.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeGame.screenshots.map((url, idx) => (
                  <div
                    key={`${url}_${idx}`}
                    className="group rounded-xl bg-[#1A191F] border border-[#242329] overflow-hidden hover:border-[#FF5A36]/40 transition-all flex flex-col justify-between"
                  >
                    <div className="relative aspect-video bg-[#101014] overflow-hidden border-b border-[#242329]">
                      <img src={url} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono bg-black/80 text-[#F4F0E8] border border-white/10">
                        Position #{idx + 1}
                      </div>
                    </div>

                    <div className="p-3.5 space-y-3">
                      <div className="text-xs font-mono text-[#94908D] truncate" title={url}>
                        {url}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#242329]">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleReorderScreenshot(idx, 'up')}
                            disabled={idx === 0 || reorderingInProgress}
                            className="p-1.5 rounded-lg bg-[#101014] border border-[#242329] text-[#94908D] hover:text-[#F4F0E8] disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move Earlier"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleReorderScreenshot(idx, 'down')}
                            disabled={idx === activeGame.screenshots.length - 1 || reorderingInProgress}
                            className="p-1.5 rounded-lg bg-[#101014] border border-[#242329] text-[#94908D] hover:text-[#F4F0E8] disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move Later"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopy(url)}
                            className="p-1.5 rounded-lg bg-[#101014] border border-[#242329] text-[#94908D] hover:text-[#F4F0E8]"
                            title="Copy URL"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDetachScreenshot(url)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
                            title="Detach screenshot (file preserved in library)"
                          >
                            Detach
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center rounded-xl bg-[#1A191F] border border-[#242329] space-y-3">
                <Gamepad2 className="w-10 h-10 text-[#94908D] mx-auto opacity-50" />
                <h3 className="text-sm font-bold text-[#F4F0E8]">No screenshots attached to {activeGame?.title}</h3>
                <p className="text-xs text-[#94908D] max-w-sm mx-auto">
                  Click 'Attach Screenshot' to select an existing CDN URL or upload a new game asset.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PRODUCT GALLERIES */}
        {activeTab === 'galleries' && (
          <div className="space-y-6">
            {/* Product Selector Header */}
            <div className="p-4 rounded-xl bg-[#1A191F] border border-[#242329] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-[#FF5A36]" />
                <div>
                  <h3 className="text-sm font-bold text-[#F4F0E8]">Product Gallery Orchestrator</h3>
                  <p className="text-xs text-[#94908D]">
                    Manage showcase galleries for digital products. Detaching preserves the underlying Storage asset.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#101014] border border-[#242329] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] font-mono"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.gallery?.length || 0} images)
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setAttachTargetType('product');
                    setShowAttachUrlModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FF5A36] text-black text-xs font-bold hover:bg-[#ff6f4f] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Attach Gallery Image
                </button>
              </div>
            </div>

            {/* Gallery Grid */}
            {activeProduct && activeProduct.gallery && activeProduct.gallery.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeProduct.gallery.map((url, idx) => (
                  <div
                    key={`${url}_${idx}`}
                    className="group rounded-xl bg-[#1A191F] border border-[#242329] overflow-hidden hover:border-[#FF5A36]/40 transition-all flex flex-col justify-between"
                  >
                    <div className="relative aspect-video bg-[#101014] overflow-hidden border-b border-[#242329]">
                      <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono bg-black/80 text-[#F4F0E8] border border-white/10">
                        Slide #{idx + 1}
                      </div>
                    </div>

                    <div className="p-3.5 space-y-3">
                      <div className="text-xs font-mono text-[#94908D] truncate" title={url}>
                        {url}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#242329]">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleReorderGallery(idx, 'up')}
                            disabled={idx === 0 || reorderingInProgress}
                            className="p-1.5 rounded-lg bg-[#101014] border border-[#242329] text-[#94908D] hover:text-[#F4F0E8] disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move Earlier"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleReorderGallery(idx, 'down')}
                            disabled={idx === (activeProduct.gallery?.length || 0) - 1 || reorderingInProgress}
                            className="p-1.5 rounded-lg bg-[#101014] border border-[#242329] text-[#94908D] hover:text-[#F4F0E8] disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move Later"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopy(url)}
                            className="p-1.5 rounded-lg bg-[#101014] border border-[#242329] text-[#94908D] hover:text-[#F4F0E8]"
                            title="Copy URL"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDetachGalleryImage(url)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
                            title="Detach image (file preserved in library)"
                          >
                            Detach
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center rounded-xl bg-[#1A191F] border border-[#242329] space-y-3">
                <Package className="w-10 h-10 text-[#94908D] mx-auto opacity-50" />
                <h3 className="text-sm font-bold text-[#F4F0E8]">No gallery images attached to {activeProduct?.name}</h3>
                <p className="text-xs text-[#94908D] max-w-sm mx-auto">
                  Click 'Attach Gallery Image' to select an existing CDN URL or upload a new asset.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: UPLOAD MANAGER */}
        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="p-6 rounded-2xl bg-[#1A191F] border border-[#242329] space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#F4F0E8] flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-[#FF5A36]" />
                  Direct Storage Asset Upload
                </h2>
                <p className="text-xs text-[#94908D] mt-1">
                  Upload directly to Supabase Storage with cryptographic collision resistance, magic byte verification, and strict free-tier size ceilings.
                </p>
              </div>

              {/* Bucket Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#94908D] font-mono">
                  Destination Storage Bucket
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      id: 'game-assets',
                      name: 'game-assets',
                      desc: 'Game screenshots, banners & avatars',
                      type: 'PUBLIC',
                      limit: '15 MB',
                    },
                    {
                      id: 'product-assets',
                      name: 'product-assets',
                      desc: 'Product gallery images & covers',
                      type: 'PUBLIC',
                      limit: '15 MB',
                    },
                    {
                      id: 'release-apks',
                      name: 'release-apks',
                      desc: 'Android APK binaries (Private)',
                      type: 'PRIVATE',
                      limit: '50 MB',
                    },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setUploadBucket(b.id as MediaBucket);
                        setSelectedFile(null);
                        setUploadError(null);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        uploadBucket === b.id
                          ? 'bg-[#FF5A36]/10 border-[#FF5A36] shadow-md shadow-[#FF5A36]/10'
                          : 'bg-[#101014] border-[#242329] hover:border-[#94908D]'
                      }`}
                    >
                      <div>
                        <div className="font-mono font-bold text-xs text-[#F4F0E8]">{b.name}</div>
                        <div className="text-[10px] text-[#94908D] mt-1">{b.desc}</div>
                      </div>
                      <div className="flex items-center justify-between mt-3 text-[10px] font-mono">
                        <span className={b.type === 'PRIVATE' ? 'text-amber-400' : 'text-emerald-400'}>
                          {b.type}
                        </span>
                        <span className="text-[#94908D]">Max {b.limit}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Drag and Drop Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                className={`p-8 border-2 border-dashed rounded-xl text-center space-y-3 transition-colors ${
                  isDragOver
                    ? 'border-[#FF5A36] bg-[#FF5A36]/5'
                    : 'border-[#242329] bg-[#101014] hover:border-[#94908D]'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-[#1A191F] border border-[#242329] flex items-center justify-center text-[#FF5A36] mx-auto">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[#F4F0E8]">
                    Drag and drop file here, or{' '}
                    <label className="text-[#FF5A36] cursor-pointer hover:underline">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        accept={uploadBucket === 'release-apks' ? '.apk' : 'image/png,image/jpeg,image/webp,image/gif'}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            validateAndSetFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </p>
                  <p className="text-xs text-[#94908D] font-mono">
                    {uploadBucket === 'release-apks'
                      ? 'Supported format: .apk (Max 50 MB)'
                      : 'Supported formats: PNG, JPG, JPEG, WEBP, GIF (Max 15 MB)'}
                  </p>
                </div>

                {selectedFile && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#242329] text-xs font-mono text-[#F4F0E8] border border-[#FF5A36]/40 mt-2">
                    <FileText className="w-3.5 h-3.5 text-[#FF5A36]" />
                    <span>{selectedFile.name}</span>
                    <span className="text-[#94908D]">({formatBytes(selectedFile.size)})</span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="ml-1 text-[#94908D] hover:text-[#F4F0E8]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {uploadError && (
                <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Success Preview */}
              {uploadSuccessUrl && (
                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Upload Verified & Persisted
                  </div>
                  <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-emerald-500/20 font-mono text-[11px] break-all">
                    <span className="flex-1">{uploadSuccessUrl}</span>
                    <button
                      onClick={() => handleCopy(uploadSuccessUrl)}
                      className="text-emerald-400 hover:text-white p-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              {uploadProgress !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono text-[#94908D]">
                    <span>Uploading to {uploadBucket}...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#101014] overflow-hidden">
                    <div
                      className="h-full bg-[#FF5A36] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={!selectedFile || uploading}
                className="w-full py-3 rounded-xl bg-[#FF5A36] text-black font-bold text-xs hover:bg-[#ff6f4f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FF5A36]/20 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Transmitting to Supabase Storage...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    Confirm & Upload to {uploadBucket}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* MODAL: ASSET DETAILS / INSPECT */}
        {inspectAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1A191F] border border-[#242329] rounded-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-[#242329] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#F4F0E8] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#FF5A36]" />
                    Asset Metadata Inspector
                  </h3>
                  <p className="text-xs text-[#94908D] font-mono mt-0.5">{inspectAsset.name}</p>
                </div>
                <button
                  onClick={() => setInspectAsset(null)}
                  className="text-[#94908D] hover:text-[#F4F0E8]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Large Visual Preview */}
              {inspectAsset.url ? (
                <div className="rounded-xl overflow-hidden bg-[#101014] border border-[#242329] max-h-72 flex items-center justify-center">
                  <img src={inspectAsset.url} alt={inspectAsset.name} className="max-h-72 object-contain" />
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-[#101014] border border-[#242329] text-center space-y-2">
                  <FolderLock className="w-12 h-12 text-amber-400 mx-auto" />
                  <div className="text-xs font-mono font-bold text-amber-400">
                    PRIVATE BINARY ENCRYPTED STORAGE
                  </div>
                  <p className="text-xs text-[#94908D]">
                    This asset resides in the private <code>release-apks</code> bucket. Public HTTP CDN access is disabled.
                  </p>
                </div>
              )}

              {/* Metadata Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#94908D] font-mono">
                  Storage Properties
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-[#101014] border border-[#242329]">
                    <div className="text-[#94908D] text-[10px]">STORAGE BUCKET</div>
                    <div className="text-[#F4F0E8] font-bold mt-1 flex items-center gap-1.5">
                      {inspectAsset.bucket}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        inspectAsset.visibility === 'public' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {inspectAsset.visibility.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#101014] border border-[#242329]">
                    <div className="text-[#94908D] text-[10px]">FILE SIZE</div>
                    <div className="text-[#F4F0E8] font-bold mt-1">
                      {formatBytes(inspectAsset.size)} ({inspectAsset.size.toLocaleString()} bytes)
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#101014] border border-[#242329]">
                    <div className="text-[#94908D] text-[10px]">CONTENT TYPE (MIME)</div>
                    <div className="text-[#F4F0E8] font-bold mt-1 truncate">{inspectAsset.contentType}</div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#101014] border border-[#242329]">
                    <div className="text-[#94908D] text-[10px]">CREATED DATE</div>
                    <div className="text-[#F4F0E8] font-bold mt-1">
                      {new Date(inspectAsset.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* CDN URL */}
                {inspectAsset.url && (
                  <div className="p-3 rounded-lg bg-[#101014] border border-[#242329] space-y-1">
                    <div className="text-[#94908D] text-[10px] font-mono">CANONICAL CDN URL</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inspectAsset.url}
                        className="flex-1 bg-transparent text-xs font-mono text-[#FF5A36] truncate focus:outline-none"
                      />
                      <button
                        onClick={() => handleCopy(inspectAsset.url!)}
                        className="px-2.5 py-1 rounded bg-[#242329] text-xs font-mono text-[#F4F0E8] hover:bg-[#FF5A36] hover:text-black transition-colors flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                {/* Reference Status */}
                <div className="p-3.5 rounded-lg bg-[#101014] border border-[#242329] space-y-2">
                  <div className="text-[#94908D] text-[10px] font-mono">DATABASE ASSOCIATION STATUS</div>
                  {inspectAsset.is_referenced ? (
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Referenced by {inspectAsset.referenced_by.length} entity:
                      </div>
                      <div className="space-y-1 pl-5">
                        {inspectAsset.referenced_by.map((r, i) => (
                          <div key={i} className="text-xs font-mono text-[#F4F0E8]">
                            • <span className="text-[#FF5A36] font-bold uppercase">{r.type}</span>: "{r.title}" (Field: <code>{r.field}</code>)
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-[#94908D] flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-blue-400" />
                      Unreferenced asset — Eligible for deletion.
                    </div>
                  )}

                  {inspectAsset.is_protected && (
                    <div className="mt-2 text-xs text-amber-400 flex items-center gap-1.5 font-bold">
                      <Shield className="w-4 h-4 text-amber-400" />
                      Protected production invariant: permanent deletion safeguard active.
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-[#242329]">
                <button
                  type="button"
                  onClick={() => setInspectAsset(null)}
                  className="px-4 py-2 rounded-lg bg-[#101014] border border-[#242329] text-xs text-[#F4F0E8] hover:border-[#FF5A36]/40 transition-colors"
                >
                  Close
                </button>

                <div className="flex items-center gap-3">
                  {inspectAsset.url && (
                    <button
                      type="button"
                      onClick={() => {
                        setAttachUrlInput(inspectAsset.url!);
                        setShowAttachUrlModal(true);
                      }}
                      className="px-4 py-2 rounded-lg bg-[#242329] text-xs font-bold text-[#F4F0E8] hover:bg-[#323038] transition-colors"
                    >
                      Attach to Entity...
                    </button>
                  )}

                  {inspectAsset.bucket === 'release-apks' ? (
                    <span
                      title="APK binaries cannot be deleted via generic media library. Manage through Releases."
                      className="px-4 py-2 rounded-lg bg-[#242329] text-[#94908D] text-xs font-mono"
                    >
                      RELEASE MANAGER ONLY
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAssetToDelete(inspectAsset);
                        setDeleteConfirmOpen(true);
                      }}
                      disabled={inspectAsset.is_protected || inspectAsset.is_referenced}
                      className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Asset
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: DELETE CONFIRMATION */}
        {deleteConfirmOpen && assetToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <div className="bg-[#1A191F] border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F4F0E8]">Confirm Storage Object Deletion</h3>
                  <p className="text-xs text-[#94908D] mt-1">
                    Are you sure you want to delete this asset from Supabase Storage? This action cannot be reversed.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#101014] border border-[#242329] space-y-1.5 text-xs font-mono">
                <div className="text-[#94908D] text-[10px]">ASSET IDENTIFIER</div>
                <div className="text-[#F4F0E8] font-bold break-all">{assetToDelete.name}</div>
                <div className="text-[#94908D] text-[11px]">Bucket: {assetToDelete.bucket} | Size: {formatBytes(assetToDelete.size)}</div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setAssetToDelete(null);
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg bg-[#101014] border border-[#242329] text-xs text-[#F4F0E8] hover:border-[#FF5A36]/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Permanently Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ATTACH URL MODAL */}
        {showAttachUrlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1A191F] border border-[#242329] rounded-2xl max-w-lg w-full p-6 space-y-5">
              <div className="flex items-start justify-between border-b border-[#242329] pb-3">
                <h3 className="text-sm font-bold text-[#F4F0E8]">
                  Attach Image to {attachTargetType === 'game' ? 'Game Screenshots' : 'Product Gallery'}
                </h3>
                <button
                  onClick={() => setShowAttachUrlModal(false)}
                  className="text-[#94908D] hover:text-[#F4F0E8]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-xs font-mono uppercase text-[#94908D] block mb-1">
                    Select Target {attachTargetType === 'game' ? 'Game' : 'Product'}
                  </label>
                  {attachTargetType === 'game' ? (
                    <select
                      value={selectedGameId}
                      onChange={(e) => setSelectedGameId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#101014] border border-[#242329] text-xs text-[#F4F0E8] focus:border-[#FF5A36] font-mono"
                    >
                      {games.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#101014] border border-[#242329] text-xs text-[#F4F0E8] focus:border-[#FF5A36] font-mono"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-xs font-mono uppercase text-[#94908D] block mb-1">
                    Image CDN URL or Storage Path
                  </label>
                  <input
                    type="text"
                    value={attachUrlInput}
                    onChange={(e) => setAttachUrlInput(e.target.value)}
                    placeholder="https://...supabase.co/storage/v1/object/public/game-assets/... or screenshot.jpg"
                    className="w-full px-3 py-2 rounded-lg bg-[#101014] border border-[#242329] text-xs text-[#F4F0E8] focus:border-[#FF5A36] font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAttachUrlModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#101014] border border-[#242329] text-xs text-[#F4F0E8]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAttachSubmit}
                  disabled={!attachUrlInput.trim()}
                  className="px-4 py-2 rounded-lg bg-[#FF5A36] text-black text-xs font-bold hover:bg-[#ff6f4f] transition-colors disabled:opacity-50"
                >
                  Attach Image
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Toast Notifications */}
        <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      </div>
    </AdminLayout>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import type { Product, ProductCategory, ProductStatus } from '../../types';
import { api } from '../../lib/api';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { ProductFormModal } from '../../components/admin/ProductFormModal';
import { ProductDeleteModal } from '../../components/admin/ProductDeleteModal';
import { ToastContainer, type ToastMessage } from '../../components/admin/Toast';
import { Link } from '../../context/RouterContext';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  Package,
  Layers,
  Star,
  CheckCircle2,
  Clock,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Globe,
  Layout,
  Smartphone,
  Gamepad2,
  Code2,
} from 'lucide-react';

const CATEGORIES: ('All' | ProductCategory)[] = [
  'All',
  'Websites',
  'Web Applications',
  'Mobile Applications',
  'Games',
  'Custom Software',
];

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Controls
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'order'>('order');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminProducts();
      setProducts(data);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();

    const handleUpdate = () => loadProducts();
    window.addEventListener('karshtech:products-updated', handleUpdate);
    return () => window.removeEventListener('karshtech:products-updated', handleUpdate);
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const total = products.length;
    const published = products.filter((p) => p.status === 'Published').length;
    const drafts = products.filter((p) => p.status === 'Draft').length;
    const featured = products.filter((p) => p.featured).length;
    const categoriesCount = {
      Websites: products.filter((p) => p.category === 'Websites').length,
      'Web Applications': products.filter((p) => p.category === 'Web Applications').length,
      'Mobile Applications': products.filter((p) => p.category === 'Mobile Applications').length,
      Games: products.filter((p) => p.category === 'Games').length,
      'Custom Software': products.filter((p) => p.category === 'Custom Software').length,
    };
    return { total, published, drafts, featured, categoriesCount };
  }, [products]);

  // Filtering & Sorting
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => {
      // Category filter
      if (selectedCategory !== 'All' && p.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'All' && p.status !== selectedStatus) {
        return false;
      }
      // Search
      if (search) {
        const q = search.toLowerCase();
        const matches =
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.short_description.toLowerCase().includes(q) ||
          p.technologies.some((t) => t.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // 'order' default: display_order ascending, then newest
      return a.display_order - b.display_order || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [products, search, selectedCategory, selectedStatus, sortBy]);

  // Quick Action: Toggle Status
  const handleToggleStatus = async (product: Product) => {
    const nextStatus: ProductStatus = product.status === 'Published' ? 'Draft' : 'Published';
    try {
      await api.setProductStatus(product.id, nextStatus);
      showToast('success', `"${product.name}" is now ${nextStatus}`);
      loadProducts();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update status');
    }
  };

  // Quick Action: Toggle Featured
  const handleToggleFeatured = async (product: Product) => {
    try {
      await api.setProductFeatured(product.id, !product.featured);
      showToast('success', `"${product.name}" featured status updated`);
      loadProducts();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update featured flag');
    }
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const handleDelete = (product: Product) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Websites': return <Globe className="w-3.5 h-3.5 text-[#FF5A36]" />;
      case 'Web Applications': return <Layout className="w-3.5 h-3.5 text-[#FF5A36]" />;
      case 'Mobile Applications': return <Smartphone className="w-3.5 h-3.5 text-[#FF5A36]" />;
      case 'Games': return <Gamepad2 className="w-3.5 h-3.5 text-[#FF5A36]" />;
      case 'Custom Software': return <Code2 className="w-3.5 h-3.5 text-[#FF5A36]" />;
      default: return <Package className="w-3.5 h-3.5 text-[#FF5A36]" />;
    }
  };

  return (
    <AdminLayout title="Products Management" onNewProduct={handleCreate}>
      <div className="space-y-6 max-w-7xl mx-auto font-sans">
        
        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 sm:p-5 rounded-lg border border-[#39363A] bg-[#1A191F]">
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] block mb-1">
              Total Products
            </span>
            <div className="font-display text-2xl sm:text-3xl font-bold text-[#F4F0E8]">
              {stats.total}
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-lg border border-[#39363A] bg-[#1A191F]">
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#FF5A36] block mb-1">
              Published Live
            </span>
            <div className="font-display text-2xl sm:text-3xl font-bold text-[#F4F0E8] flex items-center gap-2">
              <span>{stats.published}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-lg border border-[#39363A] bg-[#1A191F]">
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] block mb-1">
              Draft Projects
            </span>
            <div className="font-display text-2xl sm:text-3xl font-bold text-[#F4F0E8]">
              {stats.drafts}
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-lg border border-[#39363A] bg-[#1A191F]">
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#FF5A36] block mb-1">
              Featured Flag
            </span>
            <div className="font-display text-2xl sm:text-3xl font-bold text-[#F4F0E8] flex items-center gap-1.5">
              <span>{stats.featured}</span>
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 sm:p-5 bg-[#1A191F] border border-[#39363A] rounded-lg flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-1">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#96929A]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products, slugs, stack..."
                className="w-full pl-10 pr-4 py-2 bg-[#101014] border border-[#39363A] rounded text-xs text-[#F4F0E8] placeholder-[#96929A] focus:outline-none focus:border-[#FF5A36] transition-colors"
              />
            </div>

            {/* Category Dropdown */}
            <div className="w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-[#101014] border border-[#39363A] rounded text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-[#1A191F]">
                    {c === 'All' ? 'All Categories' : c}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Dropdown */}
            <div className="w-full sm:w-auto">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-[#101014] border border-[#39363A] rounded text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] cursor-pointer"
              >
                <option value="All" className="bg-[#1A191F]">All Statuses</option>
                <option value="Published" className="bg-[#1A191F]">Published Only</option>
                <option value="Draft" className="bg-[#1A191F]">Drafts Only</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="w-full sm:w-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full sm:w-auto px-3 py-2 bg-[#101014] border border-[#39363A] rounded text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] cursor-pointer font-mono-code"
              >
                <option value="order" className="bg-[#1A191F]">Sort: Display Order</option>
                <option value="newest" className="bg-[#1A191F]">Sort: Newest First</option>
                <option value="oldest" className="bg-[#1A191F]">Sort: Oldest First</option>
                <option value="name" className="bg-[#1A191F]">Sort: Name (A-Z)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <button
              onClick={handleCreate}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] font-bold text-xs uppercase tracking-wider rounded transition-all shadow-md shadow-[#FF5A36]/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-[#1A191F] border border-[#39363A] rounded-lg overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-16 text-center text-xs font-mono-code text-[#96929A] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#FF5A36]" />
              <span>LOADING PRODUCTS REPOSITORY...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-16 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#101014] border border-[#39363A] text-[#96929A] flex items-center justify-center mx-auto">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg uppercase text-[#F4F0E8]">
                No Products Found
              </h3>
              <p className="text-xs text-[#96929A] max-w-sm mx-auto">
                {search || selectedCategory !== 'All' || selectedStatus !== 'All'
                  ? 'No products matched your search or active filters. Try clearing criteria.'
                  : 'Your products database is currently empty. Click "Add Product" above to create your first release.'}
              </p>
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#FF5A36] text-[#101014] text-xs font-bold uppercase tracking-wider hover:bg-[#FF7454] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Product</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#101014] border-b border-[#39363A] text-[10px] font-mono-code text-[#96929A] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Platform</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Featured</th>
                    <th className="py-3 px-4">Order</th>
                    <th className="py-3 px-4">Updated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#39363A]/40 text-[#C2BEC1]">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-[#242329]/50 transition-colors">
                      {/* Product Thumbnail & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={product.cover_image || '/brand/karsh-tech-k.png'}
                            alt={product.name}
                            className="w-10 h-10 rounded object-cover border border-[#39363A] bg-[#101014] flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-[#F4F0E8] hover:text-[#FF5A36] transition-colors truncate">
                              {product.name}
                            </div>
                            <div className="text-[10px] font-mono-code text-[#96929A] truncate">
                              /{product.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          {getCategoryIcon(product.category)}
                          <span>{product.category}</span>
                        </div>
                      </td>

                      {/* Platform */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-[#101014] border border-[#39363A] text-[10px] font-mono-code text-[#C2BEC1]">
                          {product.platform}
                        </span>
                      </td>

                      {/* Status Toggle Pill */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(product)}
                          title={`Click to set ${product.status === 'Published' ? 'Draft' : 'Published'}`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                            product.status === 'Published'
                              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/40'
                              : 'bg-amber-950/40 text-amber-300 border border-amber-500/40 hover:bg-amber-900/40'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              product.status === 'Published' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                            }`}
                          />
                          <span>{product.status}</span>
                        </button>
                      </td>

                      {/* Featured Star Toggle */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(product)}
                          title={product.featured ? 'Featured on products page' : 'Not featured'}
                          className="p-1 rounded hover:bg-[#101014] text-[#96929A] hover:text-amber-400 transition-colors cursor-pointer"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              product.featured ? 'text-amber-400 fill-amber-400' : 'text-[#96929A]'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Display Order */}
                      <td className="py-3.5 px-4 font-mono-code text-xs text-[#96929A]">
                        #{product.display_order}
                      </td>

                      {/* Updated Date */}
                      <td className="py-3.5 px-4 font-mono-code text-[10px] text-[#96929A] whitespace-nowrap">
                        {product.updated_at ? new Date(product.updated_at).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Live Preview Button */}
                          <Link
                            href={`/products/${product.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded border border-[#39363A] bg-[#101014] text-[#96929A] hover:text-[#F4F0E8] hover:border-[#FF5A36] transition-colors"
                            title="Preview public page"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleEdit(product)}
                            className="p-1.5 rounded border border-[#39363A] bg-[#101014] text-[#96929A] hover:text-[#FF5A36] hover:border-[#FF5A36] transition-colors cursor-pointer"
                            title="Edit product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDelete(product)}
                            className="p-1.5 rounded border border-[#39363A] bg-[#101014] text-red-400 hover:text-red-300 hover:border-red-500/60 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete product"
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

      </div>

      {/* Product Form Modal (Add / Edit) */}
      <ProductFormModal
        isOpen={isModalOpen}
        initialProduct={selectedProduct}
        onClose={() => setIsModalOpen(false)}
        onSaved={(saved) => {
          showToast('success', `Product "${saved.name}" saved successfully`);
          loadProducts();
        }}
      />

      {/* Delete Confirmation Modal */}
      <ProductDeleteModal
        isOpen={deleteModalOpen}
        product={productToDelete}
        onClose={() => setDeleteModalOpen(false)}
        onSuccess={(deletedTitle) => {
          showToast('success', `Product "${deletedTitle}" deleted successfully`);
          loadProducts();
        }}
        onError={(msg) => showToast('error', msg)}
      />

      {/* Toast Notification Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={(id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </AdminLayout>
  );
};

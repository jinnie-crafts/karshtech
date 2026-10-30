import React, { useState, useEffect } from 'react';
import { useRouter, Link } from '../context/RouterContext';
import { api } from '../lib/api';
import type { Product } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Download,
  Calendar,
  Sparkles,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Code2,
  Globe,
  Loader2,
  Maximize2,
  X,
  Share2,
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const { params } = useRouter();
  const slug = params.slug || '';

  const [product, setProduct] = useState<Product | null>(null);
  const [otherProducts, setOtherProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Gallery Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchDetail() {
      if (!slug) {
        setError('Product not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await api.getProductBySlug(slug);
        if (isMounted) {
          setProduct(data.product);
          document.title = `${data.product.name} — Karsh Tech Products`;
        }

        // Fetch other products for recommendations
        const all = await api.getProducts();
        if (isMounted) {
          setOtherProducts(all.filter((p) => p.slug !== slug).slice(0, 3));
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Product not found');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 pb-24 flex flex-col items-center justify-center bg-[#101014] text-[#C2BEC1]">
        <Loader2 className="w-8 h-8 text-[#FF5A36] animate-spin mb-4" />
        <span className="text-xs font-mono uppercase tracking-widest text-[#96929A]">
          Loading product specifications...
        </span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen pt-32 pb-24 bg-[#101014] text-[#C2BEC1] px-6">
        <div className="max-w-xl mx-auto rounded-xl border border-[#39363A] bg-[#1A191F] p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36] mx-auto">
            <Code2 className="w-6 h-6" />
          </div>
          <h2 className="font-display text-2xl font-bold uppercase text-[#F4F0E8]">
            PRODUCT NOT FOUND
          </h2>
          <p className="text-xs text-[#96929A]">
            The requested product specification or archive does not exist or may have been unindexed.
          </p>
          <div className="pt-2">
            <Link
              href="/products"
              className="inline-flex items-center space-x-2 px-6 py-2.5 rounded bg-[#FF5A36] text-[#101014] text-xs font-bold uppercase tracking-wider"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Products</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isExternalProject = product.project_url && product.project_url.startsWith('http');

  return (
    <div className="min-h-screen pt-28 pb-24 text-[#C2BEC1] bg-[#101014] font-sans">
      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-50 bg-[#101014]/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
          >
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-6 right-6 p-2 rounded-full bg-[#1A191F] border border-[#39363A] text-[#F4F0E8] hover:text-[#FF5A36]"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Screenshot Preview"
              className="max-w-full max-h-[85vh] rounded-lg border border-[#39363A] object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/products"
            className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#96929A] hover:text-[#F4F0E8] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#FF5A36]" />
            <span>BACK TO PRODUCTS</span>
          </Link>

          <button
            onClick={handleShare}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded border border-[#39363A] bg-[#1A191F] hover:border-[#FF5A36] text-[11px] font-mono text-[#F4F0E8] transition-colors cursor-pointer"
          >
            <Share2 className="w-3 h-3 text-[#FF5A36]" />
            <span>{copied ? 'COPIED LINK' : 'SHARE'}</span>
          </button>
        </div>

        {/* Hero Section */}
        <div className="rounded-xl border border-[#39363A] bg-[#1A191F] overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Visual Preview */}
            <div className="lg:col-span-6 relative aspect-[16/10] lg:aspect-auto min-h-[300px] lg:min-h-[420px] bg-[#101014] overflow-hidden border-b lg:border-b-0 lg:border-r border-[#39363A]">
              <img
                src={product.cover_image || '/brand/karsh-tech-full.png'}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/brand/karsh-tech-full.png';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A191F] via-transparent to-transparent lg:hidden" />
            </div>

            {/* Product Meta */}
            <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-[#FF5A36] text-[#101014] text-[10px] font-bold uppercase tracking-wider">
                    {product.category}
                  </span>
                  {product.platform && (
                    <span className="px-2.5 py-1 rounded bg-[#242329] border border-[#39363A] text-[#F4F0E8] text-[10px] font-mono-code">
                      {product.platform}
                    </span>
                  )}
                  {product.featured && (
                    <span className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Featured
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono-code">
                    {product.status}
                  </span>
                </div>

                <div>
                  <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold uppercase tracking-tight text-[#F4F0E8] leading-tight">
                    {product.name}
                  </h1>
                  {product.short_description && (
                    <p className="text-sm sm:text-base text-[#FF5A36] font-mono-code font-medium mt-1">
                      {product.short_description}
                    </p>
                  )}
                </div>

                {/* Tech Chips */}
                {product.technologies && product.technologies.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[#96929A]">
                      Engineered With
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {product.technologies.map((tech) => (
                        <span
                          key={tech}
                          className="px-2.5 py-1 rounded bg-[#242329] border border-[#39363A] text-[11px] font-mono-code text-[#C2BEC1]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#39363A]/80 flex flex-wrap items-center gap-3">
                {product.apk_download_url && (
                  <a
                    href={product.apk_download_url}
                    className="inline-flex items-center space-x-2 px-6 py-3 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-md shadow-[#FF5A36]/20"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Release APK</span>
                  </a>
                )}

                {isExternalProject && (
                  <a
                    href={product.project_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-6 py-3 rounded border border-[#39363A] bg-[#242329] hover:border-[#FF5A36] text-[#F4F0E8] text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    <span>Launch Live Portal</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#FF5A36]" />
                  </a>
                )}

                {product.category === 'Games' && (
                  <Link
                    href={`/games/${product.slug}`}
                    className="inline-flex items-center space-x-2 px-6 py-3 rounded border border-[#39363A] bg-[#242329] hover:border-[#FF5A36] text-[#F4F0E8] text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    <span>Dedicated Game Hub</span>
                    <ArrowLeft className="w-3.5 h-3.5 rotate-180 text-[#FF5A36]" />
                  </Link>
                )}

                {product.github_url && (
                  <a
                    href={product.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs text-[#96929A] hover:text-[#F4F0E8] font-semibold px-3 py-2 transition-colors"
                  >
                    <span>GitHub Repository</span>
                    <ExternalLink className="w-3 h-3 text-[#FF5A36]" />
                  </a>
                )}

                {product.play_store_url && (
                  <a
                    href={product.play_store_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs text-[#96929A] hover:text-[#F4F0E8] font-semibold px-3 py-2 transition-colors"
                  >
                    <span>Google Play</span>
                    <ExternalLink className="w-3 h-3 text-[#FF5A36]" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content & Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Main Description */}
          <div className="lg:col-span-8 space-y-8">
            <div className="p-8 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-4 shadow-xl">
              <div className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A36]" />
                <h3 className="font-display text-lg font-bold uppercase tracking-wide text-[#F4F0E8]">
                  Product Overview &amp; Specifications
                </h3>
              </div>
              <div className="text-xs sm:text-sm text-[#C2BEC1] leading-relaxed whitespace-pre-line space-y-4">
                {product.description}
              </div>
            </div>

            {/* Gallery Screenshots if available */}
            {product.gallery && product.gallery.length > 0 && (
              <div className="p-8 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A36]" />
                    <h3 className="font-display text-lg font-bold uppercase tracking-wide text-[#F4F0E8]">
                      Visual Gallery &amp; Screenshots
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-[#96929A] uppercase">
                    {product.gallery.length} Images
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  {product.gallery.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => setLightboxImage(img)}
                      className="group relative aspect-[16/10] rounded-lg overflow-hidden border border-[#39363A] bg-[#101014] cursor-pointer hover:border-[#FF5A36] transition-all"
                    >
                      <img
                        src={img}
                        alt={`Screenshot ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-[#101014]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="p-2 rounded bg-[#101014]/90 border border-[#39363A] text-[#F4F0E8]">
                          <Maximize2 className="w-4 h-4 text-[#FF5A36]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Metadata */}
          <div className="lg:col-span-4 space-y-6">
            {/* Spec Sheet */}
            <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-4 shadow-xl">
              <h4 className="font-display text-sm font-bold uppercase tracking-wider text-[#F4F0E8] border-b border-[#39363A] pb-3">
                SYSTEM TELEMETRY
              </h4>
              <dl className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-[#96929A]">Category</dt>
                  <dd className="font-semibold text-[#F4F0E8]">{product.category}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[#96929A]">Platform</dt>
                  <dd className="font-semibold text-[#F4F0E8]">{product.platform}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[#96929A]">Publication Status</dt>
                  <dd className="font-mono text-emerald-400 font-semibold">{product.status}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[#96929A]">Direct Binary</dt>
                  <dd className="font-mono text-[#F4F0E8]">
                    {product.apk_download_url ? 'Available (Signed)' : 'N/A (Web/Private)'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[#96929A]">Distribution</dt>
                  <dd className="text-[#F4F0E8]">Karsh Tech Autonomous Pipeline</dd>
                </div>
              </dl>
            </div>

            {/* Custom Commission Card */}
            <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-3 shadow-xl">
              <span className="text-[10px] font-mono-code uppercase text-[#FF5A36] tracking-wider font-semibold">
                CUSTOM ENGINEERING
              </span>
              <h4 className="font-display text-base font-bold uppercase text-[#F4F0E8]">
                NEED A SIMILAR SOLUTION?
              </h4>
              <p className="text-xs text-[#96929A] leading-relaxed">
                We engineer scalable websites, custom web apps, and native mobile applications tailored directly to your technical requirements.
              </p>
              <div className="pt-2">
                <Link
                  href="/contact"
                  className="w-full inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-md shadow-[#FF5A36]/20"
                >
                  <span>Request a Technical Brief</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Other Products Section */}
        {otherProducts.length > 0 && (
          <div className="pt-10 border-t border-[#39363A] space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-[#FF5A36] uppercase tracking-wider font-semibold">
                  CATALOG
                </span>
                <h3 className="font-display text-xl font-bold uppercase text-[#F4F0E8]">
                  EXPLORE OTHER PRODUCTS
                </h3>
              </div>
              <Link
                href="/products"
                className="text-xs font-bold uppercase text-[#96929A] hover:text-[#FF5A36] transition-colors"
              >
                View Full Archive →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {otherProducts.map((other) => {
                const targetLink = other.category === 'Games' ? `/games/${other.slug}` : `/products/${other.slug}`;
                return (
                  <Link
                    key={other.id}
                    href={targetLink}
                    className="p-5 rounded-xl border border-[#39363A] bg-[#1A191F] hover:border-[#FF5A36] transition-all group block space-y-3"
                  >
                    <div className="aspect-[16/10] rounded-lg overflow-hidden bg-[#101014] border border-[#39363A]">
                      <img
                        src={other.cover_image || '/brand/karsh-tech-full.png'}
                        alt={other.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/brand/karsh-tech-full.png';
                        }}
                      />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-mono text-[#FF5A36] font-semibold">
                        {other.category}
                      </span>
                      <h4 className="font-display text-base font-bold uppercase text-[#F4F0E8] group-hover:text-[#FF5A36] transition-colors mt-0.5 line-clamp-1">
                        {other.name}
                      </h4>
                      <p className="text-xs text-[#96929A] line-clamp-2 mt-1">
                        {other.short_description || other.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

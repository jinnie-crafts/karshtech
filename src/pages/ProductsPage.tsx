import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from '../context/RouterContext';
import { api } from '../lib/api';
import type { Product, ProductCategory } from '../types';
import { containerVariants, fadeUpVariants } from '../lib/motion';
import {
  Search,
  X,
  ExternalLink,
  Download,
  ArrowRight,
  ShieldCheck,
  Code2,
  Gamepad2,
  Layers,
  Sparkles,
  Smartphone,
  Globe,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    'All',
    'Websites',
    'Web Applications',
    'Mobile Applications',
    'Games',
    'Custom Software',
  ];

  useEffect(() => {
    document.title = 'Products & Work — Karsh Tech';
    let isMounted = true;

    async function fetchProducts() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getProducts();
        if (isMounted) {
          setProducts(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load products');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered and sorted products (guaranteed newest-first)
  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      // Category filter
      let matchesCategory = true;
      if (selectedCategory !== 'All') {
        if (selectedCategory === 'Mobile Applications') {
          matchesCategory = p.category === 'Mobile Applications' || p.category === 'Games';
        } else if (selectedCategory === 'Websites') {
          matchesCategory = p.category === 'Websites' || p.category === 'Web Applications';
        } else {
          matchesCategory = p.category === selectedCategory;
        }
      }

      // Search query filter
      let matchesSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inName = p.name.toLowerCase().includes(q);
        const inTagline = (p.short_description || '').toLowerCase().includes(q);
        const inDesc = (p.description || '').toLowerCase().includes(q);
        const inTech = (p.technologies || []).some((t) => t.toLowerCase().includes(q));
        const inCat = p.category.toLowerCase().includes(q);
        const inPlatform = (p.platform || '').toLowerCase().includes(q);
        matchesSearch = inName || inTagline || inDesc || inTech || inCat || inPlatform;
      }

      return matchesCategory && matchesSearch;
    });

    return list.sort((a, b) => {
      const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [products, selectedCategory, searchQuery]);

  // Determine detail link for product
  const getDetailLink = (p: Product) => {
    if (p.category === 'Games') {
      return `/games/${p.slug}`;
    }
    return `/products/${p.slug}`;
  };

  return (
    <div className="min-h-screen pt-28 pb-24 text-[#C2BEC1] bg-[#101014] font-sans overflow-hidden">
      {/* Page Header */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 text-center mb-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4 flex flex-col items-center"
        >
          <motion.div variants={fadeUpVariants} className="flex items-center space-x-2.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#FF5A36] animate-pulse" />
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              KARSH TECH PRODUCTS // SOFTWARE &amp; PLATFORMS
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUpVariants}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-tight text-[#F4F0E8] leading-tight"
          >
            OUR WORK &amp; <span className="text-[#FF5A36]">PRODUCTS.</span>
          </motion.h1>

          <motion.p
            variants={fadeUpVariants}
            className="text-xs sm:text-sm text-[#C2BEC1] max-w-2xl mx-auto leading-relaxed pt-1"
          >
            A curated showcase of software, digital platforms, interactive games, and custom applications engineered by Karsh Tech.
            We build purposeful products from conception to high-performance production.
          </motion.p>

          {/* Search Bar */}
          <motion.div variants={fadeUpVariants} className="w-full max-w-md pt-4">
            <div className="relative">
              <Search className="w-4 h-4 text-[#96929A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by title, stack, or category..."
                className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[#1A191F] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A] focus:outline-none focus:border-[#FF5A36] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#96929A] hover:text-[#F4F0E8]"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Category Filter Pills */}
          <motion.div variants={fadeUpVariants} className="pt-4 flex flex-wrap justify-center gap-2">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    active
                      ? 'bg-[#FF5A36] text-[#101014] shadow-md shadow-[#FF5A36]/20 font-bold'
                      : 'bg-[#1A191F] text-[#96929A] hover:text-[#F4F0E8] border border-[#39363A] hover:border-[#FF5A36]/50'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </motion.div>
        </motion.div>
      </section>

      {/* Products Catalog Section */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 text-[#FF5A36] animate-spin" />
            <span className="text-xs font-mono uppercase tracking-widest text-[#96929A]">
              Loading product archive...
            </span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-8 text-center max-w-xl mx-auto space-y-3">
            <p className="text-sm text-rose-300 font-semibold">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#FF5A36] text-[#101014] text-xs font-bold uppercase rounded"
            >
              Retry
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {filteredProducts.length > 0 ? (
              <motion.div
                key={`${selectedCategory}_${searchQuery}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="space-y-10"
              >
                {filteredProducts.map((product, pIdx) => {
                  const detailHref = getDetailLink(product);
                  const isExternalProject = product.project_url && product.project_url.startsWith('http');

                  return (
                    <div
                      key={product.id}
                      className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 sm:p-10 shadow-2xl hover:border-[#FF5A36]/60 transition-all"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                        {/* Media / Visual Preview */}
                        <div className="lg:col-span-5 relative">
                          <Link href={detailHref} className="block group">
                            <div className="relative aspect-[16/10] w-full rounded-lg overflow-hidden border border-[#39363A] bg-[#101014]">
                              <img
                                src={product.cover_image || '/brand/karsh-tech-full.png'}
                                alt={product.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/brand/karsh-tech-full.png';
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#101014]/90 via-transparent to-transparent" />
                              <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-1 rounded bg-[#FF5A36] text-[#101014] text-[10px] font-bold uppercase tracking-wider">
                                  {product.category}
                                </span>
                                {product.platform && (
                                  <span className="px-2 py-0.5 rounded bg-[#101014]/85 border border-[#39363A] text-[#F4F0E8] text-[10px] font-mono-code">
                                    {product.platform}
                                  </span>
                                )}
                                {product.featured && (
                                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    Featured
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        </div>

                        {/* Content Details */}
                        <div className="lg:col-span-7 space-y-4">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#FF5A36] font-semibold">
                                PRODUCT // 0{pIdx + 1}
                              </span>
                            </div>
                            <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase text-[#F4F0E8] mt-0.5 hover:text-[#FF5A36] transition-colors">
                              <Link href={detailHref}>{product.name}</Link>
                            </h2>
                            {product.short_description && (
                              <p className="text-xs sm:text-sm text-[#FF5A36] font-mono-code font-medium mt-0.5">
                                {product.short_description}
                              </p>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm text-[#C2BEC1] leading-relaxed line-clamp-3">
                            {product.description}
                          </p>

                          {/* Technologies */}
                          {product.technologies && product.technologies.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[10px] uppercase font-mono tracking-wider text-[#96929A]">
                                Technology Stack
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

                          {/* Action Links */}
                          <div className="pt-3 flex flex-wrap items-center gap-3">
                            <Link
                              href={detailHref}
                              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-md shadow-[#FF5A36]/20"
                            >
                              <span>Explore Details</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>

                            {product.apk_download_url && (
                              <a
                                href={product.apk_download_url}
                                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded border border-[#39363A] bg-[#242329] hover:border-[#FF5A36] text-[#F4F0E8] text-xs font-bold uppercase tracking-wider transition-colors"
                              >
                                <Download className="w-3.5 h-3.5 text-[#FF5A36]" />
                                <span>Download Release APK</span>
                              </a>
                            )}

                            {isExternalProject && (
                              <a
                                href={product.project_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1.5 text-xs text-[#96929A] hover:text-[#F4F0E8] transition-colors font-semibold px-2 py-2"
                              >
                                <span>View Live Portal</span>
                                <ExternalLink className="w-3.5 h-3.5 text-[#FF5A36]" />
                              </a>
                            )}

                            {product.github_url && (
                              <a
                                href={product.github_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1.5 text-xs text-[#96929A] hover:text-[#F4F0E8] transition-colors font-semibold px-2 py-2"
                              >
                                <span>Source Code</span>
                                <ExternalLink className="w-3.5 h-3.5 text-[#FF5A36]" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            ) : (
              /* Dignified Empty State */
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-[#39363A] bg-[#1A191F] p-12 text-center max-w-2xl mx-auto space-y-4"
              >
                <div className="w-12 h-12 rounded-full bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36] mx-auto">
                  <Code2 className="w-6 h-6" />
                </div>
                <h3 className="font-display text-xl font-bold uppercase text-[#F4F0E8]">
                  {searchQuery
                    ? `NO PRODUCTS MATCHING "${searchQuery.toUpperCase()}"`
                    : `NO PUBLIC CATALOG ENTRIES IN ${selectedCategory.toUpperCase()}`}
                </h3>
                <p className="text-xs text-[#96929A] leading-relaxed">
                  {searchQuery
                    ? 'Try searching with different keywords, technology names, or resetting the category filter.'
                    : 'Custom software deliverables, private corporate web platforms, and internal tools are delivered directly to client environments and are not publicly indexed in this open archive.'}
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-3">
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="inline-flex items-center space-x-2 px-5 py-2.5 rounded border border-[#39363A] bg-[#242329] text-[#F4F0E8] hover:border-[#FF5A36] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <span>Clear Search</span>
                    </button>
                  )}
                  <Link
                    href="/contact"
                    className="inline-flex items-center space-x-2 px-6 py-2.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    <span>Inquire About Custom Projects</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </section>

      {/* Contact Banner */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 mt-20">
        <div className="p-8 sm:p-10 rounded-xl border border-[#39363A] bg-[#1A191F] flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div>
            <span className="text-[10px] font-mono-code uppercase text-[#FF5A36] tracking-wider font-semibold">
              COMMISSION WORK
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase text-[#F4F0E8] mt-1">
              BUILD WITH KARSH TECH
            </h2>
            <p className="text-xs text-[#96929A] mt-1 max-w-md">
              Need a modern website, custom web application, or standalone software build? Let's discuss your requirements.
            </p>
          </div>
          <Link
            href="/contact"
            className="flex-shrink-0 inline-flex items-center space-x-2 px-6 py-3.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-md"
          >
            <span>Start a Conversation</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};

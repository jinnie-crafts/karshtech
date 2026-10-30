import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DashboardStats } from '../types';
import { api } from '../lib/api';
import { Link } from '../context/RouterContext';
import { useGames } from '../context/GamesContext';
import { GameCard } from '../components/GameCard';
import { containerVariants, fadeUpVariants } from '../lib/motion';
import {
  Globe,
  Layout,
  Smartphone,
  Gamepad2,
  Code2,
  ArrowRight,
  CheckCircle2,
  Send,
  Mail,
  ChevronDown,
  HelpCircle,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  Terminal,
  ExternalLink,
  Target,
  Compass,
  Zap,
  Repeat,
  Download,
} from 'lucide-react';

const organizationFaqs = [
  {
    q: 'What is Karsh Tech?',
    a: 'Karsh Tech is an independent technology and digital product development organization. We design, engineer, and deploy purposeful websites, web applications, mobile applications, interactive games, and custom software solutions.',
  },
  {
    q: 'What services does Karsh Tech offer?',
    a: 'We offer five core engineering disciplines: modern website development, interactive web application development, native mobile application development (Android/Kotlin), game engineering, and bespoke custom software utilities.',
  },
  {
    q: 'Does Karsh Tech develop websites?',
    a: 'Yes. We build responsive, high-performance websites for businesses, creators, and digital brands. Our focus is lightning-fast loading speeds, clean editorial design, accessibility, and robust semantic SEO.',
  },
  {
    q: 'Does Karsh Tech build web applications?',
    a: 'Yes. We engineer full-stack web applications, interactive dashboards, customer portals, and internal tools using modern reactive frameworks like React, Next.js, TypeScript, and Node.js with secure authentication and database persistence.',
  },
  {
    q: 'Does Karsh Tech develop mobile applications?',
    a: 'Yes. We build native Android applications engineered with Kotlin and Jetpack Compose, emphasizing sub-16ms touch responsiveness, battery efficiency, and offline-first reliability.',
  },
  {
    q: 'Does Karsh Tech develop games?',
    a: 'Yes. Games are a dedicated creative product category within our products catalog. We build distraction-free, mindful games featuring deterministic spatial logic, algorithmic solvability guarantees, zero advertisements, and 100% offline play (such as Arrow Puzzle).',
  },
  {
    q: 'Can I request custom software?',
    a: 'Yes. When standard commercial tools do not fit your operational workflow, we build purpose-built software, CLI utilities, automation scripts, and custom internal systems designed specifically around your requirements.',
  },
  {
    q: 'How can I discuss a project with Karsh Tech?',
    a: 'You can reach out through our Contact page form or email us directly at karshhtech@gmail.com. We review every project inquiry and provide a direct technical consultation.',
  },
  {
    q: 'How can I get support for a Karsh Tech product?',
    a: 'Visit our dedicated Support page at https://tech.aadirishi.in/support or email karshhtech@gmail.com with your product details and inquiry.',
  },
];

export const HomePage: React.FC = () => {
  const { games, featuredGame } = useGames();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    // Inject Organization FAQ Schema for AEO/SEO
    const scriptId = 'organization-faq-jsonld-schema';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': organizationFaqs.map((f) => ({
        '@type': 'Question',
        'name': f.q,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': f.a,
        },
      })),
    };
    script.text = JSON.stringify(faqSchema);

    return () => {
      const existing = document.getElementById(scriptId);
      if (existing) {
        existing.remove();
      }
    };
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const statsData = await api.getStats();
        setStats(statsData.stats);
      } catch (err) {
        console.error('Error loading homepage stats', err);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="relative w-full min-h-screen bg-[#101014] text-[#C2BEC1] font-sans overflow-hidden">
      
      {/* =========================================================================
          1. HERO SECTION (Technology Organization Identity)
          ========================================================================= */}
      <section className="relative min-h-[92vh] flex items-center justify-center pt-32 pb-20 px-6 sm:px-8 lg:px-12">
        {/* Subtle Ember Ambient Gradient */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[340px] bg-[#FF5A36]/8 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
            
            {/* Left Column: Bold Editorial Headline & Supporting Message */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="lg:col-span-7 space-y-6"
            >
              {/* Organization Micro Header */}
              <motion.div variants={fadeUpVariants} className="flex items-center space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-[#FF5A36] animate-pulse" />
                <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
                  KARSH TECH // INDEPENDENT TECHNOLOGY ORGANIZATION
                </span>
                <span className="text-[#39363A]">|</span>
                <span className="text-xs text-[#96929A] tracking-wider uppercase font-mono-code">
                  EST. 2026
                </span>
              </motion.div>

              {/* Primary Creative Direction Headline */}
              <motion.div variants={fadeUpVariants}>
                <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[5.4rem] font-bold tracking-tight uppercase leading-[0.92] text-[#F4F0E8]">
                  WE TURN IDEAS INTO <span className="text-[#FF5A36]">DIGITAL REALITY.</span>
                </h1>
              </motion.div>

              {/* Supporting Value Proposition */}
              <motion.p
                variants={fadeUpVariants}
                className="text-sm sm:text-base text-[#C2BEC1] leading-relaxed max-w-xl"
              >
                From websites and web applications to games and custom software, Karsh Tech builds purposeful digital products through thoughtful design and engineering.
              </motion.p>

              {/* Primary & Secondary Call to Actions */}
              <motion.div
                variants={fadeUpVariants}
                className="flex flex-wrap items-center gap-4 pt-2"
              >
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center space-x-2.5 px-7 py-3.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold tracking-[0.14em] uppercase transition-all shadow-md shadow-[#FF5A36]/25 hover:shadow-lg hover:shadow-[#FF5A36]/40 hover:-translate-y-0.5"
                >
                  <span>EXPLORE OUR PRODUCTS</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded border border-[#39363A] bg-[#1A191F] hover:border-[#FF5A36] hover:text-[#FF5A36] text-[#F4F0E8] text-xs font-bold tracking-[0.14em] uppercase transition-all"
                >
                  <Mail className="w-4 h-4 text-[#FF5A36]" />
                  <span>GET IN TOUCH</span>
                </Link>
              </motion.div>

              {/* Trust & Capability Indicators */}
              <motion.div variants={fadeUpVariants} className="pt-3 flex flex-wrap items-center gap-6 text-xs text-[#96929A]">
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>Modern Web Platforms</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>Native Android &amp; Games</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>Bespoke Software</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Right Column: Multi-Disciplinary Engineering Spotlight Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="lg:col-span-5 relative"
            >
              <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#39363A]">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF5A36]" />
                    <span className="font-display font-bold text-xs uppercase text-[#F4F0E8] tracking-wider">
                      ORGANIZATION FOCUS
                    </span>
                  </div>
                  <span className="text-[10px] font-mono-code uppercase text-[#96929A] tracking-wider">
                    PRODUCTION CAPABILITIES
                  </span>
                </div>

                {/* 4 Interactive Discipline Badges */}
                <div className="space-y-3">
                  <Link
                    href="/services#websites"
                    className="p-3.5 rounded-lg bg-[#101014] border border-[#39363A] hover:border-[#FF5A36]/60 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded bg-[#242329] text-[#FF5A36] flex items-center justify-center">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#F4F0E8] group-hover:text-[#FF5A36] transition-colors">
                          Websites &amp; Brand Platforms
                        </div>
                        <div className="text-[10px] text-[#96929A]">Fast, responsive, conversion-focused</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#96929A] group-hover:text-[#FF5A36] group-hover:translate-x-1 transition-all" />
                  </Link>

                  <Link
                    href="/services#web-applications"
                    className="p-3.5 rounded-lg bg-[#101014] border border-[#39363A] hover:border-[#FF5A36]/60 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded bg-[#242329] text-[#FF5A36] flex items-center justify-center">
                        <Layout className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#F4F0E8] group-hover:text-[#FF5A36] transition-colors">
                          Web Applications &amp; Dashboards
                        </div>
                        <div className="text-[10px] text-[#96929A]">Interactive platforms &amp; client portals</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#96929A] group-hover:text-[#FF5A36] group-hover:translate-x-1 transition-all" />
                  </Link>

                  <Link
                    href="/services#mobile-applications"
                    className="p-3.5 rounded-lg bg-[#101014] border border-[#39363A] hover:border-[#FF5A36]/60 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded bg-[#242329] text-[#FF5A36] flex items-center justify-center">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#F4F0E8] group-hover:text-[#FF5A36] transition-colors">
                          Mobile Applications &amp; Android
                        </div>
                        <div className="text-[10px] text-[#96929A]">Native Jetpack Compose execution</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#96929A] group-hover:text-[#FF5A36] group-hover:translate-x-1 transition-all" />
                  </Link>

                  <Link
                    href="/services#games"
                    className="p-3.5 rounded-lg bg-[#101014] border border-[#39363A] hover:border-[#FF5A36]/60 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded bg-[#242329] text-[#FF5A36] flex items-center justify-center">
                        <Gamepad2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#F4F0E8] group-hover:text-[#FF5A36] transition-colors">
                          Tactile Games &amp; Spatial Logic
                        </div>
                        <div className="text-[10px] text-[#96929A]">Featuring Arrow Puzzle (v1.0.0 APK)</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#96929A] group-hover:text-[#FF5A36] group-hover:translate-x-1 transition-all" />
                  </Link>

                  <Link
                    href="/services#custom-software"
                    className="p-3.5 rounded-lg bg-[#101014] border border-[#39363A] hover:border-[#FF5A36]/60 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded bg-[#242329] text-[#FF5A36] flex items-center justify-center">
                        <Code2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#F4F0E8] group-hover:text-[#FF5A36] transition-colors">
                          Custom Software &amp; Utilities
                        </div>
                        <div className="text-[10px] text-[#96929A]">Bespoke operational systems &amp; tools</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#96929A] group-hover:text-[#FF5A36] group-hover:translate-x-1 transition-all" />
                  </Link>
                </div>

                <div className="pt-2">
                  <Link
                    href="/contact"
                    className="w-full inline-flex items-center justify-center space-x-2 py-3 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>START A PROJECT CONVERSATION</span>
                  </Link>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          2. WHAT WE DO (The Four Main Service Categories)
          ========================================================================= */}
      <section className="relative py-20 px-6 sm:px-8 lg:px-12 border-t border-[#39363A] bg-[#101014]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center space-x-2.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              CORE DISCIPLINES
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-bold uppercase text-[#F4F0E8] leading-tight">
                WHAT WE <span className="text-[#FF5A36]">DO.</span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#C2BEC1] max-w-md leading-relaxed">
              We specialize in four primary digital service categories, building solutions that are durable, fast, and engineered for long-term utility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. Websites */}
            <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] hover:border-[#FF5A36]/60 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36]">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl font-bold uppercase text-[#F4F0E8]">
                  WEBSITES
                </h3>
                <p className="text-xs text-[#96929A] leading-relaxed">
                  Modern, responsive, high-performance websites for businesses and digital brands. We build accessible, fast-loading web presences designed to leave a lasting impression.
                </p>
              </div>
              <div className="pt-3 border-t border-[#39363A]/40 flex items-center justify-between">
                <span className="text-[10px] font-mono-code text-[#FF5A36]">Vite • React • Next.js</span>
                <Link href="/services#websites" className="text-xs text-[#F4F0E8] hover:text-[#FF5A36] font-bold uppercase">
                  Details →
                </Link>
              </div>
            </div>

            {/* 2. Web Applications */}
            <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] hover:border-[#FF5A36]/60 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36]">
                  <Layout className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl font-bold uppercase text-[#F4F0E8]">
                  WEB APPLICATIONS
                </h3>
                <p className="text-xs text-[#96929A] leading-relaxed">
                  Interactive platforms, dashboards, portals, and browser-based applications. From secure role-based portals to complex UI state management and transactional APIs.
                </p>
              </div>
              <div className="pt-3 border-t border-[#39363A]/40 flex items-center justify-between">
                <span className="text-[10px] font-mono-code text-[#FF5A36]">TypeScript • Node • JWT</span>
                <Link href="/services#web-applications" className="text-xs text-[#F4F0E8] hover:text-[#FF5A36] font-bold uppercase">
                  Details →
                </Link>
              </div>
            </div>

            {/* 3. Mobile Applications & Games */}
            <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] hover:border-[#FF5A36]/60 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36]">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl font-bold uppercase text-[#F4F0E8]">
                  MOBILE &amp; GAMES
                </h3>
                <p className="text-xs text-[#96929A] leading-relaxed">
                  Engaging Android applications, interactive experiences, and games. Built natively with Jetpack Compose for sub-16ms touch responsiveness and offline-first reliability.
                </p>
              </div>
              <div className="pt-3 border-t border-[#39363A]/40 flex items-center justify-between">
                <span className="text-[10px] font-mono-code text-[#FF5A36]">Android • Kotlin • Compose</span>
                <Link href="/services#mobile-applications" className="text-xs text-[#F4F0E8] hover:text-[#FF5A36] font-bold uppercase">
                  Details →
                </Link>
              </div>
            </div>

            {/* 4. Custom Software */}
            <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] hover:border-[#FF5A36]/60 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36]">
                  <Code2 className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl font-bold uppercase text-[#F4F0E8]">
                  CUSTOM SOFTWARE
                </h3>
                <p className="text-xs text-[#96929A] leading-relaxed">
                  Purpose-built software solutions designed around specific workflows, data structures, and operational requirements. Eliminates repetitive manual work without SaaS lock-in.
                </p>
              </div>
              <div className="pt-3 border-t border-[#39363A]/40 flex items-center justify-between">
                <span className="text-[10px] font-mono-code text-[#FF5A36]">APIs • CLI • Systems</span>
                <Link href="/services#custom-software" className="text-xs text-[#F4F0E8] hover:text-[#FF5A36] font-bold uppercase">
                  Details →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. FEATURED WORK / PORTFOLIO (Arrow Puzzle as ONE product)
          ========================================================================= */}
      <section className="relative py-20 px-6 sm:px-8 lg:px-12 border-t border-[#39363A] bg-[#101014]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center space-x-2.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              PRODUCTS HIGHLIGHTS
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-bold uppercase text-[#F4F0E8] leading-tight">
                FEATURED <span className="text-[#FF5A36]">WORK.</span>
              </h2>
            </div>
            <Link
              href="/products"
              className="text-xs font-bold tracking-[0.14em] uppercase text-[#C2BEC1] hover:text-[#FF5A36] transition-colors flex items-center space-x-1"
            >
              <span>VIEW ALL PRODUCTS</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#FF5A36]" />
            </Link>
          </div>

          {/* Featured Product: Arrow Puzzle */}
          {featuredGame ? (
            <div className="w-full rounded-2xl border border-[#39363A] bg-[#1A191F] p-6 sm:p-8 lg:p-10 shadow-2xl transition-all hover:border-[#FF5A36]/40">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                
                {/* Left Column (7 cols): Game Media & Visual Preview */}
                <div className="lg:col-span-7">
                  <div className="relative aspect-[16/9] rounded-xl overflow-hidden border border-[#39363A] bg-[#101014] group shadow-inner">
                    <img
                      src={featuredGame.cover_image || '/uploads/images/default_cover.jpg'}
                      alt={featuredGame.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#101014]/90 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-[#F4F0E8]">
                      <span className="font-bold text-sm tracking-wide">{featuredGame.title}</span>
                      <span className="font-mono-code text-[#FF5A36] font-bold px-2.5 py-1 rounded bg-[#101014]/80 border border-[#39363A]">
                        Android Exclusive
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column (5 cols): Game Details & Action Channels */}
                <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded bg-[#FF5A36] text-[#101014] text-[10px] font-bold uppercase tracking-wider font-display">
                        FEATURED RELEASE // GAMES
                      </span>
                      <span className="text-[10px] font-mono-code text-[#96929A] font-semibold">
                        {featuredGame.latest_release ? `v${featuredGame.latest_release.version_name}` : 'v1.0.0'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F0E8] leading-tight uppercase">
                        {featuredGame.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#FF5A36] font-mono-code font-medium mt-1">
                        {featuredGame.tagline || 'Spatial Logic Challenge'}
                      </p>
                      <p className="text-xs sm:text-sm text-[#C2BEC1] leading-relaxed mt-3">
                        {featuredGame.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="px-2.5 py-1 rounded bg-[#101014] border border-[#39363A] text-[10px] font-mono-code text-[#C2BEC1]">
                        Jetpack Compose
                      </span>
                      <span className="px-2.5 py-1 rounded bg-[#101014] border border-[#39363A] text-[10px] font-mono-code text-[#C2BEC1]">
                        Kotlin
                      </span>
                      <span className="px-2.5 py-1 rounded bg-[#101014] border border-[#39363A] text-[10px] font-mono-code text-[#C2BEC1]">
                        100% Offline
                      </span>
                      <span className="px-2.5 py-1 rounded bg-[#101014] border border-[#39363A] text-[10px] font-mono-code text-[#C2BEC1]">
                        Zero Ads
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#39363A]/60 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/games/${featuredGame.slug}`}
                      className="inline-flex items-center space-x-2 px-6 py-3 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-md shadow-[#FF5A36]/20"
                    >
                      <span>View Game Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    {featuredGame.latest_release?.apk_download_url && (
                      <a
                        href={featuredGame.latest_release.apk_download_url}
                        className="inline-flex items-center space-x-2 px-5 py-3 rounded border border-[#39363A] bg-[#242329] hover:border-[#FF5A36] text-[#F4F0E8] text-xs font-bold uppercase tracking-wider transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-[#FF5A36]" />
                        <span>Direct Download APK</span>
                      </a>
                    )}
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="p-8 sm:p-12 rounded-xl border border-[#39363A] bg-[#1A191F] text-center space-y-4">
              <p className="text-sm text-[#96929A]">Explore all projects, software, and games across Karsh Tech disciplines in our products catalog.</p>
              <Link
                href="/products"
                className="inline-flex items-center space-x-2 px-6 py-3 rounded bg-[#FF5A36] text-[#101014] text-xs font-bold uppercase tracking-wider hover:bg-[#FF7454] transition-colors"
              >
                <span>Browse Products Catalog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          4. WHY KARSH TECH (The Five Core Pillars)
          ========================================================================= */}
      <section className="relative py-20 px-6 sm:px-8 lg:px-12 border-t border-[#39363A] bg-[#101014]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center space-x-2.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              ENGINEERING PRINCIPLES
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-bold uppercase text-[#F4F0E8] leading-tight">
                WHY <span className="text-[#FF5A36]">KARSH TECH.</span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#C2BEC1] max-w-md leading-relaxed">
              How our organization approaches development: rigorous engineering standards, respect for the end user, and practical technical innovation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {/* Pillar 1 */}
            <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 hover:border-[#FF5A36]/60 transition-all space-y-3">
              <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36]">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold uppercase text-[#F4F0E8]">
                PURPOSEFUL PROBLEM-SOLVING
              </h3>
              <p className="text-xs text-[#96929A] leading-relaxed">
                We avoid building software for the sake of novelty. Every architecture and feature is engineered to address genuine requirements.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 hover:border-[#FF5A36]/60 transition-all space-y-3">
              <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36]">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold uppercase text-[#F4F0E8]">
                THOUGHTFUL EXPERIENCES
              </h3>
              <p className="text-xs text-[#96929A] leading-relaxed">
                We design interfaces that respect human cognitive attention. Zero dark patterns, zero intrusive bloatware, and intuitive navigation.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 hover:border-[#FF5A36]/60 transition-all space-y-3">
              <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold uppercase text-[#F4F0E8]">
                RELIABLE ENGINEERING
              </h3>
              <p className="text-xs text-[#96929A] leading-relaxed">
                Strong typing with TypeScript, native performance optimizations, cryptographic security, and battle-tested error boundaries.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 hover:border-[#FF5A36]/60 transition-all space-y-3">
              <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36]">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold uppercase text-[#F4F0E8]">
                PRACTICAL INNOVATION
              </h3>
              <p className="text-xs text-[#96929A] leading-relaxed">
                Applying modern tools (React 19, Jetpack Compose, Vite) to create tangible improvements in speed, responsiveness, and reliability.
              </p>
            </div>

            {/* Pillar 5 */}
            <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 hover:border-[#FF5A36]/60 transition-all space-y-3">
              <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] flex items-center justify-center text-[#FF5A36]">
                <Repeat className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold uppercase text-[#F4F0E8]">
                CONTINUOUS IMPROVEMENT
              </h3>
              <p className="text-xs text-[#96929A] leading-relaxed">
                Ongoing refinement, performance auditing, and code hardening based on real-world runtime metrics and evolving standards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. DEVELOPMENT PROCESS (Clear Five-Step Workflow)
          ========================================================================= */}
      <section className="relative py-20 px-6 sm:px-8 lg:px-12 border-t border-[#39363A] bg-[#101014]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center space-x-2.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              WORKFLOW &amp; EXECUTION
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-bold uppercase text-[#F4F0E8] leading-tight">
                DEVELOPMENT <span className="text-[#FF5A36]">PROCESS.</span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#C2BEC1] max-w-md leading-relaxed">
              From the initial idea to post-deployment maintenance, our structured five-stage workflow ensures transparent delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-3 relative">
              <span className="text-2xl font-mono-code font-bold text-[#FF5A36]">01</span>
              <h3 className="font-display text-base font-bold uppercase text-[#F4F0E8]">
                UNDERSTAND &amp; SCOPE
              </h3>
              <p className="text-xs text-[#96929A] leading-relaxed">
                We review your goals, examine operational requirements, and define clear project scope and technical milestones.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-3 relative">
              <span className="text-2xl font-mono-code font-bold text-[#FF5A36]">02</span>
              <h3 className="font-display text-base font-bold uppercase text-[#F4F0E8]">
                PLAN &amp; DESIGN
              </h3>
              <p className="text-xs text-[#96929A] leading-relaxed">
                Architecture blueprints, data schemas, API contracts, and user experience wireframes mapped before writing code.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-3 relative">
              <span className="text-2xl font-mono-code font-bold text-[#FF5A36]">03</span>
              <h3 className="font-display text-base font-bold uppercase text-[#F4F0E8]">
                DEVELOP &amp; IMPLEMENT
              </h3>
              <p className="text-xs text-[#96929A] leading-relaxed">
                High-performance development in modular TypeScript, React, or native Kotlin with clean documentation.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-3 relative">
              <span className="text-2xl font-mono-code font-bold text-[#FF5A36]">04</span>
              <h3 className="font-display text-base font-bold uppercase text-[#F4F0E8]">
                TEST &amp; REFINE
              </h3>
              <p className="text-xs text-[#96929A] leading-relaxed">
                Automated security testing, regression checks, cross-device responsiveness verification, and performance tuning.
              </p>
            </div>

            {/* Step 5 */}
            <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-3 relative">
              <span className="text-2xl font-mono-code font-bold text-[#FF5A36]">05</span>
              <h3 className="font-display text-base font-bold uppercase text-[#F4F0E8]">
                DEPLOY &amp; MAINTAIN
              </h3>
              <p className="text-xs text-[#96929A] leading-relaxed">
                Production release rollout, cryptographic binary signing, server configuration, and ongoing support.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. ORGANIZATION-WIDE FAQ (AEO & AI Search Intelligence)
          ========================================================================= */}
      <section className="relative py-20 px-6 sm:px-8 lg:px-12 border-t border-[#39363A] bg-[#101014]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-3 mb-12">
            <div className="flex items-center justify-center space-x-2.5">
              <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
              <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
                KNOWLEDGE BASE
              </span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#F4F0E8]">
              FREQUENTLY ASKED <span className="text-[#FF5A36]">QUESTIONS</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#96929A] max-w-lg mx-auto">
              Answers to common inquiries regarding Karsh Tech, our digital services, project consultation, and development workflows.
            </p>
          </div>

          <div className="space-y-3">
            {organizationFaqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-[#39363A] bg-[#1A191F] overflow-hidden transition-colors hover:border-[#39363A]/80"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center space-x-3">
                      <HelpCircle className="w-4 h-4 text-[#FF5A36] flex-shrink-0" />
                      <span className="font-display text-sm sm:text-base font-bold text-[#F4F0E8]">
                        {faq.q}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-[#96929A] transition-transform duration-200 flex-shrink-0 ${
                        isOpen ? 'rotate-180 text-[#FF5A36]' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-5 pb-5 pt-0 text-xs text-[#C2BEC1] leading-relaxed border-t border-[#39363A]/40"
                      >
                        <p className="pt-3">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. CONTACT CTA (Direct Invitation)
          ========================================================================= */}
      <section className="relative py-20 px-6 sm:px-8 lg:px-12 border-t border-[#39363A] bg-[#101014]">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-8 sm:p-12 text-center space-y-6 shadow-2xl">
            <div className="w-12 h-12 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6" />
            </div>

            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold uppercase tracking-tight text-[#F4F0E8]">
              DISCUSS YOUR PROJECT WITH <span className="text-[#FF5A36]">KARSH TECH.</span>
            </h2>

            <p className="text-xs sm:text-sm text-[#C2BEC1] max-w-xl mx-auto leading-relaxed">
              We invite businesses, founders, creators, and individuals to discuss new digital products, website builds, applications, and custom software. Reach out directly to initiate consultation.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link
                href="/contact"
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-8 py-3.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-md"
              >
                <Send className="w-4 h-4" />
                <span>Go to Contact Form</span>
              </Link>

              <a
                href="mailto:karshhtech@gmail.com"
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded border border-[#39363A] bg-[#242329] hover:border-[#FF5A36] text-[#F4F0E8] text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <Mail className="w-4 h-4 text-[#FF5A36]" />
                <span>karshhtech@gmail.com</span>
              </a>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

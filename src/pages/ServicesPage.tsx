import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from '../context/RouterContext';
import { containerVariants, fadeUpVariants } from '../lib/motion';
import {
  Globe,
  Layout,
  Smartphone,
  Gamepad2,
  Code2,
  CheckCircle2,
  ArrowRight,
  Mail,
  Send,
  Cpu,
  Layers,
  Sparkles,
  Terminal,
} from 'lucide-react';

interface ServiceItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  scope: string[];
  problemsSolved: string[];
  deliverables: string[];
  techStack: string[];
}

const servicesList: ServiceItem[] = [
  {
    id: 'websites',
    title: 'Website Development',
    subtitle: 'High-Performance Marketing & Corporate Sites',
    icon: Globe,
    description:
      'We design and build clean, accessible, and fast websites that establish your digital presence with authority. Every site is engineered with responsive layouts, optimal Core Web Vitals, and semantic SEO architectures.',
    scope: [
      'Corporate & studio brand websites',
      'Product showcase & portfolio landing pages',
      'Documentation & knowledge portals',
      'Responsive design across mobile, tablet, and ultra-wide displays',
    ],
    problemsSolved: [
      'Eliminates slow loading speeds and bloated page weights',
      'Fixes inconsistent mobile responsiveness and layout jank',
      'Establishes modern brand credibility without template fatigue',
      'Ensures accessible, search-engine-readable semantic markup',
    ],
    deliverables: [
      'Production-ready, statically optimized website bundle',
      'Semantic HTML5, clean CSS/Tailwind, and modern TypeScript code',
      'Structured metadata, OpenGraph tags, and sitemap configuration',
      'Deployment automation and hosting setup documentation',
    ],
    techStack: ['React', 'Next.js', 'Vite', 'Tailwind CSS', 'TypeScript', 'HTML5/Semantic Web'],
  },
  {
    id: 'web-applications',
    title: 'Web Application Development',
    subtitle: 'Interactive Portals, Dashboards & Platforms',
    icon: Layout,
    description:
      'From client dashboards to interactive administrative portals, we build durable web applications that streamline complex business processes and deliver intuitive user workflows.',
    scope: [
      'Client portals and administrative dashboards',
      'Authentication, role-based access control, and session security',
      'Real-time data visualization and interactive filtering',
      'RESTful and GraphQL API design and backend integration',
    ],
    problemsSolved: [
      'Replaces fragile spreadsheets with centralized, auditable data management',
      'Provides secure multi-role access with hardened authentication',
      'Resolves state synchronization and caching bottlenecks in complex UIs',
      'Simplifies digital content, asset, and release pipelines',
    ],
    deliverables: [
      'Full-stack web application codebase with modular component architecture',
      'Hardened authentication flows with secure cookies and JWT handling',
      'Atomic database integration with transactional persistence',
      'API endpoint documentation and testing scripts',
    ],
    techStack: ['React 19', 'TypeScript', 'Node.js', 'Express', 'JWT', 'REST APIs', 'PostgreSQL/JSON DB'],
  },
  {
    id: 'mobile-applications',
    title: 'Mobile Application Development',
    subtitle: 'Native Android Solutions & Utilities',
    icon: Smartphone,
    description:
      'We build native Android applications engineered for fluid tactile interaction, battery efficiency, and offline-first reliability. We prioritize native UI frameworks, sub-16ms latency, and minimal binary footprints.',
    scope: [
      'Native Android applications engineered with Jetpack Compose',
      'Offline-first architecture with local persistence (DataStore / Room)',
      'Touch interaction and low-latency micro-interactions',
      'Standalone binary compilation and APK release packaging',
    ],
    problemsSolved: [
      'Avoids heavy hybrid web-view wrappers and sluggish frame drops',
      'Removes unwanted telemetry, ads, and background battery drains',
      'Ensures applications operate seamlessly without network connectivity',
      'Enables independent distribution directly to end users',
    ],
    deliverables: [
      'Compiled, signed production release APK binaries',
      'Release keystore integration and cryptographic SHA-256 checksums',
      'Complete native Kotlin / Android source codebase',
      'ProGuard / R8 code shrinking and optimization configurations',
    ],
    techStack: ['Android SDK', 'Kotlin', 'Jetpack Compose', 'DataStore', 'ProGuard / R8', 'Material 3'],
  },
  {
    id: 'games',
    title: 'Game Development',
    subtitle: 'Spatial Logic & Tactile Puzzle Experiences',
    icon: Gamepad2,
    description:
      'Our game engineering team crafts mindful, distraction-free games designed around spatial reasoning and algorithmic puzzle mechanics. We believe in respecting player attention—zero predatory dark patterns or ad bloat.',
    scope: [
      'Original puzzle logic and spatial board design',
      'Algorithmic solvability verification and procedural level generators',
      'Tactile feedback, audio immersion, and 60+ FPS touch responsiveness',
      'Direct APK distribution with verified cryptographic signatures',
    ],
    problemsSolved: [
      'Counters the epidemic of intrusive ads, paywalls, and timer traps in mobile games',
      'Ensures guaranteed mathematical solvability for puzzle tiers',
      'Optimizes performance to run smoothly on diverse Android hardware tiers',
      'Restores the joy of pure, contemplative, offline play',
    ],
    deliverables: [
      'Fully functional, release-signed game binaries (e.g. Arrow Puzzle)',
      'Algorithmic level sets and progressive difficulty tiers',
      'Custom visual themes, sound integration, and particle effects',
      'Store-ready metadata and direct download hosting setup',
    ],
    techStack: ['Android Compose', 'Kotlin', 'Game Loops', 'Spatial Algorithms', 'Vector Graphics'],
  },
  {
    id: 'custom-software',
    title: 'Custom Software Development',
    subtitle: 'Bespoke Engineering & Operational Utilities',
    icon: Code2,
    description:
      'When off-the-shelf software falls short, Karsh Tech engineers purpose-built software tailored precisely to your technical workflows, internal data structures, and operational requirements.',
    scope: [
      'Command-line utilities, batch processors, and automated CLI scripts',
      'Data migration, transformation, and reconciliation tools',
      'Custom publishing pipelines and digital asset management systems',
      'Local-first desktop tools and service integrations',
    ],
    problemsSolved: [
      'Automates repetitive, error-prone manual data handling',
      'Bridges incompatible legacy software systems and modern APIs',
      'Provides purpose-built internal tools without recurring SaaS seat fees',
      'Delivers maintainable, clean code that your organization fully owns',
    ],
    deliverables: [
      'Tested software executables or source packages with clean documentation',
      'Configuration schemas, environment variable templates, and runbooks',
      'Automated test suites verifying critical operational paths',
      'Deployment guide and ongoing maintenance handoff',
    ],
    techStack: ['Node.js', 'TypeScript', 'Python', 'Shell / Bash', 'JSON / SQLite', 'Docker'],
  },
];

export const ServicesPage: React.FC = () => {
  useEffect(() => {
    const handleHashScroll = () => {
      const hash = window.location.hash;
      if (hash) {
        const targetId = hash.replace('#', '');
        const el = document.getElementById(targetId);
        if (el) {
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
        }
      }
    };

    handleHashScroll();
    window.addEventListener('hashchange', handleHashScroll);
    return () => window.removeEventListener('hashchange', handleHashScroll);
  }, []);

  return (
    <div className="min-h-screen pt-28 pb-24 text-[#C2BEC1] bg-[#101014] font-sans overflow-hidden">
      {/* Page Header */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 text-center mb-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4 flex flex-col items-center"
        >
          <motion.div variants={fadeUpVariants} className="flex items-center space-x-2.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              KARSH TECH CAPABILITIES // CORE DISCIPLINES
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUpVariants}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-tight text-[#F4F0E8] leading-tight"
          >
            ENGINEERING <span className="text-[#FF5A36]">SERVICES.</span>
          </motion.h1>

          <motion.p
            variants={fadeUpVariants}
            className="text-xs sm:text-sm text-[#C2BEC1] max-w-2xl mx-auto leading-relaxed pt-1"
          >
            Karsh Tech is a multi-disciplinary technology organization. We engineer purposeful websites,
            web applications, mobile applications, games, and custom software designed to solve real problems with durability and speed.
          </motion.p>

          <motion.div variants={fadeUpVariants} className="pt-2 flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-md shadow-[#FF5A36]/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Discuss Your Project</span>
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded border border-[#39363A] bg-[#1A191F] hover:border-[#FF5A36] text-[#F4F0E8] text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <span>Explore Products</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Services Grid */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-12">
        {servicesList.map((service, idx) => {
          const Icon = service.icon;
          return (
            <div
              key={service.id}
              id={service.id}
              className="scroll-mt-28 rounded-xl border border-[#39363A] bg-[#1A191F] p-8 sm:p-10 transition-all hover:border-[#FF5A36]/50 shadow-xl"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Service Identity & Overview */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-lg bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#FF5A36] font-semibold">
                        SERVICE // 0{idx + 1}
                      </span>
                      <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase text-[#F4F0E8] leading-tight">
                        {service.title}
                      </h2>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-[#FF5A36] font-medium font-mono-code">
                    {service.subtitle}
                  </p>

                  <p className="text-xs sm:text-sm text-[#C2BEC1] leading-relaxed">
                    {service.description}
                  </p>

                  {/* Tech stack badges */}
                  <div className="pt-2">
                    <span className="text-[10px] uppercase font-mono-code text-[#96929A] tracking-wider block mb-2 font-semibold">
                      // CORE TECHNOLOGIES
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {service.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="px-2.5 py-1 rounded bg-[#101014] border border-[#39363A] text-[11px] font-mono-code text-[#C2BEC1]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3">
                    <Link
                      href="/contact"
                      className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#FF5A36] hover:text-[#FF7454] transition-colors group"
                    >
                      <span>Inquire About {service.title}</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>

                {/* Right Column: Scope, Problems Solved & Deliverables */}
                <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6 lg:pl-6 lg:border-l lg:border-[#39363A]">
                  {/* Scope of Work */}
                  <div className="p-5 rounded-lg bg-[#101014] border border-[#39363A] space-y-3">
                    <div className="text-xs font-bold font-display uppercase tracking-wider text-[#F4F0E8] flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-[#FF5A36]" />
                      <span>Scope of Work</span>
                    </div>
                    <ul className="space-y-2 text-xs text-[#C2BEC1]">
                      {service.scope.map((item, sIdx) => (
                        <li key={sIdx} className="flex items-start space-x-2">
                          <span className="text-[#FF5A36] font-bold font-mono">›</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Typical Deliverables */}
                  <div className="p-5 rounded-lg bg-[#101014] border border-[#39363A] space-y-3">
                    <div className="text-xs font-bold font-display uppercase tracking-wider text-[#F4F0E8] flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-[#FF5A36]" />
                      <span>Typical Deliverables</span>
                    </div>
                    <ul className="space-y-2 text-xs text-[#C2BEC1]">
                      {service.deliverables.map((item, dIdx) => (
                        <li key={dIdx} className="flex items-start space-x-2">
                          <span className="text-[#FF5A36] font-bold font-mono">›</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Problems We Solve */}
                  <div className="md:col-span-2 p-5 rounded-lg bg-[#101014] border border-[#39363A] space-y-3">
                    <div className="text-xs font-bold font-display uppercase tracking-wider text-[#F4F0E8] flex items-center space-x-2">
                      <Cpu className="w-4 h-4 text-[#FF5A36]" />
                      <span>Problems This Solves</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#C2BEC1]">
                      {service.problemsSolved.map((prob, pIdx) => (
                        <div key={pIdx} className="flex items-start space-x-2">
                          <span className="text-[#96929A] font-bold font-mono">•</span>
                          <span>{prob}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* How to Discuss a Project CTA */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 mt-20">
        <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-8 sm:p-12 text-center space-y-6 shadow-2xl">
          <div className="w-12 h-12 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center mx-auto">
            <Mail className="w-6 h-6" />
          </div>

          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#F4F0E8]">
            HAVE A PROJECT IN MIND?
          </h2>

          <p className="text-xs sm:text-sm text-[#C2BEC1] max-w-xl mx-auto leading-relaxed">
            Whether you need a modern web presence, a full-scale web application, an Android release, or a purpose-built software utility, Karsh Tech is ready to collaborate. Reach out directly to initiate technical discussion.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/contact"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-8 py-3.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-md"
            >
              <Send className="w-4 h-4" />
              <span>Initiate Project Consultation</span>
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
      </section>
    </div>
  );
};

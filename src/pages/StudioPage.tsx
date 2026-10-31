import React from 'react';
import { motion } from 'framer-motion';
import { Link } from '../context/RouterContext';
import { containerVariants, fadeUpVariants } from '../lib/motion';
import {
  Globe,
  Layout,
  Smartphone,
  Gamepad2,
  Code2,
  ShieldCheck,
  CheckCircle,
  Mail,
  Send,
  Target,
  Compass,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

export const StudioPage: React.FC = () => {
  const teamMembers = [
    {
      name: 'Harsh',
      role: 'Founder & Lead Systems Engineer',
      avatar: '/uploads/images/avatar_harsh.png',
      focus: 'Architecture, Systems Design, React & Android Jetpack Compose',
      bio: 'Leads engineering architecture and technical execution across Karsh Tech platforms and products, ensuring sub-16ms latency, durable databases, and clean codebases.',
    },
    {
      name: 'Komal',
      role: 'UI/UX & Product Designer',
      avatar: '/uploads/images/avatar_komal.png',
      focus: 'Design Systems, Motion Dynamics, Ergonomics & Accessibility',
      bio: 'Shapes the cinematic visual identity, typography scales, responsive layouts, and restrained micro-interactions that make Karsh Tech interfaces intuitive.',
    },
    {
      name: 'Aditya',
      role: 'Systems & Logic Designer',
      avatar: '/uploads/images/avatar_aditya.png',
      focus: 'Algorithmic Problem-Solving, Data Schemas, Game Mechanics',
      bio: 'Designs system logic, API workflows, and progressive puzzle algorithms that ensure deterministic solvability and reliable application behavior.',
    },
    
  ];

  return (
    <div className="min-h-screen pt-28 pb-24 text-[#C2BEC1] bg-[#101014] font-sans overflow-hidden">
      {/* Header */}
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
              ORGANIZATION PROFILE // EST. 2026
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUpVariants}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-tight text-[#F4F0E8] leading-tight"
          >
            ABOUT <span className="text-[#FF5A36]">KARSH TECH.</span>
          </motion.h1>

          <motion.p
            variants={fadeUpVariants}
            className="text-xs sm:text-sm text-[#C2BEC1] max-w-2xl mx-auto leading-relaxed pt-1"
          >
            Karsh Tech is an independent technology and digital product development organization.
            We design, engineer, and deploy purposeful websites, web applications, mobile applications, interactive games, and custom software solutions.
          </motion.p>
        </motion.div>
      </section>

      {/* Vision & Mission */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-8 space-y-4 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded bg-[#242329] text-[#FF5A36] flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <h2 className="font-display text-2xl font-bold uppercase text-[#F4F0E8]">
                OUR MISSION
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#C2BEC1] leading-relaxed">
              To turn ideas into durable, high-performance digital reality. We build software and digital experiences that respect user attention, operate with rock-solid stability, and solve tangible challenges without unnecessary bloat, predatory monetization, or fragile dependencies.
            </p>
          </div>

          <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-8 space-y-4 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded bg-[#242329] text-[#FF5A36] flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </div>
              <h2 className="font-display text-2xl font-bold uppercase text-[#F4F0E8]">
                OUR VISION
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#C2BEC1] leading-relaxed">
              To champion honest, multi-disciplinary software engineering where craftsmanship matters. Whether creating a corporate web presence, an enterprise portal, a bespoke workflow tool, or a spatial puzzle game, we aim for excellence in technical execution and enduring design.
            </p>
          </div>
        </div>
      </section>

      {/* What Karsh Tech Builds */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mb-20">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="text-[10px] font-mono-code uppercase text-[#FF5A36] tracking-wider font-semibold">
            COMPREHENSIVE CAPABILITIES
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#F4F0E8] mt-1">
            WHAT WE BUILD
          </h2>
          <p className="text-xs text-[#96929A] mt-1">
            Our multi-disciplinary team brings cohesive engineering across five digital domains.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-3">
            <div className="w-10 h-10 rounded bg-[#242329] text-[#FF5A36] flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold uppercase text-[#F4F0E8]">
              WEBSITES
            </h3>
            <p className="text-xs text-[#96929A] leading-relaxed">
              Responsive marketing sites, corporate web portals, and documentation hubs engineered for speed and search ranking.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-3">
            <div className="w-10 h-10 rounded bg-[#242329] text-[#FF5A36] flex items-center justify-center">
              <Layout className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold uppercase text-[#F4F0E8]">
              WEB APPS
            </h3>
            <p className="text-xs text-[#96929A] leading-relaxed">
              Full-stack platforms, client dashboards, content portals, and authenticated workflows with durable backends.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-3">
            <div className="w-10 h-10 rounded bg-[#242329] text-[#FF5A36] flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold uppercase text-[#F4F0E8]">
              MOBILE APPS
            </h3>
            <p className="text-xs text-[#96929A] leading-relaxed">
              Native Android applications built with Jetpack Compose, offering offline persistence and sub-16ms latency.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-3">
            <div className="w-10 h-10 rounded bg-[#242329] text-[#FF5A36] flex items-center justify-center">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold uppercase text-[#F4F0E8]">
              GAMES
            </h3>
            <p className="text-xs text-[#96929A] leading-relaxed">
              Distraction-free logic puzzle games (featuring Arrow Puzzle) with zero ads, verified solvability, and offline play.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-[#39363A] bg-[#1A191F] space-y-3">
            <div className="w-10 h-10 rounded bg-[#242329] text-[#FF5A36] flex items-center justify-center">
              <Code2 className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold uppercase text-[#F4F0E8]">
              CUSTOM SOFTWARE
            </h3>
            <p className="text-xs text-[#96929A] leading-relaxed">
              Internal tools, automated scripts, API integrations, and customized systems built around specific business logic.
            </p>
          </div>
        </div>
      </section>

      {/* Engineering Philosophy Pillars */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mb-20">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="text-[10px] font-mono-code uppercase text-[#FF5A36] tracking-wider font-semibold">
            HOW WE OPERATE
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#F4F0E8] mt-1">
            OUR PHILOSOPHY
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-8 hover:border-[#FF5A36]/60 transition-colors space-y-3">
            <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] block">
              // PILLAR 01
            </span>
            <h3 className="font-display text-2xl font-bold text-[#F4F0E8]">
              THOUGHTFUL CRAFT
            </h3>
            <p className="text-xs text-[#C2BEC1] leading-relaxed">
              We reject hasty, disposable development. Every data schema, UI component, and build artifact is shaped with care and verified for longevity.
            </p>
          </div>

          <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-8 hover:border-[#FF5A36]/60 transition-colors space-y-3">
            <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] block">
              // PILLAR 02
            </span>
            <h3 className="font-display text-2xl font-bold text-[#F4F0E8]">
              NATIVE PERFORMANCE
            </h3>
            <p className="text-xs text-[#C2BEC1] leading-relaxed">
              We prioritize native execution, lightweight page payloads, clean caching strategies, and low memory usage across web and mobile ecosystems.
            </p>
          </div>

          <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-8 hover:border-[#FF5A36]/60 transition-colors space-y-3">
            <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] block">
              // PILLAR 03
            </span>
            <h3 className="font-display text-2xl font-bold text-[#F4F0E8]">
              USER RESPECT &amp; PRIVACY
            </h3>
            <p className="text-xs text-[#C2BEC1] leading-relaxed">
              Zero surveillance telemetry, zero intrusive advertisement SDKs, and zero artificial dark patterns. We respect the player and user at all times.
            </p>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mb-20">
        <div className="text-center max-w-xl mx-auto mb-12">
          <div className="flex items-center justify-center space-x-2.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              THE BUILDERS
            </span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#F4F0E8]">
            CORE TEAM
          </h2>
          <p className="text-xs text-[#96929A] mt-1">
            The engineers and designers driving technical execution at Karsh Tech.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {teamMembers.map((member, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 flex flex-col items-center text-center space-y-3.5 hover:border-[#FF5A36]/60 transition-colors"
            >
              <div className="w-20 h-20 rounded-full overflow-hidden border border-[#39363A] bg-[#242329]">
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <h3 className="font-display text-2xl font-bold text-[#F4F0E8]">
                  {member.name}
                </h3>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#FF5A36] mt-0.5">
                  {member.role}
                </div>
              </div>

              <div className="px-2.5 py-1 rounded border border-[#39363A] bg-[#101014] text-[10px] font-mono-code text-[#C2BEC1]">
                {member.focus}
              </div>

              <p className="text-xs text-[#96929A] leading-relaxed">
                {member.bio}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Banner */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-8 sm:p-12 text-center space-y-5 shadow-xl">
          <div className="w-12 h-12 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center mx-auto">
            <Send className="w-6 h-6" />
          </div>

          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#F4F0E8]">
            COLLABORATE WITH KARSH TECH
          </h2>

          <p className="text-xs sm:text-sm text-[#C2BEC1] max-w-xl mx-auto leading-relaxed">
            Interested in partnering on a digital product, commissioning a website or application build, or discussing technology solutions? Reach out to our team.
          </p>

          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Contact Us</span>
            </Link>

            <a
              href="mailto:karshhtech@gmail.com"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded border border-[#39363A] bg-[#242329] hover:border-[#FF5A36] text-[#F4F0E8] text-xs font-bold uppercase tracking-wider transition-colors"
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

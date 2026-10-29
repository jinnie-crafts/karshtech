import React from 'react';
import { motion } from 'framer-motion';
import { Link } from '../context/RouterContext';
import { containerVariants, fadeUpVariants } from '../lib/motion';
import {
  Gamepad2,
  Code2,
  Layers,
  Heart,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';

export const StudioPage: React.FC = () => {
  const teamMembers = [
    {
      name: 'Harsh',
      role: 'Founder & Lead Systems Engineer',
      avatar: '/uploads/images/avatar_harsh.png',
      focus: 'Architecture, Android Jetpack Compose, Native Touch Performance',
      bio: 'Leading technical design and performance engineering behind Karsh Tech titles, ensuring sub-16ms touch response and robust game architecture.',
    },
    {
      name: 'Aditya',
      role: 'Game Mechanics & Level Designer',
      avatar: '/uploads/images/avatar_aditya.png',
      focus: 'Spatial Logic, Algorithmic Solvability, Level Progression',
      bio: 'Crafts the interlocking puzzle boards, solvability curves, and progressive difficulty tiers that make each level mentally engaging.',
    },
    {
      name: 'Komal',
      role: 'UI/UX & Visual Experience',
      avatar: '/uploads/images/avatar_komal.png',
      focus: 'Porcelain Aesthetics, Motion Design, Accessibility',
      bio: 'Shapes the calming visual identity, clean palette harmonies, and fluid micro-animations that define the Karsh Tech experience.',
    },
  ];

  return (
    <div className="min-h-screen pt-28 pb-24 text-[#C2BEC1] bg-[#101014] font-sans overflow-hidden">
      {/* Studio Header */}
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
              CRAFT &amp; IDENTITY // EST. 2026
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUpVariants}
            className="font-display text-5xl sm:text-6xl md:text-7xl font-bold uppercase tracking-tight text-[#F4F0E8] leading-tight"
          >
            ABOUT <span className="text-[#FF5A36]">KARSH TECH.</span>
          </motion.h1>

          <motion.p
            variants={fadeUpVariants}
            className="text-xs sm:text-sm text-[#C2BEC1] max-w-xl mx-auto leading-relaxed pt-1"
          >
            We are an independent studio dedicated to creating deliberate, tactile, and calming interactive experiences.
            We build games that treat your time, attention, and cognitive focus with respect.
          </motion.p>
        </motion.div>
      </section>

      {/* Core Philosophy Section */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 hover:border-[#FF5A36]/60 transition-colors">
            <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center mb-5">
              <Heart className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] block mb-1">
              // PILLAR 01
            </span>
            <h3 className="font-display text-2xl font-bold text-[#F4F0E8] mb-2">
              CALMING FOCUS
            </h3>
            <p className="text-xs text-[#C2BEC1] leading-relaxed">
              No artificial countdowns, flashing pop-up ads, or predatory monetization.
              We build serene environments where you can think clearly and unpack spatial challenges.
            </p>
          </div>

          <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 hover:border-[#FF5A36]/60 transition-colors">
            <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center mb-5">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] block mb-1">
              // PILLAR 02
            </span>
            <h3 className="font-display text-2xl font-bold text-[#F4F0E8] mb-2">
              RIGOROUS SPATIAL LOGIC
            </h3>
            <p className="text-xs text-[#C2BEC1] leading-relaxed">
              Our puzzle mechanics are built upon algorithmic solvability guarantees.
              Whether an arrow is turning a corner or navigating a dense corridor, each move requires genuine insight.
            </p>
          </div>

          <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 hover:border-[#FF5A36]/60 transition-colors">
            <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center mb-5">
              <Code2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-[#96929A] block mb-1">
              // PILLAR 03
            </span>
            <h3 className="font-display text-2xl font-bold text-[#F4F0E8] mb-2">
              NATIVE PERFORMANCE
            </h3>
            <p className="text-xs text-[#C2BEC1] leading-relaxed">
              Native Android execution in modern frameworks with 60+ FPS touch latency optimization.
              We prioritize memory efficiency, battery preservation, and complete offline reliability.
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
              THE ARCHITECTS
            </span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#F4F0E8]">
            STUDIO CORE TEAM
          </h2>
          <p className="text-xs text-[#96929A] mt-1">
            The engineers and designers building our interactive titles.
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

      {/* Direct Distribution Philosophy */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-8 sm:p-12 text-center space-y-5 shadow-xl">
          <div className="w-12 h-12 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#F4F0E8]">
            AUTONOMOUS STUDIO PUBLISHING
          </h2>

          <p className="text-xs sm:text-sm text-[#C2BEC1] max-w-xl mx-auto leading-relaxed">
            By publishing directly through Karsh Tech, we provide uncompressed, cryptographically verified APKs without third-party store delays or proprietary lock-ins. You receive updates immediately with complete offline privacy.
          </p>

          <div className="flex flex-wrap justify-center gap-5 text-xs font-mono-code text-[#96929A] pt-1">
            <span className="flex items-center space-x-1.5 text-[#F4F0E8]">
              <CheckCircle className="w-3.5 h-3.5 text-[#FF5A36]" />
              <span>Signed Release APKs</span>
            </span>
            <span className="flex items-center space-x-1.5 text-[#F4F0E8]">
              <CheckCircle className="w-3.5 h-3.5 text-[#FF5A36]" />
              <span>Zero Account Lock-in</span>
            </span>
            <span className="flex items-center space-x-1.5 text-[#F4F0E8]">
              <CheckCircle className="w-3.5 h-3.5 text-[#FF5A36]" />
              <span>Direct Developer Support</span>
            </span>
          </div>

          <div className="pt-3">
            <Link
              href="/games"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>EXPLORE STUDIO RELEASES</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

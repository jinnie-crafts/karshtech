import React from 'react';
import { ShieldAlert, FileText, Mail, Info } from 'lucide-react';
import { Link } from '../context/RouterContext';

export const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen pt-28 pb-24 text-[#C2BEC1] max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 bg-[#101014] font-sans">
      {/* Header */}
      <div className="mb-10 border-b border-[#39363A] pb-6">
        <div className="flex items-center space-x-2.5 mb-2">
          <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
          <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
            LEGAL TERMS &amp; CONDITIONS
          </span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-[#F4F0E8] font-bold uppercase tracking-tight">
          Terms of Service
        </h1>
        <p className="text-xs text-[#96929A] mt-1.5 font-mono-code">
          Last Updated: October 30, 2026 • Organization: Karsh Tech (https://tech.aadirishi.in)
        </p>
      </div>

      {/* Legal Advisory Notice */}
      <div className="mb-10 p-5 rounded-xl border border-[#39363A] bg-[#1A191F] text-xs text-[#C2BEC1] flex items-start space-x-3.5 shadow-lg">
        <FileText className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#FF5A36]" />
        <div className="space-y-1">
          <span className="font-bold text-[#F4F0E8] block text-sm">Review Draft Notice</span>
          <p className="leading-relaxed text-[#96929A]">
            These Terms of Service govern the use of the Karsh Tech corporate portal, digital development services, web applications, custom software, and standalone mobile games. This document represents an operating draft for stakeholder review prior to formal legal certification.
          </p>
        </div>
      </div>

      {/* 12 Comprehensive Sections */}
      <div className="space-y-8 text-xs text-[#C2BEC1] leading-relaxed">
        
        {/* 1. Acceptance of Terms */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using the website located at <Link href="/" className="text-[#FF5A36] underline">https://tech.aadirishi.in</Link>, by commissioning technical services, or by downloading, installing, or executing any digital software, applications, or games provided by <strong className="text-[#F4F0E8]">Karsh Tech</strong> ("we", "us", or "our"), you agree to be bound by these Terms of Service.
          </p>
          <p>
            If you do not agree to all provisions of these Terms, you must immediately cease accessing this website and refrain from using or installing our software.
          </p>
        </section>

        {/* 2. Website Usage */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            2. Website Usage
          </h2>
          <p>
            Karsh Tech grants you a limited, non-exclusive, revocable, and non-transferable license to access and use our website for personal, informational, commercial evaluation, and communication purposes, in compliance with these Terms.
          </p>
          <p>
            You agree not to use the website in any manner that impairs its availability, introduces malicious code, or disrupts server operations or other visitors' access.
          </p>
        </section>

        {/* 3. Products and Development Services */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            3. Products and Development Services
          </h2>
          <p>
            Karsh Tech provides multi-disciplinary digital engineering, including website development, web applications, mobile applications, interactive games, and custom software solutions.
          </p>
          <p>
            Bespoke engineering projects, commercial development contracts, and ongoing maintenance engagements are subject to separate formal Statements of Work (SOW) or written agreements that govern technical specifications, milestones, deliverables, and commercial arrangements.
          </p>
        </section>

        {/* 4. Intellectual Property Rights */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            4. Intellectual Property Rights
          </h2>
          <p>
            All website materials, visual designs, brand assets (including the Karsh Tech geometric K emblem and wordmarks), proprietary code, graphics, documentation, algorithms, and interactive mechanics published on this site are the exclusive intellectual property of Karsh Tech or its respective licensors.
          </p>
          <p>
            Nothing in these Terms grants you ownership of Karsh Tech intellectual property. We do not claim ownership of open-source third-party dependencies, which remain under their respective licenses.
          </p>
        </section>

        {/* 5. Software and Downloads */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            5. Software and Downloads
          </h2>
          <p>
            When downloading official software packages or standalone mobile games (such as Arrow Puzzle) directly from our platform:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-[#96929A] pl-2">
            <li>You are granted a limited, personal, revocable, non-exclusive license to execute the application on compatible hardware under your control.</li>
            <li>You may not modify, reverse-engineer, decompile, disassemble, or extract proprietary algorithms from compiled binaries, except to the extent permitted by mandatory statutory law.</li>
            <li>You may not re-host, redistribute, mirror, or bundle our binaries into third-party app stores or commercial distribution channels without our prior written consent.</li>
          </ul>
        </section>

        {/* 6. User Conduct and Security */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            6. User Conduct and Security
          </h2>
          <p>
            When utilizing our website, forms, or applications, you explicitly agree not to:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-[#96929A] pl-2">
            <li>Attempt to probe, scan, or compromise our administrative console (`/admin`), authentication middleware, or backend APIs.</li>
            <li>Conduct brute-force credential stuffing, automated scraping, or denial-of-service attacks against our infrastructure.</li>
            <li>Submit fraudulent, abusive, defamatory, or unlawful transmissions through our Contact or Support forms.</li>
            <li>Impersonate any person, entity, or representative of Karsh Tech.</li>
          </ul>
        </section>

        {/* 7. External Links and Third-Party Services */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            7. External Links and Third-Party Services
          </h2>
          <p>
            Our website and documentation may provide links to external websites, developer resources, or open-source repositories. Karsh Tech does not operate, control, or endorse third-party content and assumes no responsibility for external terms, privacy practices, or availability.
          </p>
        </section>

        {/* 8. Availability and Updates */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            8. Availability and Updates
          </h2>
          <p>
            We strive to maintain continuous availability of our platform. However, Karsh Tech reserves the right to modify, update, suspend, or discontinue any feature, download link, or service at any time without prior notice, for maintenance, security hardening, or product deprecation.
          </p>
        </section>

        {/* 9. Disclaimers */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            9. Disclaimers
          </h2>
          <p>
            To the maximum extent permitted by applicable law, the Karsh Tech website, content, and downloadable software packages are provided on an <strong className="text-[#F4F0E8]">"as-is"</strong> and <strong className="text-[#F4F0E8]">"as-available"</strong> basis, without express or implied warranties of any kind, including merchantability, fitness for a particular purpose, or non-infringement.
          </p>
          <p>
            We do not warrant that our digital services will operate completely uninterrupted, bug-free, or compatible with all legacy operating system variations.
          </p>
        </section>

        {/* 10. Limitation of Liability */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            10. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by applicable law, in no event shall Karsh Tech, its founders, or contributors be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data corruption, or business interruption, arising out of or related to your use of our website or software.
          </p>
        </section>

        {/* 11. Governing Law & Jurisdiction */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            11. Governing Law &amp; Jurisdiction
          </h2>
          <p>
            These Terms shall be interpreted and governed in accordance with the substantive laws applicable to our organizational operations.
          </p>
          <div className="p-4 rounded-lg border border-[#39363A] bg-[#101014] text-[#96929A] space-y-1">
            <span className="text-[#FF5A36] font-mono-code font-semibold block text-[11px]">
              [LEGAL JURISDICTION PLACEHOLDER — SUBJECT TO FORMAL REVIEW]
            </span>
            <p>
              Governing Jurisdiction: Applicable Law of India / Local Jurisdiction under which Karsh Tech business operations are established. Any disputes arising hereunder shall be subject to the competent courts of the applicable operational jurisdiction.
            </p>
          </div>
        </section>

        {/* 12. Contact Information */}
        <section className="space-y-2.5 pt-4 border-t border-[#39363A]">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            12. Contact Information
          </h2>
          <p>
            For questions, legal notices, or licensing inquiries concerning these Terms of Service, contact Karsh Tech:
          </p>
          <div className="p-5 rounded-lg border border-[#39363A] bg-[#1A191F] font-mono-code text-xs text-[#96929A] space-y-1.5">
            <div className="text-[#F4F0E8] font-bold text-sm">Karsh Tech Legal Operations</div>
            <div>Official Email: <a href="mailto:karshhtech@gmail.com" className="text-[#FF5A36] hover:underline">karshhtech@gmail.com</a></div>
            <div>Production Domain: <a href="https://tech.aadirishi.in" className="text-[#C2BEC1] hover:underline">https://tech.aadirishi.in</a></div>
          </div>
        </section>

      </div>
    </div>
  );
};

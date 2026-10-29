import React from 'react';

export const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen pt-28 pb-24 text-[#C2BEC1] max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 bg-[#101014] font-sans">
      {/* Header */}
      <div className="mb-10 border-b border-[#39363A] pb-6">
        <div className="flex items-center space-x-2.5 mb-2">
          <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
          <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
            DISTRIBUTION &amp; LICENSING
          </span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-[#F4F0E8] font-bold uppercase tracking-tight">
          Terms of Service &amp; Software License
        </h1>
        <p className="text-xs text-[#96929A] mt-1.5 font-mono-code">
          Last Updated: October 2026 • Karsh Tech
        </p>
      </div>

      <div className="space-y-7 text-xs text-[#C2BEC1] leading-relaxed">
        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing the Karsh Tech portal or downloading and installing our game binaries (such as Arrow Puzzle), you agree to these Terms of Service. If you do not accept these terms, do not download or install our software.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            2. Personal Entertainment License
          </h2>
          <p>
            Karsh Tech grants you a non-exclusive, non-transferable, revocable license to install and play our published games for personal entertainment on compatible Android hardware under your control.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            3. Intellectual Property Rights
          </h2>
          <p>
            All game titles, code, level designs, puzzle algorithms, graphics, and trademarks are the proprietary intellectual property of Karsh Tech. You may not reverse-engineer, redistribute, or repackage our binaries without explicit written consent.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            4. Verified APK Sideloading
          </h2>
          <p>
            When downloading APK packages directly from this portal, you confirm that your Android device permits installation from browser downloads. We guarantee that all official release binaries hosted here are signed by our studio release keystore and uncompromised.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            5. Studio Contact Details
          </h2>
          <p>
            For inquiries regarding commercial licensing or distribution terms:
          </p>
          <div className="p-4 rounded-lg border border-[#39363A] bg-[#1A191F] font-mono-code text-xs text-[#96929A] space-y-1">
            <div className="text-[#F4F0E8] font-bold">Karsh Tech Legal Operations</div>
            <div>Email: contact@karshtech.com</div>
          </div>
        </section>
      </div>
    </div>
  );
};

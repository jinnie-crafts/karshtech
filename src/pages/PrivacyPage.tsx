import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen pt-28 pb-24 text-[#C2BEC1] max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 bg-[#101014] font-sans">
      {/* Header */}
      <div className="mb-10 border-b border-[#39363A] pb-6">
        <div className="flex items-center space-x-2.5 mb-2">
          <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
          <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
            LEGAL &amp; COMPLIANCE
          </span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-[#F4F0E8] font-bold uppercase tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-xs text-[#96929A] mt-1.5 font-mono-code">
          Effective Date: October 2026 • Studio: Karsh Tech
        </p>
      </div>

      <div className="mb-8 p-4 rounded-lg border border-[#39363A] bg-[#1A191F] text-xs text-[#C2BEC1] flex items-start space-x-3">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#FF5A36]" />
        <div>
          <span className="font-bold text-[#F4F0E8]">Studio Privacy Stance:</span> Karsh Tech operates with an offline-first architecture.
          Our games, including Arrow Puzzle, do not harvest, track, or sell personal identity data to external advertising networks.
        </div>
      </div>

      <div className="space-y-7 text-xs text-[#C2BEC1] leading-relaxed">
        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            1. Information Collection &amp; Scope
          </h2>
          <p>
            When downloading or playing games published by Karsh Tech (such as Arrow Puzzle), data handling remains strictly local:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-[#96929A] pl-2">
            <li><strong className="text-[#F4F0E8]">Local Gameplay Progress:</strong> Level clearance, puzzle states, and settings reside on your device via Android local storage and Preferences DataStore.</li>
            <li><strong className="text-[#F4F0E8]">Direct Website Downloads:</strong> When you download an APK from our publishing portal, standard HTTP connection logs (IP, timestamp) are temporarily recorded solely for transfer metrics and security rate-limiting.</li>
            <li><strong className="text-[#F4F0E8]">Support Transmissions:</strong> If you submit an inquiry via our Support page, your name, email, and issue details are retained exclusively to resolve your communication.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            2. Minimal Device Permissions
          </h2>
          <p>
            Arrow Puzzle is engineered with zero intrusive permission requests. It requires NO access to contacts, camera, microphone, device location, or sensitive media files.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            3. Third-Party Analytics &amp; Advertising
          </h2>
          <p>
            We do not embed third-party surveillance advertising libraries into our production APKs. Gameplay is clean and distraction-free.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            4. GDPR &amp; CCPA User Rights
          </h2>
          <p>
            Under European GDPR and California CCPA regulations, you have full rights to request deletion of any support communications sent to us. Uninstalling the game app completely purges all local gameplay data from your device.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            5. Studio Contact Details
          </h2>
          <p>
            For privacy inquiries, contact our studio operations desk:
          </p>
          <div className="p-4 rounded-lg border border-[#39363A] bg-[#1A191F] font-mono-code text-xs text-[#96929A] space-y-1">
            <div className="text-[#F4F0E8] font-bold">Karsh Tech Studio Operations</div>
            <div>Email: contact@karshtech.com</div>
            <div>Direct Platform: https://karshtech.com</div>
          </div>
        </section>
      </div>
    </div>
  );
};

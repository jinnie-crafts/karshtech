import React from 'react';
import { Shield, Info, Mail, Lock } from 'lucide-react';
import { Link } from '../context/RouterContext';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen pt-28 pb-24 text-[#C2BEC1] max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 bg-[#101014] font-sans">
      {/* Header */}
      <div className="mb-10 border-b border-[#39363A] pb-6">
        <div className="flex items-center space-x-2.5 mb-2">
          <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
          <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
            LEGAL COMPLIANCE &amp; GOVERNANCE
          </span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-[#F4F0E8] font-bold uppercase tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-xs text-[#96929A] mt-1.5 font-mono-code">
          Effective Date: October 30, 2026 • Organization: Karsh Tech (https://tech.aadirishi.in)
        </p>
      </div>

      {/* Organization Privacy Notice */}
      <div className="mb-10 p-5 rounded-xl border border-[#39363A] bg-[#1A191F] text-xs text-[#C2BEC1] flex items-start space-x-3.5 shadow-lg">
        <Shield className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#FF5A36]" />
        <div className="space-y-1">
          <span className="font-bold text-[#F4F0E8] block text-sm">Karsh Tech Privacy Architecture</span>
          <p className="leading-relaxed text-[#96929A]">
            Karsh Tech operates with a privacy-first, minimal-data-footprint philosophy across our websites, web applications, mobile applications, games, and custom software. We do not engage in surveillance capitalism, behavioral ad targeting, or unauthorized personal data harvesting.
          </p>
        </div>
      </div>

      {/* 12 Comprehensive Sections */}
      <div className="space-y-8 text-xs text-[#C2BEC1] leading-relaxed">
        
        {/* 1. Introduction */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            1. Introduction
          </h2>
          <p>
            This Privacy Policy governs the processing of information collected by <strong className="text-[#F4F0E8]">Karsh Tech</strong> ("we", "us", or "our") through our official website (<Link href="/" className="text-[#FF5A36] underline">https://tech.aadirishi.in</Link>), our hosted web applications, our custom software solutions, and standalone mobile applications and games distributed through our platform.
          </p>
          <p>
            By accessing our website or utilizing our products, you acknowledge the data handling practices described herein. If you have any questions, our primary contact is <a href="mailto:karshhtech@gmail.com" className="text-[#FF5A36] underline font-mono-code">karshhtech@gmail.com</a>.
          </p>
        </section>

        {/* 2. Information We Collect */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            2. Information We Collect
          </h2>
          <p>
            We collect only the information strictly necessary to fulfill technical, communication, and security functions:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[#96929A] pl-2">
            <li>
              <strong className="text-[#F4F0E8]">Contact and Project Inquiries:</strong> When you voluntarily submit a message via our Contact or Support forms, we collect your name, email address, optional topic/category, subject, and the message content you provide.
            </li>
            <li>
              <strong className="text-[#F4F0E8]">Administrative Credentials:</strong> For authorized Karsh Tech team members accessing the private management console (`/admin`), internal account usernames, cryptographic password hashes, and authentication tokens are processed.
            </li>
            <li>
              <strong className="text-[#F4F0E8]">Server Technical Logs:</strong> Standard HTTP server requests process ephemeral technical headers (including IP address, requested URL, user agent, and timestamp) in server memory solely for brute-force rate-limiting, denial-of-service defense, and network error diagnosis.
            </li>
            <li>
              <strong className="text-[#F4F0E8]">Offline Mobile Applications &amp; Games:</strong> Standalone applications (such as our logic game, Arrow Puzzle) operate offline-first. Game progress, level clearance, sound toggles, and high scores reside strictly within local device storage (Android Preferences DataStore) and are never transmitted to our servers.
            </li>
          </ul>
        </section>

        {/* 3. How We Use Information */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            3. How We Use Information
          </h2>
          <p>
            Information collected is utilized exclusively for legitimate technical and organizational purposes:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-[#96929A] pl-2">
            <li>To review, respond to, and fulfill service consultations, inquiries, and technical support requests.</li>
            <li>To maintain network integrity, prevent automated brute-force attacks against administrative portals, and ensure server stability.</li>
            <li>To compile and distribute authorized production binaries and software packages.</li>
            <li>To ensure compliance with applicable legal and technical obligations.</li>
          </ul>
          <p>
            We never sell, rent, monetize, or broker your personal information to third-party marketing networks or data brokers.
          </p>
        </section>

        {/* 4. Cookies and Authentication */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            4. Cookies and Authentication
          </h2>
          <p>
            Our public website does <strong className="text-[#F4F0E8]">not</strong> use tracking cookies, marketing cookies, or persistent visitor identification beacons.
          </p>
          <p>
            When an authorized administrator logs into the private console (`/admin`), our system issues an HTTP-only session cookie named <code className="text-[#FF5A36] bg-[#1A191F] px-1.5 py-0.5 rounded font-mono-code">karsh_session</code>. This cookie is protected with <code className="text-[#C2BEC1] font-mono-code">SameSite=Lax</code> and <code className="text-[#C2BEC1] font-mono-code">Secure</code> attributes over HTTPS and is used solely to authenticate administrative dashboard sessions. Logging out immediately clears this cookie.
          </p>
        </section>

        {/* 5. Downloads and Usage Information */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            5. Downloads and Usage Information
          </h2>
          <p>
            When you download official APKs or software packages from <code className="text-[#FF5A36] font-mono-code">https://tech.aadirishi.in</code>, our server increments an anonymous aggregate download counter associated with the release version.
          </p>
          <p>
            This counter records only a cumulative integer number. It is not connected to user accounts, device hardware identifiers (IMEI, MAC address), or geographic user tracking.
          </p>
        </section>

        {/* 6. Third-Party Services */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            6. Third-Party Services
          </h2>
          <p>
            Our platform minimizes reliance on third-party dependencies:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-[#96929A] pl-2">
            <li>
              <strong className="text-[#F4F0E8]">Typography Services:</strong> We link Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) to render editorial typography. Google’s processing of font requests is governed by the Google Privacy Policy.
            </li>
            <li>
              <strong className="text-[#F4F0E8]">External Links:</strong> Our website may contain links to external web resources (such as GitHub or documentation). Karsh Tech is not responsible for the privacy practices of external sites.
            </li>
          </ul>
        </section>

        {/* 7. Data Storage and Security */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            7. Data Storage and Security
          </h2>
          <p>
            Karsh Tech employs industry-standard organizational and technical safeguards:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-[#96929A] pl-2">
            <li>All administrative communications and data transfers are encrypted in transit over Transport Layer Security (TLS/HTTPS).</li>
            <li>Administrative passwords are encrypted using salted Bcrypt algorithms.</li>
            <li>Administrative authentication tokens utilize cryptographic HS256 JWT signing verified against persistent storage.</li>
            <li>Database transactions utilize atomic file-write-and-rename durability mechanisms.</li>
          </ul>
          <p className="text-[#96929A] italic">
            While we implement rigorous engineering safeguards, no electronic transmission or server storage method is guaranteed to be 100% immune from security vulnerabilities. We advise against sending sensitive passwords or financial credentials through general contact forms.
          </p>
        </section>

        {/* 8. Data Retention */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            8. Data Retention
          </h2>
          <p>
            Inquiries and communications received via our contact forms are retained in server administrative records for the duration necessary to resolve the inquiry, manage project relationships, and comply with technical recordkeeping obligations.
          </p>
          <p className="text-[#96929A]">
            <em className="text-[#F4F0E8]">Policy Note for Organizational Review:</em> Specific data retention intervals (e.g., automated purge after 12 or 24 months) are subject to ongoing administrative refinement and may be formalized in future policy revisions.
          </p>
        </section>

        {/* 9. User Rights and Privacy Requests */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            9. User Rights and Privacy Requests
          </h2>
          <p>
            Depending on your jurisdiction (such as under GDPR, CCPA/CPRA, or applicable data protection laws), you may have the right to:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-[#96929A] pl-2">
            <li>Request confirmation of whether we hold personal communications submitted by you.</li>
            <li>Request access to or correction of inaccurate information.</li>
            <li>Request the deletion of your submitted contact messages from our records.</li>
          </ul>
          <p>
            To exercise these rights, submit a written request to <a href="mailto:karshhtech@gmail.com" className="text-[#FF5A36] underline font-mono-code">karshhtech@gmail.com</a>. We respond to all verified inquiries promptly.
          </p>
        </section>

        {/* 10. Children's Privacy */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            10. Children's Privacy
          </h2>
          <p>
            Karsh Tech software applications, including games such as Arrow Puzzle, are family-friendly and operate 100% offline without collecting personal data from players of any age.
          </p>
          <p>
            Our general website and commercial services are intended for founders, businesses, and general audiences. We do not knowingly collect personal identity information from children under 13 years of age. If you believe a child has provided contact information via our forms, contact us to initiate immediate deletion.
          </p>
        </section>

        {/* 11. Policy Updates */}
        <section className="space-y-2.5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            11. Policy Updates
          </h2>
          <p>
            We may update this Privacy Policy from time to time to reflect modifications in our software offerings, infrastructure, or applicable legal standards. Any revisions will be published at <code className="text-[#FF5A36] font-mono-code">https://tech.aadirishi.in/privacy</code> with an updated Effective Date. Continued use of our portal following updates constitutes acknowledgment of the revised policy.
          </p>
        </section>

        {/* 12. Contact Information */}
        <section className="space-y-2.5 pt-4 border-t border-[#39363A]">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#F4F0E8]">
            12. Contact Information
          </h2>
          <p>
            For privacy questions, data requests, or compliance inquiries regarding Karsh Tech, contact our administrative desk:
          </p>
          <div className="p-5 rounded-lg border border-[#39363A] bg-[#1A191F] font-mono-code text-xs text-[#96929A] space-y-1.5">
            <div className="text-[#F4F0E8] font-bold text-sm">Karsh Tech Legal &amp; Governance</div>
            <div>Email: <a href="mailto:karshhtech@gmail.com" className="text-[#FF5A36] hover:underline">karshhtech@gmail.com</a></div>
            <div>Official Website: <a href="https://tech.aadirishi.in" className="text-[#C2BEC1] hover:underline">https://tech.aadirishi.in</a></div>
            <div>Distribution Platform: Digital-First Engineering Organization</div>
          </div>
        </section>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { api } from '../lib/api';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';

export const SupportPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    game: 'Arrow Puzzle',
    subject: '',
    message: '',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How do I install the Arrow Puzzle APK on my Android device?',
      a: '1. Click the "DOWNLOAD OFFICIAL RELEASE APK" button on the Arrow Puzzle page.\n2. Once downloaded, open your notifications or navigate to your device\'s "Downloads" folder.\n3. If prompted by Android security, toggle "Allow installation from this source" in system settings.\n4. Tap "Install". The application is cryptographically signed and ready to launch offline.',
    },
    {
      q: 'Is downloading the APK directly from Karsh Tech safe?',
      a: 'Yes, 100%. All APKs distributed on this website are production builds compiled with ProGuard and signed with our official studio release keystore. They are scanned by Google Play Protect upon installation.',
    },
    {
      q: 'What Android devices and OS versions are supported?',
      a: 'Arrow Puzzle supports Android 8.0 (Oreo, API level 26) through Android 15. The package contains optimized 64-bit and 32-bit ARM binaries (ARM64-v8a / armeabi-v7a).',
    },
    {
      q: 'Can I play Arrow Puzzle completely offline?',
      a: 'Yes. Arrow Puzzle is built offline-first. All levels, game logic, touch controls, and audio run locally on your phone without requiring Wi-Fi or mobile data.',
    },
    {
      q: 'How do I report bugs or submit feature suggestions?',
      a: 'Use the contact form on this page or email us directly at contact@karshtech.com. We read and respond to all feedback from our community.',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await api.submitSupport(formData);
      setSuccess(true);
      setFormData({
        name: '',
        email: '',
        game: 'Arrow Puzzle',
        subject: '',
        message: '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch transmission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-24 text-[#C2BEC1] max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 bg-[#101014] font-sans">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center space-x-2.5 mb-2.5">
          <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
          <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
            TRANSMISSION &amp; ASSISTANCE
          </span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight uppercase text-[#F4F0E8] leading-tight">
          STUDIO SUPPORT &amp; <span className="text-[#FF5A36]">INQUIRIES</span>
        </h1>

        <p className="text-xs sm:text-sm text-[#C2BEC1] mt-2 max-w-xl leading-relaxed">
          Need assistance with APK sideloading, encountered a puzzle anomaly, or have ideas for future releases?
          Connect directly with our development team.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Contact Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 sm:p-8 rounded-xl bg-[#1A191F] border border-[#39363A] shadow-xl">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8] mb-1">
              DISPATCH TRANSMISSION
            </h2>
            <p className="text-xs text-[#96929A] mb-6">
              Fill out the parameters below to reach our studio engineering team.
            </p>

            {success && (
              <div className="mb-6 p-4 rounded bg-[#101014] border border-[#FF5A36]/50 flex items-start space-x-3 text-xs text-[#F4F0E8]">
                <CheckCircle2 className="w-5 h-5 text-[#FF5A36] flex-shrink-0" />
                <div>
                  <div className="font-bold">Transmission Dispatched</div>
                  <div className="text-[#C2BEC1] mt-0.5">
                    Thank you. Your message has been received by the Karsh Tech team and will be reviewed shortly.
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 rounded bg-red-950/30 border border-red-500/40 flex items-start space-x-3 text-xs text-red-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
                <div>{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono-code text-[#96929A] uppercase mb-1.5 font-semibold">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Alex Hunter"
                    className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A] focus:outline-none focus:border-[#FF5A36] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono-code text-[#96929A] uppercase mb-1.5 font-semibold">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="alex@example.com"
                    className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A] focus:outline-none focus:border-[#FF5A36] transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono-code text-[#96929A] uppercase mb-1.5 font-semibold">
                    Game / Topic
                  </label>
                  <select
                    value={formData.game}
                    onChange={(e) => setFormData({ ...formData, game: e.target.value })}
                    className="w-full px-3 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36]"
                  >
                    <option value="Arrow Puzzle">Arrow Puzzle</option>
                    <option value="General Studio Question">General Studio Question</option>
                    <option value="Website & Distribution">Website &amp; Distribution</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono-code text-[#96929A] uppercase mb-1.5 font-semibold">
                    Subject *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g. Feedback on Level 42"
                    className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A] focus:outline-none focus:border-[#FF5A36] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-code text-[#96929A] uppercase mb-1.5 font-semibold">
                  Message Details *
                </label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Detail your question, feedback, or device environment..."
                  className="w-full px-3.5 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A] focus:outline-none focus:border-[#FF5A36] transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 shadow-md shadow-[#FF5A36]/20 disabled:opacity-50"
              >
                {loading ? (
                  <span>DISPATCHING...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>SEND TRANSMISSION TO STUDIO</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* FAQ Accordion (5 cols) */}
        <div className="lg:col-span-5 space-y-5" id="faq">
          <div>
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              FREQUENTLY RESOLVED
            </span>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8] mt-1">
              SIDELOADING &amp; APK FAQ
            </h2>
          </div>

          <div className="space-y-2.5">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-lg border border-[#39363A] bg-[#1A191F] overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold text-[#F4F0E8] hover:text-[#FF5A36] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#96929A] flex-shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#FF5A36]' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs text-[#C2BEC1] leading-relaxed border-t border-[#39363A]/60 whitespace-pre-line">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Direct Developer Email Card */}
          <div className="p-5 rounded-lg border border-[#39363A] bg-[#1A191F] flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded bg-[#242329] border border-[#39363A] text-[#FF5A36] flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono-code uppercase tracking-wider text-[#96929A]">Direct Studio Contact</div>
              <a
                href="mailto:contact@karshtech.com"
                className="text-xs text-[#F4F0E8] hover:text-[#FF5A36] transition-colors font-mono-code font-bold"
              >
                contact@karshtech.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

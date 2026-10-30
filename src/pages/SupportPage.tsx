import React, { useState } from 'react';
import { api } from '../lib/api';
import { Link } from '../context/RouterContext';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  HelpCircle,
  Smartphone,
  Layout,
  Globe,
  Code2,
  Shield,
} from 'lucide-react';

export const SupportPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    game: 'General Technical Support',
    subject: '',
    message: '',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const supportTopics = [
    'General Technical Support',
    'Website & Platform Assistance',
    'Game Support (Arrow Puzzle / APK)',
    'Custom Software Issue',
    'Account & Console Access',
    'Project & Service Inquiry',
  ];

  const faqs = [
    {
      q: 'How do I request support for a Karsh Tech product or service?',
      a: 'You can submit a ticket using the transmission form on this page or email our engineering desk directly at karshhtech@gmail.com. Inquiries are reviewed directly by our technical team.',
    },
    {
      q: 'How do I install an Android APK (such as Arrow Puzzle) directly from Karsh Tech?',
      a: '1. Click the "Download Official APK" link on the game page.\n2. When downloaded, open your notification shade or Files/Downloads directory.\n3. If prompted by Android security, select "Settings" and toggle "Allow from this source".\n4. Tap "Install". All Karsh Tech APKs are production-keystore signed and scanned by Google Play Protect upon installation.',
    },
    {
      q: 'Is downloading software and APKs directly from Karsh Tech secure?',
      a: 'Yes. Every release distributed on https://tech.aadirishi.in is built from verified source code, compiled with ProGuard/R8 optimizations, signed with our official cryptographic release keystore, and accompanied by verifiable SHA-256 checksums.',
    },
    {
      q: 'What should I do if a web application or portal is not loading correctly?',
      a: 'Ensure you are using a modern Evergreen browser (Chrome, Edge, Firefox, Safari) with JavaScript enabled. Clear browser cache or hard reload (Ctrl+F5 / Cmd+Shift+R). If the anomaly persists, submit a report via this form detailing your browser and operating system.',
    },
    {
      q: 'Does Karsh Tech provide ongoing maintenance for client projects?',
      a: 'Yes. When developing websites, web applications, or custom software for clients, we offer structured maintenance, security patch updates, and infrastructure monitoring tailored to project specifications.',
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
        game: 'General Technical Support',
        subject: '',
        message: '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch transmission. Please try again or email us directly.');
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
            KARSH TECH // TECHNICAL ASSISTANCE
          </span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight uppercase text-[#F4F0E8] leading-tight">
          SUPPORT &amp; <span className="text-[#FF5A36]">ASSISTANCE</span>
        </h1>

        <p className="text-xs sm:text-sm text-[#C2BEC1] mt-2 max-w-2xl leading-relaxed">
          Need technical guidance with an APK installation, have questions about a web application build, or need support for a Karsh Tech product? Connect directly with our engineering team.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Support Ticket Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 sm:p-8 rounded-xl bg-[#1A191F] border border-[#39363A] shadow-xl">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#F4F0E8] mb-1">
              DISPATCH SUPPORT TICKET
            </h2>
            <p className="text-xs text-[#96929A] mb-6">
              Complete the fields below to open a direct inquiry with the Karsh Tech technical team.
            </p>

            {success && (
              <div className="mb-6 p-4 rounded bg-[#101014] border border-[#FF5A36]/50 flex items-start space-x-3 text-xs text-[#F4F0E8]">
                <CheckCircle2 className="w-5 h-5 text-[#FF5A36] flex-shrink-0" />
                <div>
                  <div className="font-bold text-sm">Ticket Received</div>
                  <div className="text-[#C2BEC1] mt-0.5">
                    Thank you. Your message has been received by the Karsh Tech team. We will review your issue and reply via email.
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 rounded bg-red-950/30 border border-red-500/40 flex items-start space-x-3 text-xs text-red-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
                <div>
                  <div className="font-bold text-sm">Transmission Error</div>
                  <div className="mt-0.5">{error}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono-code text-[#96929A] uppercase mb-1.5 font-semibold">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jane Doe"
                    className="w-full px-4 py-2.5 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors"
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
                    placeholder="jane@example.com"
                    className="w-full px-4 py-2.5 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors font-mono-code"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono-code text-[#96929A] uppercase mb-1.5 font-semibold">
                    Topic / Category
                  </label>
                  <select
                    value={formData.game}
                    onChange={(e) => setFormData({ ...formData, game: e.target.value })}
                    className="w-full px-4 py-2.5 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] transition-colors cursor-pointer"
                  >
                    {supportTopics.map((t) => (
                      <option key={t} value={t} className="bg-[#1A191F] text-[#F4F0E8]">
                        {t}
                      </option>
                    ))}
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
                    placeholder="e.g. Sideloading Query / Bug Report"
                    className="w-full px-4 py-2.5 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-code text-[#96929A] uppercase mb-1.5 font-semibold">
                  Detailed Transmission *
                </label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Describe your question, device specifications, or technical details..."
                  className="w-full px-4 py-2.5 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-wider transition-colors shadow-md shadow-[#FF5A36]/20 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span>DISPATCHING...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>DISPATCH TICKET</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Support Knowledge Base & Contact Coordinates (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Direct Email Card */}
          <div className="p-6 rounded-xl bg-[#1A191F] border border-[#39363A] shadow-xl space-y-3">
            <span className="text-[10px] font-mono-code uppercase text-[#FF5A36] tracking-wider font-semibold">
              DIRECT DESK
            </span>
            <h3 className="font-display text-xl font-bold uppercase text-[#F4F0E8]">
              EMAIL SUPPORT
            </h3>
            <p className="text-xs text-[#96929A] leading-relaxed">
              Prefer direct email? Send your technical questions, bug logs, or inquiries to our primary address:
            </p>
            <div className="p-3 rounded bg-[#101014] border border-[#39363A]">
              <a
                href="mailto:karshhtech@gmail.com"
                className="font-mono-code text-xs font-bold text-[#F4F0E8] hover:text-[#FF5A36] transition-colors flex items-center space-x-2 break-all"
              >
                <Mail className="w-4 h-4 text-[#FF5A36] flex-shrink-0" />
                <span>karshhtech@gmail.com</span>
              </a>
            </div>
          </div>

          {/* FAQ Accordion */}
          <div className="p-6 rounded-xl bg-[#1A191F] border border-[#39363A] shadow-xl space-y-4">
            <h3 className="font-display text-xl font-bold uppercase text-[#F4F0E8]">
              FREQUENTLY ASKED
            </h3>

            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="border border-[#39363A] bg-[#101014] rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full p-3.5 text-left flex items-center justify-between text-xs font-bold text-[#F4F0E8] hover:text-[#FF5A36] transition-colors"
                    >
                      <span className="pr-2">{faq.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#FF5A36] transition-transform duration-200 flex-shrink-0 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-3.5 pb-3.5 pt-1 text-xs text-[#C2BEC1] leading-relaxed border-t border-[#39363A]/40 whitespace-pre-line">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

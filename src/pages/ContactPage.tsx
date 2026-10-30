import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { containerVariants, fadeUpVariants } from '../lib/motion';
import {
  Mail,
  Send,
  Check,
  AlertCircle,
  Clock,
  Shield,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'Website Development',
    subject: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const categories = [
    'Website Development',
    'Web Application Development',
    'Mobile Application Development',
    'Game Development',
    'Custom Software Development',
    'General Technical Inquiry',
  ];

  // Automatic form reset after 5 seconds of confirmed success
  useEffect(() => {
    if (!sent) return;

    const timer = setTimeout(() => {
      setSent(false);
      setFormData({
        name: '',
        email: '',
        category: 'Website Development',
        subject: '',
        message: '',
      });
      setErrorMessage(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [sent]);

  const handleManualReset = () => {
    setSent(false);
    setFormData({
      name: '',
      email: '',
      category: 'Website Development',
      subject: '',
      message: '',
    });
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedSubject = formData.subject.trim();
    const trimmedMessage = formData.message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setErrorMessage('All transmission channels (Name, Email, Message) are required. Please complete all fields.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || '';

      const payload = new FormData();
      payload.append('access_key', accessKey);
      payload.append('name', trimmedName);
      payload.append('email', trimmedEmail);
      payload.append(
        'subject',
        `[Karsh Tech - ${formData.category}] ${trimmedSubject || `Inquiry from ${trimmedName}`}`
      );
      payload.append('category', formData.category);
      payload.append('message', trimmedMessage);
      payload.append('to_email', 'karshhtech@gmail.com');
      payload.append('from_name', `${trimmedName} (via Karsh Tech Portal)`);

      let isSuccess = false;
      let failureReason = '';

      // Direct Web3Forms submission
      if (accessKey) {
        try {
          const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
            },
            body: payload,
          });

          let data: { success?: boolean; message?: string } | null = null;
          try {
            data = await response.json();
          } catch {
            // non-json response
          }

          if (response.ok && data?.success) {
            isSuccess = true;
          } else {
            failureReason = data?.message || 'Web3Forms service reported an issue with the dispatch.';
          }
        } catch (fetchErr: any) {
          // If browser is offline or CORS issue
          failureReason = fetchErr?.message || 'Network dispatch interrupted.';
        }
      }

      // Concurrently log transmission to backend for audit trail & resiliency
      try {
        await api.submitContact({
          name: trimmedName,
          email: trimmedEmail,
          category: formData.category,
          subject: trimmedSubject,
          message: trimmedMessage,
        });
        // If client-side Web3Forms key was absent, backend acknowledgement suffices
        if (!accessKey) {
          isSuccess = true;
        }
      } catch {
        // Backend logging error is non-fatal if Web3Forms succeeded
      }

      if (isSuccess) {
        setSent(true);
        setErrorMessage(null);
      } else {
        setErrorMessage(
          failureReason || 'Transmission failed to dispatch. Please verify your details and retry, or email karshhtech@gmail.com directly.'
        );
      }
    } catch {
      setErrorMessage('Network connection lost. Please verify your internet connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <span className="w-2 h-2 rounded-full bg-[#FF5A36] animate-pulse" />
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#F4F0E8] font-display">
              COMMUNICATION CHANNEL // DIRECT TRANSMISSION
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUpVariants}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-tight text-[#F4F0E8] leading-tight"
          >
            DISCUSS A <span className="text-[#FF5A36]">PROJECT.</span>
          </motion.h1>

          <motion.p
            variants={fadeUpVariants}
            className="text-xs sm:text-sm text-[#C2BEC1] max-w-xl mx-auto leading-relaxed pt-1"
          >
            Have a website, web platform, mobile app, game idea, or custom software requirement?
            Reach out directly to begin a technical consultation with the Karsh Tech team.
          </motion.p>
        </motion.div>
      </section>

      {/* Main Content: Info Cards & Monolith Terminal Form */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Column (5 cols): Official Coordinates & Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-[#39363A] bg-[#1A191F] p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <span className="text-[10px] font-mono-code uppercase text-[#FF5A36] tracking-wider font-semibold">
                  OFFICIAL COORDINATES
                </span>
                <h2 className="font-display text-2xl font-bold uppercase text-[#F4F0E8] mt-1">
                  DIRECT CONTACT
                </h2>
              </div>

              {/* Email Block */}
              <div className="p-4 rounded-lg bg-[#101014] border border-[#39363A] space-y-1.5">
                <div className="text-[10px] font-mono-code uppercase text-[#96929A] tracking-wider font-semibold flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>Primary Official Email</span>
                </div>
                <a
                  href="mailto:karshhtech@gmail.com"
                  className="font-mono-code text-sm sm:text-base font-bold text-[#F4F0E8] hover:text-[#FF5A36] transition-colors block break-all"
                >
                  karshhtech@gmail.com
                </a>
              </div>

              {/* Turnaround Time */}
              <div className="p-4 rounded-lg bg-[#101014] border border-[#39363A] space-y-1.5">
                <div className="text-[10px] font-mono-code uppercase text-[#96929A] tracking-wider font-semibold flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>Response Time</span>
                </div>
                <p className="text-xs text-[#C2BEC1]">
                  Inquiries are reviewed directly by our engineering leads within 24 to 48 business hours.
                </p>
              </div>

              {/* Scope & Capabilities */}
              <div className="p-4 rounded-lg bg-[#101014] border border-[#39363A] space-y-2">
                <div className="text-[10px] font-mono-code uppercase text-[#96929A] tracking-wider font-semibold flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>Disciplines Covered</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Websites', 'Web Apps', 'Mobile Apps', 'Games', 'Custom Software'].map((d) => (
                    <span
                      key={d}
                      className="px-2 py-0.5 rounded bg-[#1A191F] border border-[#39363A] text-[10px] font-mono-code text-[#C2BEC1]"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              {/* Privacy Guarantee */}
              <div className="flex items-start space-x-2.5 text-xs text-[#96929A] pt-2 border-t border-[#39363A]/60">
                <Shield className="w-4 h-4 text-[#FF5A36] flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Your communication is treated with confidentiality. We never sell, share, or market your information to third-party data aggregators.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Monolith Terminal Form & Packet Animation Card */}
          <div className="lg:col-span-7">
            <div className="relative w-full rounded-xl border border-[#39363A] bg-[#1A191F] p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden">
              
              {/* Top Ember Horizon Edge */}
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#FF5A36]/80 to-transparent" />
              
              {/* Precision Corner Crosshairs (matching monolith terminal design) */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#FF5A36]/70" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#FF5A36]/70" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#FF5A36]/70" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#FF5A36]/70" />

              <AnimatePresence mode="wait">
                {sent ? (
                  /* =========================================================================
                      PACKET DELIVERED ANIMATION & SUCCESS CARD
                      ========================================================================= */
                  <motion.div
                    key="packet-delivered"
                    initial={{ opacity: 0, scale: 0.94, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: -15 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="py-12 sm:py-16 text-center space-y-6"
                  >
                    {/* Concentric Animated Radar & Beacon */}
                    <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                      {/* Pulse Ring 1 */}
                      <motion.div
                        className="absolute inset-0 rounded-full border border-[#FF5A36]/40"
                        animate={{ scale: [1, 1.8, 2.4], opacity: [0.8, 0.3, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                      />
                      {/* Pulse Ring 2 */}
                      <motion.div
                        className="absolute inset-2 rounded-full border border-[#FF7454]/30"
                        animate={{ scale: [1, 1.5, 2.1], opacity: [0.6, 0.2, 0] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.4, ease: 'easeOut' }}
                      />
                      {/* Central Beacon Emblem */}
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', damping: 14, stiffness: 200 }}
                        className="relative z-10 w-16 h-16 rounded-full border-2 border-[#FF5A36] bg-[#101014] text-[#FF5A36] flex items-center justify-center shadow-[0_0_30px_rgba(255,90,54,0.4)]"
                      >
                        <Check className="w-8 h-8 text-[#FF5A36] stroke-[2.5]" />
                      </motion.div>
                    </div>

                    {/* Headline & Delivery Message */}
                    <div className="space-y-2">
                      <span className="block text-[10px] font-mono-code tracking-[0.25em] uppercase text-[#FF5A36] font-semibold">
                        // DISPATCH CONFIRMED // STATUS: 200 DELIVERED
                      </span>
                      <h3 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold uppercase text-[#F4F0E8] tracking-tight leading-none">
                        PACKET DELIVERED
                      </h3>
                      <p className="text-sm font-semibold text-[#F4F0E8] pt-1">
                        Packet successfully delivered!
                      </p>
                      <p className="text-xs text-[#C2BEC1] max-w-md mx-auto leading-relaxed pt-1">
                        Your message has been transmitted to Karsh Tech. We'll get back to you as soon as possible.
                      </p>
                    </div>

                    {/* Telemetry Readout */}
                    <div className="max-w-sm mx-auto p-3.5 rounded bg-[#101014] border border-[#39363A] text-left text-[10px] font-mono-code text-[#96929A] space-y-1">
                      <div className="flex justify-between">
                        <span>RECIPIENT:</span>
                        <span className="text-[#F4F0E8] font-bold">karshhtech@gmail.com</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CHANNEL:</span>
                        <span className="text-[#FF5A36]">ENCRYPTED TLS TRANSMISSION</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TIMESTAMP:</span>
                        <span className="text-[#C2BEC1]">{new Date().toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* 5-Second Animated Reset Bar */}
                    <div className="max-w-sm mx-auto space-y-2 pt-2">
                      <div className="w-full bg-[#101014] border border-[#39363A] rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          initial={{ width: '100%' }}
                          animate={{ width: '0%' }}
                          transition={{ duration: 5, ease: 'linear' }}
                          className="h-full bg-gradient-to-r from-[#FF5A36] via-[#FF7454] to-[#F4F0E8]"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-mono-code text-[#96929A]">
                        <span>AUTOMATIC FORM RESET IN 5s</span>
                        <button
                          type="button"
                          onClick={handleManualReset}
                          className="text-[#FF5A36] hover:text-[#FF7454] uppercase tracking-wider flex items-center gap-1 font-bold cursor-pointer"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>RESET NOW</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* =========================================================================
                      TRANSMISSION FORM (ACTIVE STATE)
                      ========================================================================= */
                  <motion.div
                    key="active-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div>
                      <span className="text-[10px] font-mono-code uppercase text-[#FF5A36] tracking-wider font-semibold">
                        TRANSMISSION FORM // DIRECT DISPATCH
                      </span>
                      <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase text-[#F4F0E8] mt-1">
                        INITIALIZE TRANSMISSION.
                      </h2>
                      <p className="text-xs text-[#96929A] mt-1">
                        Complete the fields below to dispatch your message directly to Karsh Tech.
                      </p>
                    </div>

                    {/* Error Alert with Dismiss */}
                    {errorMessage && (
                      <div
                        role="alert"
                        className="p-3.5 rounded border border-red-500/50 bg-red-950/30 text-red-200 text-xs font-mono-code flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          <span>{errorMessage}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setErrorMessage(null)}
                          className="text-[10px] tracking-widest uppercase text-[#96929A] hover:text-white ml-2 transition-colors cursor-pointer"
                        >
                          DISMISS
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Name */}
                        <div>
                          <label className="block text-[10px] font-mono-code tracking-[0.16em] uppercase text-[#96929A] mb-1.5 font-semibold">
                            // SENDER NAME *
                          </label>
                          <input
                            type="text"
                            required
                            disabled={isSubmitting}
                            value={formData.name}
                            onChange={(e) => {
                              setFormData({ ...formData, name: e.target.value });
                              if (errorMessage) setErrorMessage(null);
                            }}
                            placeholder="Alex Morgan"
                            className="w-full px-4 py-2.5 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors disabled:opacity-60"
                          />
                        </div>

                        {/* Email */}
                        <div>
                          <label className="block text-[10px] font-mono-code tracking-[0.16em] uppercase text-[#96929A] mb-1.5 font-semibold">
                            // TRANSMISSION CHANNEL (EMAIL) *
                          </label>
                          <input
                            type="email"
                            required
                            disabled={isSubmitting}
                            value={formData.email}
                            onChange={(e) => {
                              setFormData({ ...formData, email: e.target.value });
                              if (errorMessage) setErrorMessage(null);
                            }}
                            placeholder="alex@domain.com"
                            className="w-full px-4 py-2.5 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors font-mono-code disabled:opacity-60"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Category */}
                        <div>
                          <label className="block text-[10px] font-mono-code tracking-[0.16em] uppercase text-[#96929A] mb-1.5 font-semibold">
                            // CLASSIFICATION
                          </label>
                          <select
                            disabled={isSubmitting}
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-4 py-2.5 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] focus:outline-none focus:border-[#FF5A36] transition-colors cursor-pointer disabled:opacity-60"
                          >
                            {categories.map((c) => (
                              <option key={c} value={c} className="bg-[#1A191F] text-[#F4F0E8]">
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Subject */}
                        <div>
                          <label className="block text-[10px] font-mono-code tracking-[0.16em] uppercase text-[#96929A] mb-1.5 font-semibold">
                            // SUBJECT OVERVIEW
                          </label>
                          <input
                            type="text"
                            disabled={isSubmitting}
                            value={formData.subject}
                            onChange={(e) => {
                              setFormData({ ...formData, subject: e.target.value });
                              if (errorMessage) setErrorMessage(null);
                            }}
                            placeholder="e.g. Website Overhaul / Mobile Solution"
                            className="w-full px-4 py-2.5 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors disabled:opacity-60"
                          />
                        </div>
                      </div>

                      {/* Message */}
                      <div>
                        <label className="block text-[10px] font-mono-code tracking-[0.16em] uppercase text-[#96929A] mb-1.5 font-semibold">
                          // TRANSMISSION PAYLOAD *
                        </label>
                        <textarea
                          required
                          rows={5}
                          disabled={isSubmitting}
                          value={formData.message}
                          onChange={(e) => {
                            setFormData({ ...formData, message: e.target.value });
                            if (errorMessage) setErrorMessage(null);
                          }}
                          placeholder="Provide details about your project scope, target timeline, technical requirements, or inquiry..."
                          className="w-full px-4 py-3 rounded bg-[#101014] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A]/50 focus:outline-none focus:border-[#FF5A36] transition-colors leading-relaxed resize-none disabled:opacity-60"
                        />
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full py-3.5 rounded border border-[#FF5A36]/40 bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] text-xs font-bold uppercase tracking-[0.2em] transition-all shadow-lg shadow-[#FF5A36]/20 flex items-center justify-center space-x-2 ${
                          isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        {isSubmitting ? (
                          <span className="flex items-center space-x-2">
                            <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#101014] border-t-transparent animate-spin" />
                            <span>TRANSMITTING DISPATCH...</span>
                          </span>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>EXECUTE DISPATCH ↗</span>
                          </>
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

        </div>
      </section>
    </div>
  );
};

import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenshots: string[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
}

export const ScreenshotModal: React.FC<ScreenshotModalProps> = ({
  isOpen,
  onClose,
  screenshots,
  currentIndex,
  onSelectIndex,
}) => {
  const handlePrev = useCallback(() => {
    onSelectIndex((currentIndex - 1 + screenshots.length) % screenshots.length);
  }, [currentIndex, screenshots.length, onSelectIndex]);

  const handleNext = useCallback(() => {
    onSelectIndex((currentIndex + 1) % screenshots.length);
  }, [currentIndex, screenshots.length, onSelectIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#101014]/95 backdrop-blur-xl p-4 sm:p-8"
          onClick={onClose}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2.5 rounded border border-[#39363A] bg-[#1A191F] hover:border-[#FF5A36] text-[#F4F0E8] transition-all z-50"
            aria-label="Close screenshot preview"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Previous Button */}
          {screenshots.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 p-3 rounded border border-[#39363A] bg-[#1A191F]/90 hover:border-[#FF5A36] text-[#F4F0E8] transition-all z-50"
              aria-label="Previous screenshot"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Active Image Stage */}
          <div
            className="relative max-w-5xl max-h-[85vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="relative rounded-lg border border-[#39363A] bg-[#1A191F] p-2 shadow-2xl overflow-hidden"
              >
                <img
                  src={screenshots[currentIndex]}
                  alt={`Screenshot ${currentIndex + 1}`}
                  className="max-h-[76vh] w-auto max-w-full rounded object-contain"
                />
              </motion.div>
            </AnimatePresence>

            {/* Bottom thumbnail selector */}
            <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 flex items-center space-x-2.5 overflow-x-auto max-w-full px-4 py-1">
              {screenshots.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectIndex(idx)}
                  className={`relative w-12 h-8 rounded overflow-hidden border transition-all ${
                    idx === currentIndex
                      ? 'border-[#FF5A36] scale-105 shadow-sm'
                      : 'border-[#39363A] opacity-40 hover:opacity-100'
                  }`}
                >
                  <img src={s} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Next Button */}
          {screenshots.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 p-3 rounded border border-[#39363A] bg-[#1A191F]/90 hover:border-[#FF5A36] text-[#F4F0E8] transition-all z-50"
              aria-label="Next screenshot"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export const CustomCursor: React.FC = () => {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isHovered, setIsHovered] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    setIsClient(true);
    // Disable on coarse pointer devices (touch screens)
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });

      const target = e.target as HTMLElement | null;
      if (target) {
        const interactive = target.closest('a, button, input, textarea, select, [role="button"]');
        setIsHovered(!!interactive);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (!isClient || shouldReduceMotion || position.x < 0) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-50 rounded-full border border-[#FF5A36]/40 flex items-center justify-center hidden md:flex"
      animate={{
        x: position.x - (isHovered ? 20 : 4),
        y: position.y - (isHovered ? 20 : 4),
        width: isHovered ? 40 : 8,
        height: isHovered ? 40 : 8,
        backgroundColor: isHovered ? 'rgba(255, 90, 54, 0.08)' : '#FF5A36',
        borderColor: isHovered ? '#FF5A36' : 'rgba(255, 90, 54, 0.4)',
      }}
      transition={{ type: 'spring', damping: 28, stiffness: 360, mass: 0.4 }}
    />
  );
};

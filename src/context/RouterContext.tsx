import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface RouterContextType {
  path: string;
  hash: string;
  navigate: (to: string) => void;
  params: Record<string, string>;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [path, setPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  const [hash, setHash] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash || '';
    }
    return '';
  });

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname || '/');
      const currentHash = window.location.hash || '';
      setHash(currentHash);
      if (currentHash) {
        const targetId = currentHash.replace('#', '');
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (typeof window !== 'undefined') {
      const [pathPart, hashPart] = to.split('#');
      const targetPath = pathPart || window.location.pathname || '/';
      const targetHash = hashPart ? `#${hashPart}` : '';

      window.history.pushState({}, '', to);
      setPath(targetPath);
      setHash(targetHash);

      if (targetHash) {
        setTimeout(() => {
          const targetId = targetHash.replace('#', '');
          const el = document.getElementById(targetId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 60);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, []);

  // Compute route params (e.g. /games/:slug, /products/:slug)
  const params: Record<string, string> = {};
  if (path.startsWith('/games/')) {
    const slug = path.replace('/games/', '').split('/')[0];
    if (slug) params.slug = slug;
  } else if (path.startsWith('/products/')) {
    const slug = path.replace('/products/', '').split('/')[0];
    if (slug) params.slug = slug;
  }

  return (
    <RouterContext.Provider value={{ path, hash, navigate, params }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = (): RouterContextType => {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return ctx;
};

export const Link: React.FC<{
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  id?: string;
  target?: string;
  rel?: string;
}> = ({ href, className, style, children, onClick, title, id, target, rel }) => {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('/uploads/')) {
      return; // normal external link or download
    }
    e.preventDefault();
    if (onClick) onClick();
    navigate(href);
  };

  return (
    <a href={href} className={className} style={style} onClick={handleClick} title={title} id={id} target={target} rel={rel}>
      {children}
    </a>
  );
};

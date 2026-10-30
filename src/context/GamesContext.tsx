import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Game } from '../types';
import { api } from '../lib/api';

interface GamesContextType {
  games: Game[];
  loading: boolean;
  featuredGame: Game | undefined;
  refreshGames: () => Promise<Game[]>;
}

const GamesContext = createContext<GamesContextType | undefined>(undefined);

export const GamesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshGames = useCallback(async (): Promise<Game[]> => {
    try {
      setLoading(true);
      const data = await api.getGames();
      setGames(data);
      return data;
    } catch (err) {
      console.error('Failed to load games from database', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshGames();

    const handleGamesChanged = () => {
      refreshGames();
    };

    window.addEventListener('karshtech:games-updated', handleGamesChanged);
    return () => {
      window.removeEventListener('karshtech:games-updated', handleGamesChanged);
    };
  }, [refreshGames]);

  // Authoritative featured game logic: only select an existing, published game
  const featuredGame = useMemo(() => {
    if (!games || games.length === 0) return undefined;
    return (
      games.find((g) => g.featured && (g.status === 'Available' || g.status === 'Updated')) ||
      games.find((g) => g.featured) ||
      games.find((g) => g.status === 'Available' || g.status === 'Updated') ||
      games[0]
    );
  }, [games]);

  return (
    <GamesContext.Provider value={{ games, loading, featuredGame, refreshGames }}>
      {children}
    </GamesContext.Provider>
  );
};

export const useGames = (): GamesContextType => {
  const ctx = useContext(GamesContext);
  if (!ctx) {
    throw new Error('useGames must be used within a GamesProvider');
  }
  return ctx;
};

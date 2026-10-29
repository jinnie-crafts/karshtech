import React, { useState } from 'react';
import { useRouter, Link } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { Shield, Lock, User, AlertCircle, ArrowLeft } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const { navigate } = useRouter();
  const { login, user } = useAuth();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect
  if (user) {
    if (typeof window !== 'undefined') {
      navigate('/admin');
    }
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ username, password });
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#101014] text-[#C2BEC1] relative overflow-hidden font-sans">
      {/* Ambient background ember glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FF5A36]/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        <div className="mb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-[#96929A] hover:text-[#FF5A36] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Public Website</span>
          </Link>
        </div>

        <div className="p-8 sm:p-10 rounded-xl bg-[#1A191F] border border-[#39363A] shadow-2xl space-y-6">
          {/* Logo & Heading */}
          <div className="text-center space-y-2.5">
            <div className="w-12 h-12 rounded-full border border-[#39363A] bg-[#242329] text-[#FF5A36] flex items-center justify-center mx-auto shadow-sm">
              <Shield className="w-6 h-6 text-[#FF5A36]" />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-[#F4F0E8] uppercase">
              PUBLISHING CONSOLE
            </h1>
            <p className="text-[10px] text-[#96929A] uppercase tracking-[0.2em] font-semibold">
              AUTHENTICATED STUDIO ACCESS
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded bg-red-950/30 border border-red-500/40 text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono-code text-[#96929A] uppercase mb-1.5 font-semibold">
                Admin Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#96929A]" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-10 pr-4 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A] focus:outline-none focus:border-[#FF5A36] font-mono-code transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono-code text-[#96929A] uppercase mb-1.5 font-semibold">
                Master Security Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#96929A]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded bg-[#0A0A0D] border border-[#39363A] text-xs text-[#F4F0E8] placeholder-[#96929A] focus:outline-none focus:border-[#FF5A36] font-mono-code transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded bg-[#FF5A36] hover:bg-[#FF7454] text-[#101014] font-bold text-xs uppercase tracking-wider transition-colors shadow-md shadow-[#FF5A36]/20 disabled:opacity-50 mt-2"
            >
              {loading ? 'AUTHENTICATING...' : 'SIGN IN TO CONSOLE'}
            </button>
          </form>

          {/* Credentials Info Notice */}
          <div className="pt-4 border-t border-[#39363A] text-xs text-[#96929A] space-y-1 bg-[#101014] p-3.5 rounded border border-[#39363A]">
            <div className="text-[#FF5A36] font-bold uppercase tracking-wider text-[10px]">
              Initial Studio Credentials:
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#96929A]">Username:</span>
              <span className="font-mono-code text-[#F4F0E8]">admin</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#96929A]">Password:</span>
              <span className="font-mono-code text-[#FF5A36]">KarshTechAdmin2026!</span>
            </div>
            <div className="text-[10px] text-[#96929A] pt-1">
              Credentials can be updated anytime inside Studio Settings.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

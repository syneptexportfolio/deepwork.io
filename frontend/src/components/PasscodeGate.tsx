import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { api, setStoredPasscode } from '../services/api';

interface PasscodeGateProps {
  onSuccess: () => void;
}

export const PasscodeGate: React.FC<PasscodeGateProps> = ({ onSuccess }) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.verifyPasscode(passcode);
      if (res.success) {
        setStoredPasscode(passcode);
        onSuccess();
      } else {
        setError('Invalid passcode. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Passcode verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-luma-bg flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-sm bg-luma-card border border-luma-card-border rounded-3xl p-8 shadow-2xl text-center">
        {/* Luma Brand */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="font-serif text-3xl font-bold tracking-tight text-white">Luma</span>
          <div className="w-4 h-4 rounded-full bg-[#1b2612] flex items-center justify-center border border-luma-lime/40">
            <div className="w-2 h-2 rounded-full bg-luma-lime shadow-[0_0_8px_#d4f938]"></div>
          </div>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-[#201d36] border border-luma-purple/30 mx-auto flex items-center justify-center mb-4 text-luma-purple">
          <Lock className="w-5 h-5" />
        </div>

        <h2 className="text-xl font-serif font-bold text-white mb-1">
          Welcome back
        </h2>
        <p className="text-xs text-luma-text-muted mb-6">
          Enter your personal passcode to access your rhythm.
        </p>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <input
              type="password"
              autoFocus
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#1b1c1b] border border-luma-card-border focus:border-luma-lime rounded-2xl px-4 py-3 text-center text-lg tracking-widest text-white focus:outline-none transition-all"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !passcode}
            className="w-full flex items-center justify-center gap-2 bg-luma-lime hover:bg-luma-lime-hover text-black py-3 rounded-2xl font-semibold text-xs shadow-lime-glow transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <span>{loading ? 'Verifying...' : 'Unlock Luma'}</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>
      </div>
    </div>
  );
};

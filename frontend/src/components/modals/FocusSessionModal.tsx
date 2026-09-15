import React, { useState, useEffect } from 'react';
import { X, Play, Pause, RotateCcw, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface FocusSessionModalProps {
  isOpen: boolean;
  taskTitle: string;
  durationMinutes: number;
  onClose: () => void;
  onComplete: () => void;
}

export const FocusSessionModal: React.FC<FocusSessionModalProps> = ({
  isOpen,
  taskTitle,
  durationMinutes,
  onClose,
  onComplete,
}) => {
  const totalSeconds = durationMinutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    setSecondsLeft(durationMinutes * 60);
    setIsActive(false);
  }, [durationMinutes, isOpen]);

  useEffect(() => {
    let interval: any = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (secondsLeft === 0 && isActive) {
      setIsActive(false);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  if (!isOpen) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progressPercent = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  const handleFinish = () => {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    onComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-luma-card border border-luma-card-border rounded-3xl p-6 sm:p-8 shadow-2xl relative text-center">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-luma-text-muted hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-[11px] font-mono tracking-widest uppercase text-luma-lime mb-2">
          FOCUS IN PROGRESS
        </div>

        <h3 className="text-2xl font-serif font-bold text-white mb-8">
          {taskTitle}
        </h3>

        {/* Circular Timer Display */}
        <div className="relative w-56 h-56 mx-auto mb-8 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="112"
              cy="112"
              r="95"
              className="stroke-[#252825] fill-none"
              strokeWidth="8"
            />
            <circle
              cx="112"
              cy="112"
              r="95"
              className="stroke-luma-lime fill-none transition-all duration-300"
              strokeWidth="8"
              strokeDasharray={2 * Math.PI * 95}
              strokeDashoffset={2 * Math.PI * 95 - (progressPercent / 100) * 2 * Math.PI * 95}
              strokeLinecap="round"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-mono font-bold text-white tracking-tight">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
            <span className="text-xs font-mono text-luma-text-muted mt-1">
              {durationMinutes} MINUTE BLOCK
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => setSecondsLeft(totalSeconds)}
            title="Reset"
            className="p-3 rounded-full bg-[#1e201e] hover:bg-[#282b28] text-luma-text-muted hover:text-white transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsActive(!isActive)}
            className="flex items-center justify-center w-14 h-14 rounded-2xl bg-luma-lime hover:bg-luma-lime-hover text-black shadow-lime-glow transition-all active:scale-95"
          >
            {isActive ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black ml-0.5" />}
          </button>

          <button
            onClick={handleFinish}
            title="Mark Complete"
            className="p-3 rounded-full bg-[#1e201e] hover:bg-[#282b28] text-luma-lime transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-luma-text-dim italic">
          "One clear commitment at a time. Protect your rhythm."
        </p>
      </div>
    </div>
  );
};

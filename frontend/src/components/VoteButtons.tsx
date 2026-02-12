'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface VoteButtonsProps {
  answerId: string;
  initialScore: number;
  initialUserVote: number | null;
  onScoreChange?: (newScore: number) => void;
}

export function VoteButtons({
  answerId,
  initialScore,
  initialUserVote,
  onScoreChange,
}: VoteButtonsProps) {
  const { isAuthenticated } = useAuthStore();
  const [score, setScore] = useState(initialScore);
  const [userVote, setUserVote] = useState<number | null>(initialUserVote);
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = useCallback(
    async (value: 1 | -1) => {
      if (!isAuthenticated || isVoting) return;

      const previousScore = score;
      const previousVote = userVote;

      // Optimistic update
      if (userVote === value) {
        // Remove vote (toggle off)
        const diff = -value;
        setScore((s) => s + diff);
        setUserVote(null);
      } else {
        // Add or change vote
        const diff = userVote ? value - userVote : value;
        setScore((s) => s + diff);
        setUserVote(value);
      }

      setIsVoting(true);
      try {
        if (previousVote === value) {
          // Was toggling off
          const res = await api.removeVote(answerId);
          setScore(res.data.new_score);
          setUserVote(res.data.user_vote);
          onScoreChange?.(res.data.new_score);
        } else {
          const res = await api.vote(answerId, value);
          setScore(res.data.new_score);
          setUserVote(res.data.user_vote);
          onScoreChange?.(res.data.new_score);
        }
      } catch {
        // Revert on error
        setScore(previousScore);
        setUserVote(previousVote);
      } finally {
        setIsVoting(false);
      }
    },
    [answerId, isAuthenticated, isVoting, score, userVote, onScoreChange]
  );

  const upActive = userVote === 1;
  const downActive = userVote === -1;
  const disabled = !isAuthenticated;

  return (
    <div className="flex flex-col items-center gap-0.5">
      {/* Upvote */}
      <button
        onClick={() => handleVote(1)}
        disabled={disabled || isVoting}
        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
          disabled
            ? 'text-faint cursor-not-allowed'
            : upActive
            ? 'text-indigo bg-indigo-light'
            : 'text-caption hover:text-indigo hover:bg-indigo-light'
        }`}
        title={disabled ? 'Log in to vote' : upActive ? 'Remove upvote' : 'Upvote'}
        aria-label="Upvote"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={upActive ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={2.5}
          className="w-5 h-5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Score */}
      <span
        className={`font-[family-name:var(--font-fira-code)] text-base font-semibold tabular-nums py-0.5 ${
          upActive ? 'text-indigo' : downActive ? 'text-rose' : 'text-ink'
        }`}
      >
        {score}
      </span>

      {/* Downvote */}
      <button
        onClick={() => handleVote(-1)}
        disabled={disabled || isVoting}
        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
          disabled
            ? 'text-faint cursor-not-allowed'
            : downActive
            ? 'text-rose bg-rose-light'
            : 'text-caption hover:text-rose hover:bg-rose-light'
        }`}
        title={disabled ? 'Log in to vote' : downActive ? 'Remove downvote' : 'Downvote'}
        aria-label="Downvote"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={downActive ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={2.5}
          className="w-5 h-5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}

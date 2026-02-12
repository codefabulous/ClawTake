'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Answer } from '@/types';
import { timeAgo } from '@/lib/utils';
import { VoteButtons } from './VoteButtons';
import { CommentSection } from './CommentSection';

interface AnswerCardProps {
  answer: Answer;
}

export function AnswerCard({ answer }: AnswerCardProps) {
  const [showComments, setShowComments] = useState(false);

  return (
    <div
      className={`bg-card border rounded-xl shadow-sm ${
        answer.is_best_answer
          ? 'border-l-4 border-l-teal border-t-border border-r-border border-b-border'
          : 'border-border'
      }`}
    >
      <div className="p-5">
        {/* Best answer badge */}
        {answer.is_best_answer && (
          <div className="flex items-center gap-1.5 mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-light text-teal text-xs font-semibold">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
              Best Answer
            </span>
          </div>
        )}

        <div className="flex gap-5">
          {/* Vote buttons */}
          <div className="flex-shrink-0">
            <VoteButtons
              answerId={answer.id}
              initialScore={answer.score}
              initialUserVote={answer.user_vote}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Agent info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-indigo-light flex items-center justify-center text-indigo text-sm font-bold flex-shrink-0">
                {(answer.agent_display_name || answer.agent_name).charAt(0).toUpperCase()}
              </div>
              <div className="flex items-center gap-2.5 min-w-0">
                <Link
                  href={`/agents/${answer.agent_name}`}
                  className="text-sm font-semibold text-ink hover:text-indigo transition-colors truncate"
                >
                  {answer.agent_display_name || answer.agent_name}
                </Link>
                <span className="font-[family-name:var(--font-fira-code)] text-xs text-caption flex-shrink-0">
                  {answer.agent_reputation.toLocaleString()} rep
                </span>
              </div>
            </div>

            {/* Answer content */}
            <div className="text-sm text-ink leading-7 whitespace-pre-wrap break-words">
              {answer.content}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-border-light">
              <button
                onClick={() => setShowComments(!showComments)}
                className="text-xs text-caption hover:text-body font-medium transition-colors cursor-pointer"
              >
                {showComments ? 'Hide comments' : 'Comments'}
              </button>
              <span className="text-xs text-faint">
                answered {timeAgo(answer.created_at)}
              </span>
            </div>

            {/* Comments section */}
            {showComments && <CommentSection answerId={answer.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}

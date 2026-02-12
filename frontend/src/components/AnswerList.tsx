'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { Answer } from '@/types';
import { AnswerCard } from './AnswerCard';

interface AnswerListProps {
  questionId: string;
}

type SortOption = 'best' | 'newest';

export function AnswerList({ questionId }: AnswerListProps) {
  const [sort, setSort] = useState<SortOption>('best');

  const { data, error, isLoading } = useSWR(
    `answers-${questionId}-${sort}`,
    () =>
      api
        .getAnswers(questionId, { sort: sort === 'best' ? 'votes' : 'newest' })
        .then((res) => res.data.answers as Answer[])
  );

  const answers = data ?? [];

  const sortTabs: { key: SortOption; label: string }[] = [
    { key: 'best', label: 'Best' },
    { key: 'newest', label: 'Newest' },
  ];

  return (
    <div>
      {/* Header with sort tabs */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-[family-name:var(--font-lora)] text-lg font-semibold text-ink">
          <span className="font-[family-name:var(--font-fira-code)] text-indigo">{answers.length}</span>
          {' '}{answers.length === 1 ? 'Answer' : 'Answers'}
        </h2>
        <div className="flex items-center gap-1 bg-warm rounded-lg p-1">
          {sortTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSort(tab.key)}
              className={`px-3.5 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
                sort === tab.key
                  ? 'bg-indigo-light text-indigo font-medium'
                  : 'text-caption hover:text-body'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-8">
          <p className="text-error text-sm">Failed to load answers.</p>
        </div>
      )}

      {/* Answer list */}
      {!isLoading && !error && (
        <div className="space-y-4">
          {answers.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl shadow-sm">
              <p className="text-caption">No answers yet. AI agents are working on it!</p>
            </div>
          ) : (
            answers.map((answer) => <AnswerCard key={answer.id} answer={answer} />)
          )}
        </div>
      )}
    </div>
  );
}

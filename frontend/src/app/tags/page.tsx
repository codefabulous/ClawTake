'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import type { Tag } from '@/types';

const TAG_COLORS = [
  { bg: 'bg-indigo-light', text: 'text-indigo' },
  { bg: 'bg-teal-light', text: 'text-teal' },
  { bg: 'bg-amber-light', text: 'text-amber-warm' },
  { bg: 'bg-violet-light', text: 'text-violet' },
  { bg: 'bg-rose-light', text: 'text-rose' },
];

export default function TagsPage() {
  const { data, error, isLoading } = useSWR('tags', () => api.getTags());

  const tags: Tag[] = data?.data?.tags ?? [];

  return (
    <div className="max-w-[1080px] mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-lora)] text-3xl font-semibold text-ink">
          Tags
        </h1>
        <p className="mt-2 text-caption text-sm">
          Browse questions by topic
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-indigo" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-rose/20 bg-rose-light px-4 py-3 text-sm text-rose">
          Failed to load tags. Please try again later.
        </div>
      )}

      {/* Tags grid */}
      {!isLoading && !error && (
        <>
          {tags.length === 0 ? (
            <p className="py-12 text-center text-faint">No tags found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {tags.map((tag, index) => {
                const color = TAG_COLORS[index % TAG_COLORS.length];
                return (
                  <Link
                    key={tag.id}
                    href={`/?tag=${encodeURIComponent(tag.name)}`}
                    className="group bg-card border border-border rounded-xl p-4 transition-colors hover:border-indigo/40 hover:shadow-sm"
                  >
                    <div className={`mb-2.5 inline-block rounded-full px-3 py-1 text-sm font-medium ${color.bg} ${color.text} transition-colors`}>
                      {tag.name}
                    </div>
                    <div className="text-sm text-body font-medium">{tag.display_name}</div>
                    <div className="mt-1.5 text-xs text-caption">
                      <span className="font-[family-name:var(--font-fira-code)]">
                        {formatNumber(tag.question_count)}
                      </span>{' '}
                      {tag.question_count === 1 ? 'question' : 'questions'}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

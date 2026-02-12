'use client';

import Link from 'next/link';
import type { Question } from '@/types';
import { timeAgo } from '@/lib/utils';

interface QuestionCardProps {
  question: Question;
}

/** Rotating pill color palette keyed by tag index. */
const TAG_STYLES = [
  'bg-indigo-light text-indigo',
  'bg-teal-light text-teal',
  'bg-amber-light text-amber-warm',
  'bg-violet-light text-violet',
  'bg-rose-light text-rose',
] as const;

export function QuestionCard({ question }: QuestionCardProps) {
  const hasAnswers = question.answer_count > 0;

  // Build a plain-text excerpt from the body (strip any markdown-ish formatting).
  const excerpt = question.body
    .replace(/[#*_`~>\[\]()!]/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  return (
    <Link
      href={`/questions/${question.id}`}
      className="group block rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-[2px] hover:shadow-md"
    >
      <div className="flex overflow-hidden rounded-xl">
        {/* ── 1. Accent bar ── */}
        <div
          className={`w-1 shrink-0 transition-colors duration-200 ${
            hasAnswers
              ? 'bg-teal'
              : 'bg-transparent group-hover:bg-indigo'
          }`}
        />

        {/* ── 2. Stats sidebar ── */}
        <div className="hidden sm:flex w-[76px] shrink-0 flex-col items-center justify-center gap-0.5 border-r border-border-light bg-warm py-4">
          <span
            className={`font-[family-name:var(--font-fira-code)] text-xl font-bold leading-none ${
              hasAnswers ? 'text-teal' : 'text-faint'
            }`}
          >
            {question.answer_count}
          </span>
          <span className="text-[11px] text-faint">ans</span>
        </div>

        {/* ── 3. Content area ── */}
        <div className="flex-1 min-w-0 px-4 py-3.5 sm:px-5 sm:py-4">
          {/* Title */}
          <h3 className="font-[family-name:var(--font-lora)] text-base sm:text-[17px] font-semibold leading-snug text-ink line-clamp-2 group-hover:text-indigo transition-colors">
            {question.title}
          </h3>

          {/* Excerpt (hidden on mobile) */}
          {excerpt && (
            <p className="hidden sm:block mt-1.5 text-sm leading-relaxed text-caption line-clamp-2">
              {excerpt}
            </p>
          )}

          {/* Footer */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Tags */}
            {question.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {question.tags.map((tag, idx) => (
                  <span
                    key={tag.id}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      TAG_STYLES[idx % TAG_STYLES.length]
                    }`}
                  >
                    {tag.display_name}
                  </span>
                ))}
              </div>
            )}

            {/* Spacer pushes meta to the right */}
            <span className="flex-1" />

            {/* Meta info */}
            <div className="flex items-center gap-1.5 text-xs text-faint whitespace-nowrap">
              <span className="font-medium text-caption">
                {question.author_display_name || question.author_username}
              </span>
              <span>&middot;</span>
              <span>{timeAgo(question.created_at)}</span>
              <span className="hidden sm:inline-flex items-center gap-0.5 ml-1 rounded bg-warm px-1.5 py-0.5 text-[11px] text-faint">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="opacity-50">
                  <path d="M8 3C4.5 3 1.7 5.5 1 8c.7 2.5 3.5 5 7 5s6.3-2.5 7-5c-.7-2.5-3.5-5-7-5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                {question.view_count}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

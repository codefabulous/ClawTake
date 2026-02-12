'use client';

import { use } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { AnswerList } from '@/components/AnswerList';
import type { Question } from '@/types';

interface QuestionPageProps {
  params: Promise<{ id: string }>;
}

const TAG_COLORS = [
  { bg: 'bg-indigo-light', text: 'text-indigo', hover: 'hover:bg-indigo/15' },
  { bg: 'bg-teal-light', text: 'text-teal', hover: 'hover:bg-teal/15' },
  { bg: 'bg-amber-light', text: 'text-amber-warm', hover: 'hover:bg-amber-warm/15' },
  { bg: 'bg-violet-light', text: 'text-violet', hover: 'hover:bg-violet/15' },
  { bg: 'bg-rose-light', text: 'text-rose', hover: 'hover:bg-rose/15' },
];

export default function QuestionPage({ params }: QuestionPageProps) {
  const { id } = use(params);

  const { data, error, isLoading } = useSWR(`question-${id}`, () =>
    api.getQuestion(id).then((res) => res.data.question as Question)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-[1080px] mx-auto px-6 py-16 text-center">
        <h2 className="font-[family-name:var(--font-lora)] text-xl font-semibold text-ink mb-2">
          Question not found
        </h2>
        <p className="text-caption text-sm mb-4">
          This question may have been removed or the link is incorrect.
        </p>
        <Link href="/" className="text-indigo hover:text-indigo-hover text-sm font-medium transition-colors">
          Back to questions
        </Link>
      </div>
    );
  }

  const question = data;

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-8">
      {/* Question header */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-lora)] text-2xl font-semibold text-ink leading-tight mb-3">
          {question.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-caption">
          <span>
            Asked by{' '}
            <span className="text-body font-medium">
              {question.author_display_name || question.author_username}
            </span>
          </span>
          <span className="text-faint">{timeAgo(question.created_at)}</span>
          <span className="font-[family-name:var(--font-fira-code)] text-xs text-caption">
            {question.view_count.toLocaleString()} views
          </span>
          <span className="font-[family-name:var(--font-fira-code)] text-xs text-caption">
            {question.answer_count} {question.answer_count === 1 ? 'answer' : 'answers'}
          </span>
          {question.is_closed && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-light text-rose text-xs font-medium">
              Closed
            </span>
          )}
        </div>
      </div>

      {/* Question body */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-8">
        <div className="text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">
          {question.body}
        </div>

        {/* Tags */}
        {question.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-border-light">
            {question.tags.map((tag, index) => {
              const color = TAG_COLORS[index % TAG_COLORS.length];
              return (
                <Link
                  key={tag.id}
                  href={`/?tag=${tag.name}`}
                  className={`px-3 py-1 text-xs font-medium rounded-full ${color.bg} ${color.text} ${color.hover} transition-colors`}
                >
                  {tag.display_name}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Answers section */}
      <AnswerList questionId={question.id} />
    </div>
  );
}

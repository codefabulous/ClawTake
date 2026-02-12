'use client';

import { use } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatNumber, timeAgo } from '@/lib/utils';
import type { Agent } from '@/types';

const TAG_COLORS = [
  { bg: 'bg-indigo-light', text: 'text-indigo', hover: 'hover:bg-indigo/15' },
  { bg: 'bg-teal-light', text: 'text-teal', hover: 'hover:bg-teal/15' },
  { bg: 'bg-amber-light', text: 'text-amber-warm', hover: 'hover:bg-amber-warm/15' },
  { bg: 'bg-violet-light', text: 'text-violet', hover: 'hover:bg-violet/15' },
  { bg: 'bg-rose-light', text: 'text-rose', hover: 'hover:bg-rose/15' },
];

export default function AgentProfilePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);

  const { data, error, isLoading } = useSWR(
    ['agent', name],
    () => api.getAgent(name),
  );

  const agent: Agent | null = data?.data?.agent ?? null;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-indigo" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-16 text-center">
        <h2 className="font-[family-name:var(--font-lora)] text-xl font-semibold text-ink mb-2">
          Agent not found
        </h2>
        <p className="text-caption text-sm mb-4">
          The agent &quot;{name}&quot; could not be found.
        </p>
        <Link
          href="/leaderboard"
          className="text-indigo hover:text-indigo-hover text-sm font-medium transition-colors"
        >
          Back to leaderboard
        </Link>
      </div>
    );
  }

  if (!agent) return null;

  const memberSince = new Date(agent.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="max-w-[720px] mx-auto px-4 py-10">
      {/* Back link */}
      <Link
        href="/leaderboard"
        className="mb-6 inline-flex items-center text-sm text-caption hover:text-indigo transition-colors"
      >
        <svg
          className="mr-1 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Leaderboard
      </Link>

      {/* Profile header */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.display_name}
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-indigo-light"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-indigo-light text-2xl font-bold text-indigo">
              {agent.display_name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Name and meta */}
          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--font-lora)] text-2xl font-semibold text-ink">
              {agent.display_name}
            </h1>
            <p className="text-sm text-faint">@{agent.name}</p>

            {/* Status badge */}
            <span
              className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                agent.status === 'active'
                  ? 'bg-teal-light text-teal'
                  : agent.status === 'suspended'
                    ? 'bg-rose-light text-rose'
                    : 'bg-amber-light text-amber-warm'
              }`}
            >
              {agent.status === 'active'
                ? 'Active'
                : agent.status === 'suspended'
                  ? 'Suspended'
                  : 'Pending Claim'}
            </span>

            {/* Bio */}
            {agent.bio && (
              <p className="mt-3 text-sm leading-relaxed text-body">
                {agent.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center shadow-sm">
          <div className="font-[family-name:var(--font-fira-code)] text-2xl font-bold text-indigo">
            {formatNumber(agent.reputation_score)}
          </div>
          <div className="mt-1 text-xs text-caption">Reputation</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center shadow-sm">
          <div className="font-[family-name:var(--font-fira-code)] text-2xl font-bold text-ink">
            {formatNumber(agent.total_answers)}
          </div>
          <div className="mt-1 text-xs text-caption">Answers</div>
        </div>
        <div className="col-span-2 bg-card border border-border rounded-xl p-4 text-center shadow-sm sm:col-span-1">
          <div className="text-base font-semibold text-ink">
            {memberSince}
          </div>
          <div className="mt-1 text-xs text-caption">Member since</div>
        </div>
      </div>

      {/* Last active */}
      {agent.last_active && (
        <p className="mt-4 text-xs text-faint">
          Last active {timeAgo(agent.last_active)}
        </p>
      )}

      {/* Expertise tags */}
      {agent.expertise_tags.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-caption">
            Expertise
          </h2>
          <div className="flex flex-wrap gap-2">
            {agent.expertise_tags.map((tag, index) => {
              const color = TAG_COLORS[index % TAG_COLORS.length];
              return (
                <Link
                  key={tag}
                  href={`/?tag=${encodeURIComponent(tag)}`}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${color.bg} ${color.text} ${color.hover} transition-colors`}
                >
                  {tag}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

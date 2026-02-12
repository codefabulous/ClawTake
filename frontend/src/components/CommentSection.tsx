'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { timeAgo } from '@/lib/utils';
import type { Comment } from '@/types';

interface CommentSectionProps {
  answerId: string;
}

function CommentNode({ comment, depth }: { comment: Comment; depth: number }) {
  const clampedDepth = Math.min(depth, 4);

  return (
    <div
      className={clampedDepth > 0 ? 'ml-5 pl-4 border-l-2 border-indigo-light' : ''}
    >
      <div className="py-3">
        <p className="text-sm text-ink leading-relaxed">{comment.content}</p>
        <div className="flex items-center gap-2 mt-1.5 text-xs">
          <span className="text-body font-medium">
            {comment.author.display_name}
          </span>
          <span className="text-faint">{timeAgo(comment.created_at)}</span>
        </div>
      </div>
      {comment.children && comment.children.length > 0 && (
        <div>
          {comment.children.map((child) => (
            <CommentNode key={child.id} comment={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentSection({ answerId }: CommentSectionProps) {
  const { isAuthenticated } = useAuthStore();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, mutate } = useSWR(
    `comments-${answerId}`,
    () => api.getComments(answerId).then((res) => res.data.comments as Comment[])
  );

  const comments = data ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await api.createComment(answerId, { content: trimmed });
      setContent('');
      mutate();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to post comment';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 pt-3">
      {/* Comment list */}
      {comments.length > 0 && (
        <div className="mb-4 bg-warm rounded-lg px-4 py-1 divide-y divide-border-light">
          {comments.map((comment) => (
            <CommentNode key={comment.id} comment={comment} depth={0} />
          ))}
        </div>
      )}

      {/* Add comment form */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="flex gap-2 items-start">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-indigo-light focus:border-indigo transition-colors"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="px-4 py-2 text-sm font-medium bg-indigo-light text-indigo rounded-lg hover:bg-indigo/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? 'Posting...' : 'Comment'}
          </button>
        </form>
      ) : (
        <p className="text-xs text-faint pt-2 border-t border-border-light">
          Log in to add a comment.
        </p>
      )}

      {error && <p className="text-xs text-error mt-2">{error}</p>}
    </div>
  );
}

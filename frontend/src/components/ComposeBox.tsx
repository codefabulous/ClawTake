'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export function ComposeBox({ onPosted }: { onPosted?: () => void }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showBody, setShowBody] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  useEffect(() => { autoResize(titleRef.current); }, [title, autoResize]);
  useEffect(() => { autoResize(bodyRef.current); }, [body, autoResize]);

  const handleSubmit = async () => {
    setError(null);
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle) {
      setError('Write your question first.');
      return;
    }
    if (trimmedTitle.length < 5) {
      setError('Too short — add a bit more detail to your question.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createQuestion({
        title: trimmedTitle,
        body: trimmedBody || undefined,
        tags: [],
      });
      // Reset form
      setTitle('');
      setBody('');
      setShowBody(false);
      setError(null);
      setIsSubmitting(false);

      if (onPosted) {
        onPosted();
      } else {
        const questionId = res.data.question.id;
        router.push(`/questions/${questionId}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to post question';
      setError(message);
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const avatarInitial = (user?.display_name || user?.username || '?').charAt(0).toUpperCase();
  const canPost = title.trim().length >= 5;

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="flex gap-3 px-5 pt-4 pb-2" onKeyDown={handleKeyDown}>
        {/* Avatar */}
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.display_name || user.username}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-light flex items-center justify-center text-indigo text-sm font-bold flex-shrink-0 mt-0.5">
            {avatarInitial}
          </div>
        )}

        {/* Input area */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to ask?"
            maxLength={300}
            rows={1}
            className="w-full bg-transparent text-ink text-lg placeholder:text-faint resize-none focus:outline-none overflow-hidden font-[family-name:var(--font-lora)]"
          />

          {showBody && (
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add details..."
              rows={2}
              className="w-full bg-transparent text-body text-sm placeholder:text-faint resize-none focus:outline-none mt-1 max-h-[200px] overflow-y-auto"
            />
          )}

          {error && (
            <p className="text-rose text-sm mt-1">{error}</p>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-5 pb-3 pl-[72px]">
        <div className="flex items-center gap-2">
          {!showBody && (
            <button
              type="button"
              onClick={() => {
                setShowBody(true);
                setTimeout(() => bodyRef.current?.focus(), 0);
              }}
              className="text-xs text-indigo hover:text-indigo-hover transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-indigo-light"
            >
              + Details
            </button>
          )}
          <span className="text-[11px] text-faint">AI auto-tag</span>
          {title.length > 0 && (
            <span className={`text-[11px] font-[family-name:var(--font-fira-code)] ${title.length > 280 ? 'text-rose' : 'text-faint'}`}>
              {title.length}/300
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !canPost}
          className="px-5 py-1.5 text-sm font-medium bg-indigo hover:bg-indigo-hover text-white rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSubmitting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  );
}

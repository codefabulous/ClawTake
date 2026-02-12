'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function AskPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }
    if (trimmedTitle.length < 10) {
      setError('Title must be at least 10 characters.');
      return;
    }
    if (!trimmedBody) {
      setError('Body is required.');
      return;
    }
    if (trimmedBody.length < 20) {
      setError('Body must be at least 20 characters.');
      return;
    }

    // Parse tags: comma-separated, max 3
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    if (tags.length > 3) {
      setError('Maximum 3 tags allowed.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createQuestion({
        title: trimmedTitle,
        body: trimmedBody,
        tags,
      });
      const questionId = res.data.question.id;
      router.push(`/questions/${questionId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create question';
      setError(message);
      setIsSubmitting(false);
    }
  };

  // Don't render the form until we know auth state
  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto px-4 py-10">
      <h1 className="font-[family-name:var(--font-lora)] text-2xl font-semibold text-ink mb-6">
        Ask a Question
      </h1>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-body mb-1.5">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is your question? Be specific."
              className="w-full bg-white border border-border rounded-lg px-4 py-2.5 text-ink placeholder:text-faint text-sm focus:outline-none focus:border-indigo focus:ring-1 focus:ring-indigo/30 transition-colors"
              maxLength={200}
            />
            <p className="text-xs text-caption mt-1.5">
              <span className={`font-[family-name:var(--font-fira-code)] ${title.length > 180 ? 'text-rose' : ''}`}>
                {title.length}/200
              </span>{' '}
              characters
            </p>
          </div>

          {/* Body */}
          <div>
            <label htmlFor="body" className="block text-sm font-medium text-body mb-1.5">
              Details
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Include all the information someone would need to answer your question. What have you tried? What did you expect?"
              rows={10}
              className="w-full bg-white border border-border rounded-lg px-4 py-2.5 text-ink placeholder:text-faint text-sm resize-y min-h-[160px] focus:outline-none focus:border-indigo focus:ring-1 focus:ring-indigo/30 transition-colors"
            />
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-body mb-1.5">
              Tags
            </label>
            <input
              id="tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. python, machine-learning, api"
              className="w-full bg-white border border-border rounded-lg px-4 py-2.5 text-ink placeholder:text-faint text-sm focus:outline-none focus:border-indigo focus:ring-1 focus:ring-indigo/30 transition-colors"
            />
            <p className="text-xs text-caption mt-1.5">
              Separate tags with commas. Maximum 3 tags.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-rose-light border border-rose/20 rounded-lg px-4 py-3">
              <p className="text-rose text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-medium bg-indigo hover:bg-indigo-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? 'Posting...' : 'Post Question'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2.5 text-sm text-caption hover:text-body transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

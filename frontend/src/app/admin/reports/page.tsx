'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { timeAgo } from '@/lib/utils';
import type { Report } from '@/types';

export default function AdminReportsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loadFromStorage } = useAuthStore();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [banChecked, setBanChecked] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (isAuthenticated && user && !user.is_admin) {
      router.push('/');
    }
  }, [isAuthenticated, user, router]);

  const { data, error, isLoading, mutate } = useSWR(
    isAuthenticated && user?.is_admin ? 'admin-reports' : null,
    () => api.getAdminReports().then((res) => res.data)
  );

  const reports: Report[] = data?.reports ?? [];

  const handleReview = async (reportId: string, action: 'approve' | 'dismiss') => {
    setActionLoading(reportId);
    setActionError(null);

    try {
      await api.reviewReport(reportId, {
        action,
        ban_target: action === 'approve' ? banChecked[reportId] ?? false : undefined,
      });
      mutate();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  };

  // Guard: not authenticated or not admin
  if (!isAuthenticated || !user?.is_admin) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const targetTypeColors: Record<string, string> = {
    question: 'bg-indigo-light text-indigo',
    answer: 'bg-teal-light text-teal',
    comment: 'bg-amber-light text-amber-warm',
  };

  const reasonColors: Record<string, string> = {
    spam: 'bg-rose-light text-rose',
    offensive: 'bg-rose-light text-rose',
    misleading: 'bg-amber-light text-amber-warm',
    'off-topic': 'bg-violet-light text-violet',
    other: 'bg-warm text-caption',
  };

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-lora)] text-2xl font-semibold text-ink mb-1">
          Moderation Reports
        </h1>
        <p className="text-sm text-caption">
          Review and take action on reported content.
        </p>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="mb-6 px-4 py-3 bg-rose-light text-rose text-sm rounded-lg flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-rose hover:text-rose/80 cursor-pointer ml-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <p className="text-error text-sm">Failed to load reports.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && reports.length === 0 && (
        <div className="text-center py-16 bg-card border border-border rounded-xl shadow-sm">
          <div className="w-12 h-12 rounded-full bg-teal-light flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-teal">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-caption text-sm">No pending reports. All clear!</p>
        </div>
      )}

      {/* Reports list */}
      {!isLoading && !error && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-card border border-border rounded-xl shadow-sm p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* Report details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                        targetTypeColors[report.target_type] || 'bg-warm text-caption'
                      }`}
                    >
                      {report.target_type}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                        reasonColors[report.reason] || 'bg-warm text-caption'
                      }`}
                    >
                      {report.reason}
                    </span>
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                      report.status === 'pending'
                        ? 'bg-amber-light text-amber-warm'
                        : report.status === 'reviewed'
                          ? 'bg-teal-light text-teal'
                          : 'bg-warm text-caption'
                    }`}>
                      {report.status}
                    </span>
                  </div>

                  {report.description && (
                    <p className="text-sm text-ink leading-relaxed mb-2">
                      {report.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-caption">
                    <span>
                      Reported by{' '}
                      <span className="text-body font-medium">
                        {report.reporter_display_name || report.reporter_username}
                      </span>
                    </span>
                    <span className="text-faint">{timeAgo(report.created_at)}</span>
                    <span className="font-[family-name:var(--font-fira-code)] text-faint">
                      ID: {report.target_id.slice(0, 8)}...
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {report.status === 'pending' && (
                  <div className="flex flex-col items-end gap-2.5 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReview(report.id, 'dismiss')}
                        disabled={actionLoading === report.id}
                        className="px-3.5 py-1.5 text-xs font-medium text-caption hover:text-body border border-border hover:border-faint rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                      >
                        {actionLoading === report.id ? '...' : 'Dismiss'}
                      </button>
                      <button
                        onClick={() => handleReview(report.id, 'approve')}
                        disabled={actionLoading === report.id}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-indigo hover:bg-indigo-hover text-white rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                      >
                        {actionLoading === report.id ? '...' : 'Approve'}
                      </button>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={banChecked[report.id] ?? false}
                        onChange={(e) =>
                          setBanChecked((prev) => ({
                            ...prev,
                            [report.id]: e.target.checked,
                          }))
                        }
                        className="w-3.5 h-3.5 rounded border-border text-indigo focus:ring-indigo-light cursor-pointer"
                      />
                      <span className="text-xs text-caption">Ban author</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api';

interface ReportModalProps {
  targetType: 'question' | 'answer' | 'comment';
  targetId: string;
  isOpen: boolean;
  onClose: () => void;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'offensive', label: 'Offensive' },
  { value: 'misleading', label: 'Misleading' },
  { value: 'off-topic', label: 'Off-topic' },
  { value: 'other', label: 'Other' },
];

export function ReportModal({ targetType, targetId, isOpen, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setDescription('');
      setError(null);
      setSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Auto-close after success
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [success, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await api.createReport({
        target_type: targetType,
        target_id: targetId,
        reason,
        description: description.trim() || undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to submit report. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative bg-card border border-border rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-teal-light flex items-center justify-center mx-auto mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-6 h-6 text-teal"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-lora)] text-lg font-semibold text-ink">
              Report Submitted
            </h3>
            <p className="text-sm text-caption mt-1">
              Thank you. We will review this content shortly.
            </p>
          </div>
        ) : (
          <>
            <h3 className="font-[family-name:var(--font-lora)] text-lg font-semibold text-ink mb-1">
              Report {targetType}
            </h3>
            <p className="text-sm text-caption mb-5">
              Help us keep the community safe by reporting inappropriate content.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Reason dropdown */}
              <label className="block text-sm font-medium text-body mb-1.5">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-indigo-light focus:border-indigo transition-colors mb-4 cursor-pointer"
                required
              >
                <option value="" disabled>
                  Select a reason...
                </option>
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              {/* Description textarea */}
              <label className="block text-sm font-medium text-body mb-1.5">
                Description{' '}
                <span className="text-faint font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide additional details..."
                maxLength={500}
                rows={3}
                className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-indigo-light focus:border-indigo transition-colors resize-none mb-1"
              />
              <p className="text-xs text-faint text-right mb-4">
                {description.length}/500
              </p>

              {/* Error message */}
              {error && (
                <div className="mb-4 px-3 py-2.5 bg-rose-light text-rose text-sm rounded-lg">
                  {error}
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-caption hover:text-body border border-border hover:border-faint rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!reason || isSubmitting}
                  className="px-4 py-2 text-sm font-semibold bg-indigo hover:bg-indigo-hover text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    'Submit Report'
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

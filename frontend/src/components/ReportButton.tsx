'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { ReportModal } from './ReportModal';

interface ReportButtonProps {
  targetType: 'question' | 'answer' | 'comment';
  targetId: string;
}

export function ReportButton({ targetType, targetId }: ReportButtonProps) {
  const { isAuthenticated } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="text-faint hover:text-rose transition-colors cursor-pointer p-1 rounded"
        title="Report"
        aria-label={`Report this ${targetType}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M3.5 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0v-4.392l1.657-.348a6.449 6.449 0 014.271.572 7.948 7.948 0 005.965.524l2.078-.64A.75.75 0 0018 12.25v-8.5a.75.75 0 00-.904-.734l-2.38.501a7.25 7.25 0 01-4.186-.363l-.502-.2a8.75 8.75 0 00-5.053-.439l-1.475.31V2.75z" />
        </svg>
      </button>

      <ReportModal
        targetType={targetType}
        targetId={targetId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

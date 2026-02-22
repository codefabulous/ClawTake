'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function Header() {
  const { user, isAuthenticated, logout, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/88 backdrop-blur-sm border-b border-border-light">
      <div className="max-w-[1080px] mx-auto px-8 h-[58px] flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-[26px] h-[26px] bg-indigo rounded-[7px] flex items-center justify-center text-white font-[family-name:var(--font-lora)] text-[15px] font-bold italic">
              C
            </div>
            <span className="font-[family-name:var(--font-lora)] text-xl font-semibold text-ink tracking-tight">
              ClawTake
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-0.5">
            <Link
              href="/"
              className="text-[13px] font-medium text-caption hover:text-body hover:bg-border-light px-3.5 py-1.5 rounded-lg transition-colors"
            >
              Questions
            </Link>
            <Link
              href="/leaderboard"
              className="text-[13px] font-medium text-caption hover:text-body hover:bg-border-light px-3.5 py-1.5 rounded-lg transition-colors"
            >
              Leaderboard
            </Link>
            <Link
              href="/tags"
              className="text-[13px] font-medium text-caption hover:text-body hover:bg-border-light px-3.5 py-1.5 rounded-lg transition-colors"
            >
              Tags
            </Link>
            {user?.is_admin && (
              <Link
                href="/admin/reports"
                className="text-[13px] font-medium text-caption hover:text-body hover:bg-border-light px-3.5 py-1.5 rounded-lg transition-colors"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          {isAuthenticated && user ? (
            <>
              <span className="text-[13px] font-medium text-body">
                {user.display_name || user.username}
              </span>
              <button
                onClick={logout}
                className="text-[13px] font-medium text-caption hover:text-body hover:bg-border-light px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[13px] font-medium text-caption border border-border hover:border-faint hover:text-body px-4 py-1.5 rounded-lg transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="text-[13px] font-semibold px-4 py-[9px] bg-indigo hover:bg-indigo-hover text-white rounded-lg transition-colors"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

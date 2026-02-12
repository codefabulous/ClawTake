'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await register({
        email,
        username,
        display_name: displayName,
        password,
      });
      router.push('/');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-page">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
          <h1 className="font-[family-name:var(--font-lora)] text-2xl font-semibold text-ink mb-2">
            Create an account
          </h1>
          <p className="text-sm text-caption mb-8">
            Join ClawTake and start asking questions
          </p>

          {error && (
            <div className="mb-6 p-3 bg-rose-light border border-rose/20 rounded-lg text-sm text-rose">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm text-body mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-ink placeholder-faint focus:outline-none focus:border-indigo focus:ring-1 focus:ring-indigo/30 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm text-body mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-ink placeholder-faint focus:outline-none focus:border-indigo focus:ring-1 focus:ring-indigo/30 transition-colors"
                placeholder="johndoe"
              />
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm text-body mb-1.5">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-ink placeholder-faint focus:outline-none focus:border-indigo focus:ring-1 focus:ring-indigo/30 transition-colors"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-body mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-ink placeholder-faint focus:outline-none focus:border-indigo focus:ring-1 focus:ring-indigo/30 transition-colors"
                placeholder="At least 8 characters"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo hover:bg-indigo-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-caption">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo hover:text-indigo-hover font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { login, googleLogin, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      router.push('/');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-page">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
          <h1 className="font-[family-name:var(--font-lora)] text-2xl font-semibold text-ink mb-2">
            Sign in
          </h1>
          <p className="text-sm text-caption mb-8">
            Welcome back to ClawTake
          </p>

          <div className="flex justify-center mb-6">
            <GoogleLogin
              onSuccess={async (response) => {
                if (response.credential) {
                  try {
                    await googleLogin(response.credential);
                    router.push('/');
                  } catch (err: unknown) {
                    if (err instanceof Error) {
                      setError(err.message);
                    } else {
                      setError('Google login failed. Please try again.');
                    }
                  }
                }
              }}
              onError={() => setError('Google login failed. Please try again.')}
              width={360}
            />
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 text-caption">or sign in with email</span>
            </div>
          </div>

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
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo hover:bg-indigo-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-caption">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-indigo hover:text-indigo-hover font-medium transition-colors">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

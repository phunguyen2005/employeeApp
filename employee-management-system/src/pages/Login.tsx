import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from '@tanstack/react-router';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Shield,
} from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useAppContext } from '../context/AppContext';

const SAVED_EMAIL_KEY = 'ems.saved-email';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getEmailError = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) return 'Enter your work email address.';
  if (!emailPattern.test(trimmedValue)) return 'Use a valid email format, like name@company.com.';

  return '';
};

const getPasswordError = (value: string) => {
  if (!value) return 'Enter your password.';
  return '';
};

export const Login: React.FC = () => {
  const { currentUser, setCurrentUser } = useAppContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const loginMutation = trpc.auth.login.useMutation();
  const { data: sessionUser, isLoading: isCheckingSession } = trpc.auth.session.useQuery(undefined, {
    retry: false,
  });

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(SAVED_EMAIL_KEY);

    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  const trimmedEmail = email.trim();
  const emailError = hasSubmitted ? getEmailError(email) : '';
  const passwordError = hasSubmitted ? getPasswordError(password) : '';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    setErrorMsg('');

    const nextEmailError = getEmailError(email);
    const nextPasswordError = getPasswordError(password);

    if (nextEmailError || nextPasswordError) return;

    if (rememberEmail) {
      window.localStorage.setItem(SAVED_EMAIL_KEY, trimmedEmail);
    } else {
      window.localStorage.removeItem(SAVED_EMAIL_KEY);
    }

    loginMutation.mutate(
      { email: trimmedEmail, password },
      {
        onSuccess: ({ user }) => {
          setCurrentUser(user as any);
          navigate({ to: '/', replace: true });
        },
        onError: () => {
          setErrorMsg('Invalid email or password. Please try again.');
        },
      }
    );
  };

  const handleCapsLockState = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setIsCapsLockOn(event.getModifierState('CapsLock'));
  };

  if (currentUser || sessionUser) {
    return <Navigate to="/" replace />;
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          Checking your session...
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.28),_transparent_34%),radial-gradient(circle_at_85%_15%,_rgba(59,130,246,0.22),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#111827_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
      <div className="absolute left-[-10%] top-24 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="absolute bottom-0 right-[-8%] h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 backdrop-blur">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-200">
                  <Shield className="h-5 w-5" />
                </span>
                Secure workforce access
              </div>

              <h1 className="mt-8 text-5xl font-semibold tracking-tight text-white">
                Employee management with a calmer, clearer sign-in flow.
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-8 text-slate-300">
                Sign in to review employee records, navigate role-based access, and continue your work
                without friction.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <p className="text-sm font-medium text-slate-200">Role-aware access</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Access the dashboard, profiles, and audit views with clear permission boundaries.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <p className="text-sm font-medium text-slate-200">Secure session flow</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Keep authentication simple while surfacing helpful client-side guidance during sign in.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-[2rem] border border-white/10 bg-white/95 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur xl:p-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-950/30">
                <Shield className="h-8 w-8" />
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-700">EMS Portal</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Use your company credentials to access employee tools and protected records.
                </p>
              </div>

              <form className="mt-8 space-y-5" onSubmit={handleLogin} noValidate>
                {errorMsg && (
                  <div
                    className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    role="alert"
                    aria-live="polite"
                  >
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                    Email address
                  </label>
                  <div
                    className={`flex items-center rounded-2xl border bg-slate-50 px-4 transition-all ${
                      emailError
                        ? 'border-red-300 ring-4 ring-red-100'
                        : 'border-slate-200 focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-100'
                    }`}
                  >
                    <Mail className="h-5 w-5 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorMsg('');
                      }}
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? 'email-error' : 'email-help'}
                      className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="name@company.com"
                    />
                  </div>
                  <p id={emailError ? 'email-error' : 'email-help'} className={`mt-2 text-sm ${emailError ? 'text-red-600' : 'text-slate-500'}`}>
                    {emailError || 'Use the same email address you use for your employee account.'}
                  </p>
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div
                    className={`flex items-center rounded-2xl border bg-slate-50 px-4 transition-all ${
                      passwordError
                        ? 'border-red-300 ring-4 ring-red-100'
                        : 'border-slate-200 focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-100'
                    }`}
                  >
                    <Lock className="h-5 w-5 text-slate-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMsg('');
                      }}
                      onKeyDown={handleCapsLockState}
                      onKeyUp={handleCapsLockState}
                      aria-invalid={!!passwordError}
                      aria-describedby={passwordError || isCapsLockOn ? 'password-status' : undefined}
                      className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="rounded-full p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <div id="password-status" className="mt-2 min-h-5 text-sm">
                    {passwordError && <p className="text-red-600">{passwordError}</p>}
                    {!passwordError && isCapsLockOn && <p className="text-amber-600">Caps Lock is on.</p>}
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(e) => setRememberEmail(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    Remember email on this device
                  </label>
                  <div className="flex items-center gap-2 text-slate-500">
                    <CheckCircle2 className="h-4 w-4 text-cyan-600" />
                    Client-side validation enabled
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {loginMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loginMutation.isPending ? 'Signing in...' : 'Sign in securely'}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

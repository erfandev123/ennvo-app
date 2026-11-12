import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle, 
  Loader2, 
  ArrowLeft,
  Mail,
  User as UserIcon,
  Sparkles
} from 'lucide-react';
import { useAppStore } from '../store';
import { 
  signUp, 
  signIn, 
  signInWithGoogle, 
  signInWithFacebook,
  completeGoogleSignUp,
  sendPasswordReset, 
  checkRedirectResult 
} from '../services/authService';
import { DEFAULT_MALE_AVATAR } from '../utils/defaultAvatars';
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal';
import { applyRouteSEO } from '../services/seoService';
import { useShallow } from 'zustand/react/shallow';

// Official Multicolor Google Icon
const GoogleIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

// Official Facebook Icon
const FacebookIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

// Official Twitter / X Icon
const TwitterIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

// LinkedIn Icon
const LinkedInIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#0A66C2">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

type AuthScreen = 'signin' | 'signup' | 'landing' | 'forgot' | 'google-setup';

export default function Auth() {
  // Determine initial screen from window location path
  const [screen, setScreen] = useState<AuthScreen>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (p.includes('signup') || p.includes('singup') || p.includes('register')) return 'landing';
      if (p.includes('forgot')) return 'forgot';
    }
    return 'signin';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);

  // Reset password state
  const [resetSent, setResetSent] = useState(false);

  // Google setup state for new users
  const [googleUserData, setGoogleUserData] = useState<{
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string | null;
  } | null>(null);
  const [googleUsername, setGoogleUsername] = useState('');

  // Privacy Policy modal
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const { setCurrentUser, setNewUserWelcomeName } = useAppStore(useShallow((s: any) => ({ setCurrentUser: s.setCurrentUser, setNewUserWelcomeName: s.setNewUserWelcomeName })));

  // Helper to switch screens and sync browser URL cleanly
  const navigateAuth = (nextScreen: AuthScreen) => {
    setScreen(nextScreen);
    setError(null);
    setSuccessMsg(null);
    if (typeof window !== 'undefined') {
      const targetPath = (nextScreen === 'signup' || nextScreen === 'landing') 
        ? '/signup' 
        : nextScreen === 'forgot' 
          ? '/forgot' 
          : '/signin';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ auth: nextScreen }, '', targetPath);
      }
    }
  };

  // Listen to deep links or navigation popstate
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.toLowerCase();
      if (p.includes('signup') || p.includes('singup')) {
        setScreen('landing');
      } else if (p.includes('forgot')) {
        setScreen('forgot');
      } else {
        setScreen('signin');
      }
    };

    const handleAuthNavEvent = (e: any) => {
      const target = e.detail?.screen;
      if (target === 'signup' || target === 'landing') setScreen('landing');
      else setScreen('signin');
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('ennvoAuthNavigate', handleAuthNavEvent);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('ennvoAuthNavigate', handleAuthNavEvent);
    };
  }, []);

  // Check external redirect login if returning from OAuth
  useEffect(() => {
    checkRedirectResult()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
        }
      })
      .catch(() => {});
  }, [setCurrentUser]);

  // Synchronize SEO metadata
  useEffect(() => {
    applyRouteSEO('auth', { authScreen: screen === 'signup' || screen === 'landing' ? 'signup' : 'welcome' });
  }, [screen]);

  // Ultra-Fast Email & Password Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const identifier = email.trim();
    const pass = password;

    if (!identifier) {
      setError('Please enter your email or username');
      return;
    }
    if (!pass) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      const user = await signIn(identifier, pass);
      if (user) {
        if (rememberMe) {
          try { localStorage.setItem('ennvo_remember_login', identifier); } catch (err) {}
        }
        setCurrentUser(user);
      }
    } catch (err: any) {
      setError(err?.message || 'Incorrect email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Dedicated Create Account Flow
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanIdentifier = email.trim();
    const pass = password;

    if (!cleanName) {
      setError('Please enter your username');
      return;
    }
    if (!cleanIdentifier) {
      setError('Please enter your email address');
      return;
    }
    if (!pass || pass.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!agreeTerms) {
      setError('Please accept the policy and terms to proceed');
      return;
    }

    const baseUsername = (cleanIdentifier.includes('@') ? cleanIdentifier.split('@')[0] : cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 18);
    const generatedUsername = baseUsername.length >= 3 ? baseUsername : `user_${Date.now().toString().slice(-5)}`;

    setIsLoading(true);
    try {
      const user = await signUp(
        cleanIdentifier,
        pass,
        cleanName,
        generatedUsername,
        cleanIdentifier,
        DEFAULT_MALE_AVATAR,
        'male',
        'Dhaka, Bangladesh',
        ''
      );

      if (user) {
        setNewUserWelcomeName(user.name);
        setCurrentUser(user);
      }
    } catch (err: any) {
      const msg = err?.message || 'Account creation failed. Please try again.';
      if (msg.includes('email-already-in-use')) {
        setError('This email is already registered. Please login below.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Google 1-Click Fast Sign In
  const handleGoogleAuth = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await signInWithGoogle({ allowNewUserOnboarding: true });
      if (!res) {
        setIsLoading(false);
        return;
      }

      if (!res.isNewUser && res.user) {
        setCurrentUser(res.user);
        return;
      }

      if (res.isNewUser && res.firebaseUser) {
        const fb = res.firebaseUser;
        const cleanEmail = fb.email || '';
        const rawPrefix = cleanEmail
          ? cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '')
          : `user_${fb.uid.slice(0, 5)}`;

        setGoogleUserData({
          uid: fb.uid,
          email: cleanEmail,
          displayName: fb.displayName || '',
          photoURL: fb.photoURL || null
        });
        setGoogleUsername(rawPrefix);
        setScreen('google-setup');
      }
    } catch (err: any) {
      if (err?.message?.includes('disallowed_useragent') || err?.message?.includes('operation-not-supported')) {
        setError('Google requires standard web browser. Please sign in with your email & password.');
      } else {
        setError(err?.message || 'Google sign-in was cancelled or encountered an issue.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Facebook Auth Flow
  const handleFacebookAuth = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const user = await signInWithFacebook();
      if (user) {
        setCurrentUser(user);
      }
    } catch (err: any) {
      setError(err?.message || 'Facebook login is temporarily unavailable. Please use Google or Email.');
    } finally {
      setIsLoading(false);
    }
  };

  // Complete Google Sign Up for new Google users
  const handleCompleteGoogleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUserData) return;
    setError(null);

    const uName = googleUsername.trim().toLowerCase();
    if (!uName || uName.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setIsLoading(true);
    try {
      const user = await completeGoogleSignUp({
        uid: googleUserData.uid,
        name: googleUserData.displayName || uName,
        username: uName,
        email: googleUserData.email,
        gender: 'male',
        avatar: googleUserData.photoURL || DEFAULT_MALE_AVATAR,
        location: 'Dhaka, Bangladesh'
      });

      if (user) {
        setNewUserWelcomeName(user.name);
        setCurrentUser(user);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to complete profile. Try another username.');
    } finally {
      setIsLoading(false);
    }
  };

  // Send Password Reset Email
  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Please enter your email or username');
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setResetSent(true);
      setSuccessMsg('A password reset link has been sent to your email.');
    } catch (err: any) {
      setError(err?.message || 'Could not send reset link. Please check your email.');
    } finally {
      setIsLoading(false);
    }
  };

  // Perfect Smooth Organic Header Wave for Mobile (Matching Reference Image)
  const HeaderWave = ({ subtitle, title }: { subtitle: string; title: string }) => (
    <div className="relative w-full overflow-hidden select-none bg-white">
      {/* Background SVG wave rendered with seamless royal blue gradient */}
      <svg 
        viewBox="0 0 375 185" 
        preserveAspectRatio="none" 
        className="w-full h-40 sm:h-44 block"
      >
        <defs>
          <linearGradient id="royalBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="60%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#1E40AF" />
          </linearGradient>
        </defs>
        <path 
          d="M 0,0 L 375,0 L 375,70 C 355,115 305,180 230,180 C 150,180 80,140 0,150 Z" 
          fill="url(#royalBlueGrad)" 
        />
      </svg>
      {/* Header Text cleanly overlayed inside the blue area */}
      <div className="absolute top-0 left-0 right-0 pt-8 sm:pt-9 px-6 sm:px-7 z-10 pointer-events-none flex items-start justify-between gap-4">
        <div>
          <p className="text-white/90 text-[13px] font-medium tracking-wide">{subtitle}</p>
          <h1 className="text-white text-3xl font-extrabold tracking-tight mt-0.5">{title}</h1>
        </div>
        <img
          src="/icon-192.png?v=5"
          alt="Ennvo logo"
          className="w-11 h-11 rounded-full object-cover ring-2 ring-white/70 shadow-[0_8px_24px_rgba(0,0,0,0.28)] mt-0.5 shrink-0"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] w-full bg-white text-slate-900 font-sans flex flex-col md:flex-row relative overflow-x-hidden">
      
      {/* ===================================================================== */}
      {/* PC / DESKTOP LEFT SHOWCASE PANEL (Reference Image: 360_F_480130925)    */}
      {/* ===================================================================== */}
      <div className="hidden md:flex md:w-5/12 lg:w-1/2 bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#3B82F6] text-white p-12 lg:p-16 flex-col justify-between relative overflow-hidden shrink-0 select-none">
        
        {/* Subtle Ambient Backdrops */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-sky-300/20 blur-3xl pointer-events-none" />

        {/* Decorative Cloud/Liquid Right Wave Divider for Desktop */}
        <div className="absolute top-0 bottom-0 right-0 w-20 pointer-events-none hidden lg:block overflow-hidden">
          <svg viewBox="0 0 100 1000" preserveAspectRatio="none" className="w-full h-full text-white fill-current">
            <path d="M100,0 L0,0 C60,180 80,320 40,500 C0,680 70,820 10,1000 L100,1000 Z" />
          </svg>
        </div>

        {/* Center Presentation Emblem & Slogan */}
        <div className="relative z-10 my-auto py-8">
          <p className="text-white/80 text-xl font-light tracking-wide mb-3">Welcome to</p>
          <div className="w-24 h-24 rounded-full bg-white shadow-[0_20px_50px_rgba(0,0,0,0.25)] overflow-hidden flex items-center justify-center mb-5 border border-white/20">
            <img src="/icon-192.png?v=5" alt="Ennvo Logo" className="w-full h-full object-cover rounded-full" />
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3">Ennvo</h2>
          <p className="text-white/80 text-sm max-w-sm leading-relaxed">
            Connect, share moments, and explore short videos with people around the world.
          </p>
        </div>

        {/* Bottom Status / Tagline */}
        <div className="relative z-10 flex items-center space-x-4 text-xs text-white/60 font-medium">
          <span>CONNECT</span>
          <span>•</span>
          <span>CREATE</span>
          <span>•</span>
          <span>EXPLORE</span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MAIN AUTH SECTION (Mobile & PC Form)                                  */}
      {/* ===================================================================== */}
      <div className="flex-1 min-h-[100dvh] w-full bg-white flex flex-col justify-between relative overflow-y-auto">

        {/* ------------------------------------------------------------------- */}
        {/* SCREEN 1: LOG IN (Matching Reference Image: Left Phone Screen)       */}
        {/* ------------------------------------------------------------------- */}
        {screen === 'signin' && (
          <div className="w-full flex-1 flex flex-col justify-between">
            {/* Mobile Top Fluid Liquid Wave Header */}
            <div className="md:hidden">
              <HeaderWave subtitle="Welcome Back," title="Log In!" />
            </div>

            {/* PC Top Title Header */}
            <div className="hidden md:block pt-14 pb-4 px-10 lg:px-20">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Log In to Ennvo</h2>
              <p className="text-slate-500 text-sm mt-1">Welcome back! Please enter your details.</p>
            </div>

            {/* Form Container */}
            <div className="w-full max-w-md mx-auto px-6 md:px-10 lg:px-20 py-4 flex-1 flex flex-col justify-center">
              
              {/* Error / Success Notifications */}
              {error && (
                <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="flex-1 font-medium">{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="flex-1 font-medium">{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email Address Pill Input */}
                <div>
                  <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block pl-3 mb-1">
                    EMAIL ADDRESS
                  </label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Jacob@gmail.com"
                    autoComplete="username"
                    required
                    className="w-full rounded-full border border-slate-300 bg-white px-5 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                  />
                </div>

                {/* Password Pill Input */}
                <div>
                  <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block pl-3 mb-1">
                    PASSWORD
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className="w-full rounded-full border border-slate-300 bg-white px-5 py-3.5 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password Row */}
                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => navigateAuth('forgot')}
                    className="text-slate-500 hover:text-[#2563EB] transition-colors font-medium"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Primary Royal Blue Pill Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-[0_8px_20px_rgba(37,99,235,0.32)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Log in'}
                  </button>
                </div>

                {/* Social Login Options */}
                <div className="pt-2 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={isLoading}
                    className="w-full py-3 rounded-full border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <GoogleIcon className="w-4 h-4" />
                    <span>Continue with Google</span>
                  </button>
                </div>
              </form>

              {/* Bottom Switch Link */}
              <div className="text-center mt-6 text-xs text-slate-500">
                <span>Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => navigateAuth('landing')}
                  className="font-bold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Sign Up
                </button>
              </div>

              {/* Public SEO / brand page link */}
              <div className="text-center mt-3 text-[11px] font-medium text-slate-500">
                <a href="/landing" className="hover:text-slate-600 hover:underline">Landing</a>
                <span aria-hidden="true"> · </span>
                <a href="/about" className="hover:text-slate-600 hover:underline">About Ennvo &amp; team</a>
                <span aria-hidden="true"> · </span>
                <a href="/blog" className="hover:text-slate-600 hover:underline">Journal</a>
                <span aria-hidden="true"> · </span>
                <a href="/help" className="hover:text-slate-600 hover:underline">Help</a>
                <span aria-hidden="true"> · </span>
                <a href="/support" className="hover:text-slate-600 hover:underline">Support</a>
                <span aria-hidden="true"> · </span>
                <a href="/privacy" className="hover:text-slate-600 hover:underline">Privacy</a>
                <span aria-hidden="true"> · </span>
                <a href="/terms" className="hover:text-slate-600 hover:underline">Terms</a>
              </div>
            </div>

            {/* Bottom Safe Area Padding */}
            <div className="h-6 md:h-10" />
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* SCREEN 2: SIGN UP LANDING (Matching Middle Phone Screen in Image)     */}
        {/* ------------------------------------------------------------------- */}
        {screen === 'landing' && (
          <div className="w-full flex-1 flex flex-col justify-between py-10 px-6 md:px-12 lg:px-20 max-w-md mx-auto">
            {/* Top Logo Emblem */}
            <div className="flex flex-col items-center justify-center pt-4 md:pt-8 select-none">
              <div className="w-24 h-24 rounded-full bg-white shadow-[0_12px_30px_rgba(37,99,235,0.22)] border border-slate-100 flex items-center justify-center overflow-hidden p-0">
                <img src="/icon-192.png?v=5" alt="Ennvo Emblem" className="w-full h-full object-cover rounded-full" />
              </div>
              <h2 className="text-base font-extrabold tracking-widest text-[#2563EB] uppercase mt-3">ENNVO</h2>
            </div>

            {/* Center Content */}
            <div className="my-auto py-6 text-center">
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Sign Up</h1>
              <p className="text-slate-500 text-xs md:text-sm mt-1 mb-8">it's easier to sign up now</p>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="flex-1 font-medium">{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 max-w-sm mx-auto">
                {/* Facebook Pill Button */}
                <button
                  type="button"
                  onClick={handleFacebookAuth}
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 rounded-full bg-[#166FE5] hover:bg-[#125FCB] text-white font-medium text-xs md:text-sm shadow-[0_6px_18px_rgba(24,119,242,0.28)] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <FacebookIcon className="w-4 h-4 fill-white" />
                  <span>Continue with Facebook</span>
                </button>

                {/* Google Pill Button */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 rounded-full border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs md:text-sm shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <GoogleIcon className="w-4 h-4" />
                  <span>Continue with Google</span>
                </button>

                {/* Email / Username Sign Up Pill */}
                <button
                  type="button"
                  onClick={() => navigateAuth('signup')}
                  className="w-full py-3.5 px-6 rounded-full border border-slate-300 hover:border-[#2563EB] hover:text-[#2563EB] text-slate-600 font-medium text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>I'll use email or username</span>
                </button>
              </div>

              {/* Circular Social Icons Row */}
              <div className="flex items-center justify-center gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={handleGoogleAuth}
                  className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-xs text-slate-600 transition-all"
                  title="Google"
                >
                  <GoogleIcon className="w-4 h-4" />
                </button>
                <button 
                  type="button" 
                  onClick={handleFacebookAuth}
                  className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-xs text-[#1877F2] transition-all"
                  title="Facebook"
                >
                  <FacebookIcon className="w-4 h-4" />
                </button>
                <div 
                  className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center shadow-xs text-slate-700 opacity-60"
                  title="Twitter"
                >
                  <TwitterIcon className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Bottom Login Link */}
            <div className="text-center text-xs text-slate-500 pt-4">
              <span>Already have account? </span>
              <button
                type="button"
                onClick={() => navigateAuth('signin')}
                className="font-bold text-[#2563EB] hover:underline cursor-pointer"
              >
                Login
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* SCREEN 3: SIGN UP FORM (Matching Right Phone Screen in Image)         */}
        {/* ------------------------------------------------------------------- */}
        {screen === 'signup' && (
          <div className="w-full flex-1 flex flex-col justify-between">
            {/* Mobile Top Fluid Liquid Wave Header */}
            <div className="md:hidden">
              <HeaderWave subtitle="Hello," title="Sign Up!" />
            </div>

            {/* PC Top Title Header */}
            <div className="hidden md:block pt-12 pb-2 px-10 lg:px-20">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create your account</h2>
              <p className="text-slate-500 text-sm mt-1">Join the community on Ennvo today.</p>
            </div>

            {/* Form Container */}
            <div className="w-full max-w-md mx-auto px-6 md:px-10 lg:px-20 py-4 flex-1 flex flex-col justify-center">
              
              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="flex-1 font-medium">{error}</span>
                </div>
              )}

              <form onSubmit={handleSignUp} className="space-y-3.5">
                {/* User Name Pill Input */}
                <div>
                  <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block pl-3 mb-1">
                    USER NAME
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jacob josef"
                    autoComplete="name"
                    required
                    className="w-full rounded-full border border-slate-300 bg-white px-5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                  />
                </div>

                {/* Email Address Pill Input */}
                <div>
                  <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block pl-3 mb-1">
                    EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Jacob@gmail.com"
                    autoComplete="email"
                    required
                    className="w-full rounded-full border border-slate-300 bg-white px-5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                  />
                </div>

                {/* Password Pill Input */}
                <div>
                  <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block pl-3 mb-1">
                    PASSWORD
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      autoComplete="new-password"
                      required
                      className="w-full rounded-full border border-slate-300 bg-white px-5 py-3 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Accept Policy & Terms Checkbox */}
                <div className="pt-1 px-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <span>
                      I accept the{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowPrivacyModal(true);
                        }}
                        className="text-[#2563EB] font-medium hover:underline"
                      >
                        policy and terms
                      </button>
                    </span>
                  </label>
                </div>

                {/* Primary Royal Blue Sign Up Pill Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-[0_8px_20px_rgba(37,99,235,0.32)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Sign up'}
                  </button>
                </div>

                {/* Circular Social Icons */}
                <div className="flex items-center justify-center gap-3 pt-3">
                  <button 
                    type="button" 
                    onClick={handleGoogleAuth}
                    className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-xs text-slate-600 transition-all"
                    title="Google"
                  >
                    <GoogleIcon className="w-4 h-4" />
                  </button>
                  <button 
                    type="button" 
                    onClick={handleFacebookAuth}
                    className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-xs text-[#1877F2] transition-all"
                    title="Facebook"
                  >
                    <FacebookIcon className="w-4 h-4" />
                  </button>
                  <div 
                    className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center shadow-xs text-slate-700 opacity-60"
                    title="Twitter"
                  >
                    <TwitterIcon className="w-4 h-4" />
                  </div>
                </div>
              </form>

              {/* Bottom Login Link */}
              <div className="text-center mt-6 text-xs text-slate-500">
                <span>Already have account? </span>
                <button
                  type="button"
                  onClick={() => navigateAuth('signin')}
                  className="font-bold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Login
                </button>
              </div>
            </div>

            {/* Bottom Safe Area Padding */}
            <div className="h-6 md:h-10" />
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* SCREEN 4: FORGOT PASSWORD                                           */}
        {/* ------------------------------------------------------------------- */}
        {screen === 'forgot' && (
          <div className="w-full flex-1 flex flex-col justify-between">
            <div className="md:hidden">
              <HeaderWave subtitle="Account Help," title="Reset Pass!" />
            </div>

            <div className="hidden md:block pt-14 pb-4 px-10 lg:px-20">
              <button
                type="button"
                onClick={() => navigateAuth('signin')}
                className="text-slate-500 hover:text-slate-800 text-xs font-semibold flex items-center gap-1.5 mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Login</span>
              </button>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Reset your password</h2>
              <p className="text-slate-500 text-sm mt-1">We'll email you instructions to reset it.</p>
            </div>

            <div className="w-full max-w-md mx-auto px-6 md:px-10 lg:px-20 py-4 flex-1 flex flex-col justify-center">
              {error && (
                <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="flex-1 font-medium">{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="flex-1 font-medium">{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSendPasswordReset} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block pl-3 mb-1">
                    YOUR EMAIL
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Jacob@gmail.com"
                    autoComplete="email"
                    required
                    className="w-full rounded-full border border-slate-300 bg-white px-5 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-[0_8px_20px_rgba(37,99,235,0.32)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Send Reset Link'}
                  </button>
                </div>
              </form>

              <div className="text-center mt-6 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => navigateAuth('signin')}
                  className="font-bold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Return to login
                </button>
              </div>
            </div>

            <div className="h-6 md:h-10" />
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* SCREEN 5: GOOGLE ONBOARDING SETUP FOR NEW USERS                     */}
        {/* ------------------------------------------------------------------- */}
        {screen === 'google-setup' && googleUserData && (
          <div className="w-full flex-1 flex flex-col justify-between py-10 px-6 md:px-12 lg:px-20 max-w-md mx-auto">
            <div className="text-center pt-4">
              <div className="w-16 h-16 rounded-full mx-auto overflow-hidden border-2 border-[#2563EB] p-0.5 shadow-md">
                <img 
                  src={googleUserData.photoURL || DEFAULT_MALE_AVATAR} 
                  alt="avatar" 
                  className="w-full h-full rounded-full object-cover" 
                />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-3">Welcome to Ennvo!</h1>
              <p className="text-slate-500 text-xs mt-1">Choose your unique username to complete setup.</p>
            </div>

            <div className="my-auto py-6">
              {error && (
                <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="flex-1 font-medium">{error}</span>
                </div>
              )}

              <form onSubmit={handleCompleteGoogleSignUp} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block pl-3 mb-1">
                    CHOOSE USERNAME
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                    <input
                      type="text"
                      value={googleUsername}
                      onChange={(e) => setGoogleUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="username"
                      required
                      className="w-full rounded-full border border-slate-300 bg-white pl-8 pr-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-[0_8px_20px_rgba(37,99,235,0.32)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Enter Ennvo'}
                  </button>
                </div>
              </form>
            </div>

            <div className="h-4" />
          </div>
        )}

      </div>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <PrivacyPolicyModal onClose={() => setShowPrivacyModal(false)} />
      )}
    </div>
  );
}

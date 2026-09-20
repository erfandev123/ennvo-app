import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserIcon, Lock, Eye, EyeOff, Camera, ArrowLeft, CheckCircle2, Mail, X, MapPin, Sparkles, ArrowRight, Loader2, Compass, UserPlus, ShieldCheck, HeartHandshake, Zap, KeyRound } from 'lucide-react';
import { useAppStore } from '../store';
import { signUp, signIn, signInWithGoogle, isUsernameUnique, sendPasswordReset } from '../services/authService';
import { uploadMedia } from '../services/githubStorage';
import { compressAvatarImage } from '../services/mediaCompressor';
import { DEFAULT_MALE_AVATAR, DEFAULT_FEMALE_AVATAR } from '../utils/defaultAvatars';
import { User } from '../types';

export default function Auth() {
  // viewMode: 'login' | 'signup' | 'forgot'
  const [viewMode, setViewMode] = useState<'login' | 'signup' | 'forgot'>('login');
  // signupStep: 1 (Name/Username) -> 2 (Email/Password) -> 3 (Gender/Photo/Loc) -> 4 (Welcome)
  const [signupStep, setSignupStep] = useState<number>(1);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password state
  const [resetInput, setResetInput] = useState('');
  const [resetSuccessEmail, setResetSuccessEmail] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Form Data State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    mobileOrEmail: '',
    password: '',
    confirmPassword: '',
  });

  // Gender & Location
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [location, setLocation] = useState<string>('Dhaka, Bangladesh');
  const [isDetectingLoc, setIsDetectingLoc] = useState<boolean>(false);

  // Profile Photo Avatar State
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Username validation state
  const [isUsernameChecking, setIsUsernameChecking] = useState(false);
  const [isUsernameValid, setIsUsernameValid] = useState<boolean | null>(null);

  // Newly created user object for Welcome Screen
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  const { setCurrentUser } = useAppStore();

  // Live Username Uniqueness Check
  useEffect(() => {
    if (viewMode !== 'signup' || signupStep !== 1 || !formData.username.trim() || formData.username.length < 3) {
      setIsUsernameValid(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsUsernameChecking(true);
      try {
        const unique = await isUsernameUnique(formData.username.trim());
        setIsUsernameValid(unique);
      } catch (e) {
        setIsUsernameValid(null);
      } finally {
        setIsUsernameChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.username, viewMode, signupStep]);

  // Auto detect location when entering step 3
  useEffect(() => {
    if (viewMode === 'signup' && signupStep === 3 && location === 'Dhaka, Bangladesh') {
      detectLocation();
    }
  }, [signupStep, viewMode]);

  const detectLocation = async () => {
    setIsDetectingLoc(true);
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`);
              const data = await res.json();
              const city = data.city || data.locality || data.principalSubdivision || '';
              const country = data.countryName || '';
              const locStr = [city, country].filter(Boolean).join(', ');
              if (locStr) setLocation(locStr);
            } catch (e) {
              // fallback
            } finally {
              setIsDetectingLoc(false);
            }
          },
          () => {
            setIsDetectingLoc(false);
          },
          { timeout: 3500 }
        );
      } else {
        setIsDetectingLoc(false);
      }
    } catch (e) {
      setIsDetectingLoc(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleNextStep1 = () => {
    setError(null);
    if (!formData.name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!formData.username.trim() || formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (isUsernameValid === false) {
      setError('This username is already taken');
      return;
    }
    setSignupStep(2);
  };

  const handleNextStep2 = () => {
    setError(null);
    if (!formData.mobileOrEmail.trim() || !formData.mobileOrEmail.includes('@')) {
      setError('Please enter a valid Gmail address containing @ (e.g. erfan@gmail.com)');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSignupStep(3);
  };

  const handleCreateAccount = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let uploadedAvatarUrl: string | undefined = undefined;
      if (avatarFile) {
        try {
          const compressedAvatar = await compressAvatarImage(avatarFile);
          uploadedAvatarUrl = await uploadMedia(compressedAvatar, 'avatars');
        } catch (uploadErr) {
          console.warn('Avatar upload notice:', uploadErr);
          uploadedAvatarUrl = avatarPreview || undefined;
        }
      }

      const emailOrUsernameInput = formData.mobileOrEmail.includes('@') 
        ? formData.mobileOrEmail.trim() 
        : formData.username.trim();

      const finalAvatarUrl = uploadedAvatarUrl || avatarPreview || (gender === 'female' ? DEFAULT_FEMALE_AVATAR : DEFAULT_MALE_AVATAR);

      const user = await signUp(
        emailOrUsernameInput,
        formData.password,
        formData.name || formData.username,
        formData.username,
        formData.mobileOrEmail,
        finalAvatarUrl,
        gender,
        location
      );

      if (user) {
        setCreatedUser(user);
        setSignupStep(4);
      }
    } catch (err: any) {
      setError(err.message || 'Account creation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!formData.username.trim()) {
        throw new Error('Please enter your username or email');
      }
      if (!formData.password) {
        throw new Error('Please enter your password');
      }
      const user = await signIn(formData.username, formData.password);
      if (user) {
        setCurrentUser(user);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        setCreatedUser(user);
        if (viewMode === 'signup') {
          setSignupStep(4);
        } else {
          setCurrentUser(user);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Google sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterApp = () => {
    if (createdUser) {
      setCurrentUser(createdUser);
    }
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetInput.trim()) {
      setResetError('Please enter your email or username');
      return;
    }
    setIsResetting(true);
    setResetError(null);
    setResetSuccessEmail(null);
    try {
      const sentTo = await sendPasswordReset(resetInput.trim());
      setResetSuccessEmail(sentTo);
    } catch (err: any) {
      setResetError(err.message || 'Failed to send password reset email');
    } finally {
      setIsResetting(false);
    }
  };

  const startSignupFlow = () => {
    setViewMode('signup');
    setSignupStep(1);
    setError(null);
  };

  const backToLogin = () => {
    setViewMode('login');
    setSignupStep(1);
    setError(null);
    setResetError(null);
    setResetSuccessEmail(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#F0F2F5] flex items-center justify-center p-0 sm:p-6 md:p-10 font-sans text-gray-900 select-none">
      
      {/* Responsive Master Container: Single column on mobile, dual column on PC */}
      <div className="w-full min-h-screen sm:min-h-0 sm:max-w-md md:max-w-4xl bg-white sm:rounded-3xl shadow-2xl border border-gray-200/80 overflow-hidden grid grid-cols-1 md:grid-cols-12 my-auto">
        
        {/* ========================================================= */}
        {/* DESKTOP LEFT BRANDING PANEL (Hidden on mobile)            */}
        {/* ========================================================= */}
        <div className="hidden md:flex md:col-span-5 bg-gradient-to-br from-[#5633D8] via-indigo-700 to-purple-800 text-white p-10 flex-col justify-between relative overflow-hidden">
          
          {/* Subtle Ambient Graphic Orbs */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-white p-2 shadow-lg flex items-center justify-center">
                <img 
                  src="/Ennvo Symbol.png" 
                  alt="Ennvo" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/Ennvo.png";
                  }}
                />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">ennvo</span>
            </div>

            <div className="space-y-2 pt-4">
              <h2 className="text-3xl font-black leading-tight text-white tracking-tight">
                Connect with close friends around you.
              </h2>
              <p className="text-xs text-purple-100 font-medium leading-relaxed">
                Share reels, post feeds, chat seamlessly, and discover local profiles matching your city and interests.
              </p>
            </div>

            <div className="space-y-3 pt-6 border-t border-white/15 text-xs font-semibold text-purple-100">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-pink-300" />
                </div>
                <span>Location-matched suggested friends</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                </div>
                <span>Safe, private & verified accounts</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-amber-300" />
                </div>
                <span>Ultra fast high-res media storage</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/10 text-[11px] text-purple-200 font-semibold flex items-center justify-between">
            <span>Ennvo Platform © 2026</span>
            <span className="flex items-center space-x-1">
              <HeartHandshake className="w-3.5 h-3.5 text-pink-300" />
              <span>Made for everyone</span>
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT FORM CONTAINER (Mobile + PC Desktop Right View)    */}
        {/* ========================================================= */}
        <div className="col-span-1 md:col-span-7 p-6 sm:p-8 md:p-10 flex flex-col justify-between w-full h-full bg-white min-h-[580px]">
          
          {/* ======================================================= */}
          {/* VIEW 1: LOGIN FORM                                      */}
          {/* ======================================================= */}
          {viewMode === 'login' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col justify-between"
            >
              {/* Top Header Logo */}
              <div className="flex flex-col items-center pt-4 pb-4">
                <div className="w-16 h-16 mb-2 rounded-2xl bg-[#5633D8] flex items-center justify-center p-2.5 shadow-lg shadow-purple-500/20">
                  <img 
                    src="/Ennvo Symbol.png" 
                    alt="Ennvo" 
                    className="w-full h-full object-contain filter brightness-0 invert"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/Ennvo.png";
                    }}
                  />
                </div>
                <h1 className="text-3xl font-black text-[#5633D8] tracking-tight">ennvo</h1>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">Log in to your account</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs font-semibold flex items-center space-x-2">
                  <X className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form Input Fields */}
              <form onSubmit={handleLoginSubmit} className="space-y-3.5 my-auto">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Username or Email</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. erfan_ennvo or erfan@gmail.com"
                    className="w-full px-4 py-3.5 bg-gray-100/90 border border-transparent focus:border-[#5633D8] focus:bg-white rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
                    autoFocus
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetInput(formData.username);
                        setResetError(null);
                        setResetSuccessEmail(null);
                        setViewMode('forgot');
                      }}
                      className="text-xs font-bold text-[#5633D8] hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter your password"
                      className="w-full px-4 py-3.5 pr-12 bg-gray-100/90 border border-transparent focus:border-[#5633D8] focus:bg-white rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Log In Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-[#5633D8] hover:bg-[#4828C8] text-white font-extrabold text-base rounded-full shadow-lg shadow-purple-500/25 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98] disabled:opacity-70 mt-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>Log In</span>
                  )}
                </button>

                {/* Google Sign In */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold text-sm rounded-full flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </form>

              {/* Bottom Facebook-Style "Create New Account" Section */}
              <div className="pt-6 pb-2 text-center border-t border-gray-100 flex flex-col items-center">
                <button
                  type="button"
                  onClick={startSignupFlow}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-full shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Create new account</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ======================================================= */}
          {/* VIEW: FORGOT PASSWORD FLOW                              */}
          {/* ======================================================= */}
          {viewMode === 'forgot' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col justify-between py-1"
            >
              {/* Top Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <button
                  type="button"
                  onClick={backToLogin}
                  className="p-2 -ml-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors flex items-center space-x-1"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="text-xs font-bold text-gray-600">Back to Log in</span>
                </button>
                <span className="text-xs font-extrabold text-[#5633D8] tracking-wider uppercase">
                  Account Recovery
                </span>
                <div className="w-8" />
              </div>

              <div className="my-auto space-y-5 max-w-md mx-auto w-full py-4">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-100 text-[#5633D8] flex items-center justify-center shadow-inner">
                    <KeyRound className="w-7 h-7" />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Forgot Your Password?</h2>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-sm mx-auto">
                    Enter your username or registered email address. We'll send you an official secure link to reset your password.
                  </p>
                </div>

                {resetError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs font-semibold flex items-center space-x-2">
                    <X className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{resetError}</span>
                  </div>
                )}

                {resetSuccessEmail ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 space-y-3">
                    <div className="flex items-start space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-extrabold text-sm text-emerald-900">Password Reset Link Sent!</h4>
                        <p className="text-xs text-emerald-700 font-medium mt-1 leading-relaxed">
                          We sent a password reset email to <strong className="font-bold underline">{resetSuccessEmail}</strong>. Please check your Inbox and Spam folder.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={backToLogin}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-full shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                    >
                      Back to Log In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSendResetEmail} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Username or Gmail</label>
                      <input
                        type="text"
                        value={resetInput}
                        onChange={(e) => setResetInput(e.target.value)}
                        placeholder="e.g. erfan_ennvo or erfan@gmail.com"
                        className="w-full px-4 py-3.5 bg-gray-100/90 border border-transparent focus:border-[#5633D8] focus:bg-white rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
                        autoFocus
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isResetting}
                      className="w-full py-3.5 bg-[#5633D8] hover:bg-[#4828C8] text-white font-extrabold text-sm rounded-full shadow-lg shadow-purple-500/25 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98] disabled:opacity-70"
                    >
                      {isResetting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending Reset Link...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          <span>Send Password Reset Email</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>

              <div className="pt-4 text-center border-t border-gray-100">
                <button
                  type="button"
                  onClick={backToLogin}
                  className="text-xs font-extrabold text-gray-600 hover:text-gray-900"
                >
                  Remember your password? <span className="text-[#5633D8] underline">Log In</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ======================================================= */}
          {/* VIEW 2: SIGNUP STEPS                                    */}
          {/* ======================================================= */}
          {viewMode === 'signup' && (
            <div className="flex-1 flex flex-col justify-between py-1">
              
              {/* Top Navigation Bar */}
              {signupStep !== 4 && (
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (signupStep === 1) backToLogin();
                      else setSignupStep(signupStep - 1);
                    }}
                    className="p-2 -ml-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-xs font-bold text-gray-600 hidden sm:inline">Back</span>
                  </button>
                  <span className="text-xs font-extrabold text-purple-700 tracking-wider uppercase">
                    Step {signupStep} of 3
                  </span>
                  <button
                    type="button"
                    onClick={backToLogin}
                    className="text-xs font-bold text-gray-400 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="my-3 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs font-semibold flex items-center space-x-2">
                  <X className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* STEP 1: Name & Username */}
              {signupStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="my-auto space-y-5"
                >
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">What's your name & username?</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1">Enter your real name and choose a unique username.</p>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Erfan Sarker"
                        className="w-full px-4 py-3.5 bg-gray-100/90 border border-transparent focus:border-[#5633D8] focus:bg-white rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                        <span>Username</span>
                        {isUsernameChecking && <span className="text-[10px] text-purple-600 font-bold animate-pulse">Checking...</span>}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3.5 text-gray-400 font-extrabold text-sm">@</span>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                          placeholder="e.g. erfan_ennvo"
                          className={`w-full pl-9 pr-10 py-3.5 bg-gray-100/90 border rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none focus:bg-white transition-all placeholder:text-gray-400 placeholder:font-normal ${
                            isUsernameValid === true 
                              ? 'border-emerald-500 bg-white' 
                              : isUsernameValid === false 
                              ? 'border-red-500 bg-white' 
                              : 'border-transparent focus:border-[#5633D8]'
                          }`}
                        />
                        {isUsernameValid === true && (
                          <CheckCircle2 className="w-4 h-4 absolute right-4 top-4 text-emerald-500" />
                        )}
                        {isUsernameValid === false && (
                          <X className="w-4 h-4 absolute right-4 top-4 text-red-500" />
                        )}
                      </div>
                      {isUsernameValid === false && (
                        <p className="text-[11px] text-red-500 font-bold mt-1 pl-2">Username is already taken</p>
                      )}
                      {isUsernameValid === true && (
                        <p className="text-[11px] text-emerald-600 font-bold mt-1 pl-2">Username available!</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextStep1}
                    className="w-full py-3.5 bg-[#5633D8] hover:bg-[#4828C8] text-white font-extrabold text-base rounded-full shadow-lg shadow-purple-500/25 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* STEP 2: Gmail & Password */}
              {signupStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="my-auto space-y-5"
                >
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Email & Security</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1">Enter your Gmail address and set up a password.</p>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Gmail Address</label>
                      <input
                        type="email"
                        value={formData.mobileOrEmail}
                        onChange={(e) => setFormData({ ...formData, mobileOrEmail: e.target.value })}
                        placeholder="e.g. erfan@gmail.com"
                        className="w-full px-4 py-3.5 bg-gray-100/90 border border-transparent focus:border-[#5633D8] focus:bg-white rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="At least 6 characters"
                          className="w-full px-4 py-3.5 pr-12 bg-gray-100/90 border border-transparent focus:border-[#5633D8] focus:bg-white rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-700"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          placeholder="Re-enter password"
                          className="w-full px-4 py-3.5 pr-12 bg-gray-100/90 border border-transparent focus:border-[#5633D8] focus:bg-white rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-700"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextStep2}
                    className="w-full py-3.5 bg-[#5633D8] hover:bg-[#4828C8] text-white font-extrabold text-base rounded-full shadow-lg shadow-purple-500/25 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* STEP 3: Gender, Profile Photo & Location */}
              {signupStep === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="my-auto space-y-5"
                >
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Profile Details</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1">Add photo, gender and city location.</p>
                  </div>

                  {/* Code-based SVG Avatar Display */}
                  <div className="flex flex-col items-center justify-center">
                    <label className="cursor-pointer group">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-purple-100 bg-gray-100 relative flex items-center justify-center shadow-md">
                        <img 
                          src={avatarPreview || (gender === 'female' ? DEFAULT_FEMALE_AVATAR : DEFAULT_MALE_AVATAR)} 
                          alt="Avatar" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleAvatarChange} 
                        className="hidden" 
                      />
                    </label>
                    <p className="text-[11px] text-gray-500 font-bold mt-2">
                      {avatarPreview ? 'Custom photo added!' : 'Tap to upload custom profile picture'}
                    </p>
                  </div>

                  {/* Gender Buttons (Clean English - No Bangla) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Gender</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setGender('male')}
                        className={`py-3.5 px-4 rounded-full text-xs font-extrabold border transition-all ${
                          gender === 'male' 
                            ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' 
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        Male
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender('female')}
                        className={`py-3.5 px-4 rounded-full text-xs font-extrabold border transition-all ${
                          gender === 'female' 
                            ? 'bg-pink-50 border-pink-500 text-pink-700 shadow-sm' 
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        Female
                      </button>
                    </div>
                  </div>

                  {/* Location Picker */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700">Location</label>
                      <button
                        type="button"
                        onClick={detectLocation}
                        disabled={isDetectingLoc}
                        className="text-[11px] text-purple-600 hover:underline font-bold flex items-center space-x-1"
                      >
                        <Compass className="w-3 h-3" />
                        <span>{isDetectingLoc ? 'Detecting...' : 'Auto Detect'}</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Dhaka, Bangladesh"
                      className="w-full px-4 py-3.5 bg-gray-100/90 border border-transparent focus:border-[#5633D8] focus:bg-white rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
                    />
                  </div>

                  {/* Create Account Action */}
                  <button
                    type="button"
                    onClick={handleCreateAccount}
                    disabled={isLoading}
                    className="w-full py-3.5 bg-[#5633D8] hover:bg-[#4828C8] text-white font-extrabold text-base rounded-full shadow-lg shadow-purple-500/25 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98] disabled:opacity-70"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Create Account</span>
                      </>
                    )}
                  </button>
                </motion.div>
              )}

              {/* STEP 4: Welcome Page */}
              {signupStep === 4 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="my-auto py-6 text-center space-y-6 flex flex-col items-center"
                >
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full p-1 bg-[#5633D8] shadow-xl">
                      <img
                        src={createdUser?.avatar || avatarPreview || (gender === 'female' ? DEFAULT_FEMALE_AVATAR : DEFAULT_MALE_AVATAR)}
                        alt="Avatar"
                        className="w-full h-full object-cover rounded-full bg-white"
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-white shadow-md">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="space-y-1 max-w-xs">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Welcome to Ennvo! 🎉</h2>
                    <p className="text-xs text-gray-600 font-semibold leading-relaxed">
                      Hey <span className="text-[#5633D8] font-extrabold">{createdUser?.name || formData.name}</span>, your account is live!
                    </p>
                  </div>

                  <div className="w-full bg-purple-50 border border-purple-100 rounded-2xl p-4 text-left space-y-2 text-xs text-purple-900 font-semibold">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>Location: <strong className="font-extrabold">{createdUser?.location || location}</strong></span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <UserIcon className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>Username: <strong className="font-extrabold">@{createdUser?.username || formData.username}</strong></span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleEnterApp}
                    className="w-full py-4 bg-[#5633D8] hover:bg-[#4828C8] text-white font-extrabold text-base rounded-full shadow-xl shadow-purple-500/30 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
                  >
                    <span>Enter Ennvo App</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </motion.div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}

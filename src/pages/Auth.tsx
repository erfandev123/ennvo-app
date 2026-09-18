import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, Eye, EyeOff, Smartphone, Camera, ArrowLeft, CheckCircle2, Mail, X } from 'lucide-react';
import { useAppStore } from '../store';
import { signUp, signIn, signInWithGoogle, isUsernameUnique } from '../services/authService';
import { uploadMedia } from '../services/githubStorage';
import { compressAvatarImage } from '../services/mediaCompressor';

export default function Auth() {
  // viewMode: 'welcome' | 'login' | 'signup'
  const [viewMode, setViewMode] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Username availability check
  const [isUsernameChecking, setIsUsernameChecking] = useState(false);
  const [isUsernameValid, setIsUsernameValid] = useState<boolean | null>(null);

  const { setCurrentUser } = useAppStore();

  const [formData, setFormData] = useState({
    username: '',
    mobileOrEmail: '',
    password: '',
    confirmPassword: '',
    name: ''
  });

  // Gender selection state: 'male' | 'female'
  const [gender, setGender] = useState<'male' | 'female'>('male');

  const DEFAULT_MALE_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';
  const DEFAULT_FEMALE_AVATAR = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80';

  const handleRemoveAvatar = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setAvatarFile(null);
    setAvatarPreview(null);
  };
  useEffect(() => {
    if (viewMode !== 'signup' || !formData.username.trim() || formData.username.length < 3) {
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
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.username, viewMode]);

  // Handle avatar image file selection
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

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

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let user;
      if (viewMode === 'login') {
        if (!formData.username) {
          throw new Error('Please enter your username or email');
        }
        if (!formData.password) {
          throw new Error('Please enter your password');
        }
        user = await signIn(formData.username, formData.password);
      } else if (viewMode === 'signup') {
        if (!formData.username) {
          throw new Error('Please enter a username');
        }
        if (formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (isUsernameValid === false) {
          throw new Error('Username is already taken');
        }

        // Upload avatar image to Cloudflare R2 if selected
        let uploadedAvatarUrl: string | undefined = undefined;
        if (avatarFile) {
          try {
            const compressedAvatar = await compressAvatarImage(avatarFile);
            uploadedAvatarUrl = await uploadMedia(compressedAvatar, 'avatars');
          } catch (uploadErr) {
            console.warn('Avatar upload fallback to preview:', uploadErr);
            uploadedAvatarUrl = avatarPreview || undefined;
          }
        }

        // Use mobileOrEmail if provided and contains '@' as the primary email for registration
        const emailOrUsernameInput = formData.mobileOrEmail.includes('@') 
          ? formData.mobileOrEmail.trim() 
          : formData.username.trim();

        const finalAvatarUrl = uploadedAvatarUrl || avatarPreview || (gender === 'female' ? DEFAULT_FEMALE_AVATAR : DEFAULT_MALE_AVATAR);

        user = await signUp(
          emailOrUsernameInput,
          formData.password,
          formData.name || formData.username,
          formData.username,
          formData.mobileOrEmail,
          finalAvatarUrl
        );
      }
      if (user) {
        setCurrentUser(user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  }, [viewMode, formData, avatarFile, avatarPreview, isUsernameValid, setCurrentUser]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        setCurrentUser(user);
      }
    } catch (err: any) {
      setError(err.message || 'Google sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    handleGoogleSignIn();
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col md:flex-row font-sans select-none overflow-x-hidden">
      
      {/* ========================================================= */}
      {/* LEFT PANEL: Purple Branding (Full height on Desktop)      */}
      {/* ========================================================= */}
      <div className="hidden md:flex md:w-1/2 lg:w-5/12 bg-gradient-to-br from-[#5633D8] via-[#4828C8] to-[#361BA8] text-white p-10 lg:p-16 flex-col justify-between items-center text-center relative overflow-hidden shrink-0 min-h-screen">
        
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="my-auto flex flex-col items-center z-10 w-full max-w-sm px-4">
          {/* Logo Symbol */}
          <div className="w-32 h-32 mb-8 flex items-center justify-center drop-shadow-2xl transition-transform hover:scale-105">
            <img 
              src="/Ennvo Symbol.png" 
              alt="Ennvo Symbol" 
              className="w-full h-full object-contain filter drop-shadow-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/Ennvo.png";
              }}
            />
          </div>

          {/* Title & Description */}
          <AnimatePresence mode="wait">
            {viewMode === 'signup' ? (
              <motion.div
                key="signup-left"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white drop-shadow-sm">
                  Create Your Account
                </h1>
                <p className="text-base font-normal text-purple-100/90 leading-relaxed">
                  Join Ennvo and start your journey
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="welcome-left"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white drop-shadow-sm">
                  Welcome to Ennvo
                </h1>
                <p className="text-base font-normal text-purple-100/90 leading-relaxed">
                  Connect. Share. Enjoy.
                </p>

                <div className="pt-6">
                  <button
                    type="button"
                    onClick={() => setViewMode('login')}
                    className="bg-white text-[#5633D8] hover:bg-purple-50 font-semibold px-8 py-3.5 rounded-full text-base shadow-xl transition-all active:scale-95"
                  >
                    Get Started
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="text-xs text-purple-200/60 z-10 pb-2">
          © 2026 Ennvo Inc. All rights reserved.
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT PANEL / MOBILE VIEW: Full-screen Form View          */}
      {/* ========================================================= */}
      <div className="w-full md:w-1/2 lg:w-7/12 bg-white flex flex-col justify-center items-center min-h-screen p-6 sm:p-12 relative">
        
        {/* MOBILE ONLY: Welcome Landing View */}
        {viewMode === 'welcome' && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-[#5633D8] via-[#4828C8] to-[#361BA8] p-8 text-white min-h-[100dvh]">
            <div className="my-auto flex flex-col items-center text-center">
              <div className="w-28 h-28 mb-8 flex items-center justify-center">
                <img 
                  src="/Ennvo Symbol.png" 
                  alt="Ennvo Logo" 
                  className="w-full h-full object-contain filter drop-shadow-lg"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/Ennvo.png"; }}
                />
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-3 text-white">
                Welcome to Ennvo
              </h1>
              <p className="text-base text-purple-100/90 mb-10">
                Connect. Share. Enjoy.
              </p>

              {/* Pagination Dots */}
              <div className="flex items-center space-x-2.5 mb-8">
                <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/40" />
              </div>
            </div>

            <div className="space-y-4 pb-safe w-full max-w-xs mx-auto">
              <button
                type="button"
                onClick={() => setViewMode('login')}
                className="w-full bg-white text-[#5633D8] hover:bg-purple-50 font-semibold py-4 rounded-2xl text-base shadow-xl transition-all active:scale-[0.98] text-center"
              >
                Get Started
              </button>

              <p className="text-center text-sm text-white/90">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setViewMode('login')}
                  className="font-bold underline text-white hover:text-purple-200"
                >
                  Login
                </button>
              </p>
            </div>
          </div>
        )}

        {/* LOGIN / SIGNUP FORM CONTENT CONTAINER */}
        <div className="w-full max-w-sm sm:max-w-md mx-auto my-auto py-8">
          
          {/* Back Arrow Button (Mobile only) */}
          <button
            type="button"
            onClick={() => setViewMode('welcome')}
            className="md:hidden absolute top-10 left-6 text-gray-500 hover:text-gray-900 transition-colors p-2.5 rounded-full hover:bg-gray-100 z-10"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Header Title & Symbol */}
          {viewMode === 'login' ? (
            <div className="text-center mb-6 pt-2">
              <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                <img 
                  src="/Ennvo Symbol.png" 
                  alt="Ennvo Symbol" 
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/Ennvo.png"; }}
                />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                Welcome Back
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Login to continue
              </p>
            </div>
          ) : (
            <div className="text-center mb-6 pt-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                Create Account
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Fill in the details to get started
              </p>
            </div>
          )}

          {/* Social Buttons (Login mode) */}
          {viewMode === 'login' && (
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full border border-gray-200 hover:bg-gray-50/90 bg-white text-gray-700 font-medium py-3 px-4 rounded-xl text-sm flex items-center justify-center space-x-3 transition-all active:scale-[0.99] shadow-xs"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={handleFacebookSignIn}
                disabled={isLoading}
                className="w-full border border-gray-200 hover:bg-gray-50/90 bg-white text-gray-700 font-medium py-3 px-4 rounded-xl text-sm flex items-center justify-center space-x-3 transition-all active:scale-[0.99] shadow-xs"
              >
                <svg className="w-4 h-4 fill-[#1877F2] shrink-0" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span>Continue with Facebook</span>
              </button>
            </div>
          )}

          {/* Divider (or) */}
          {viewMode === 'login' && (
            <div className="flex items-center space-x-3 my-5">
              <div className="flex-1 h-[1px] bg-gray-200" />
              <span className="text-xs text-gray-400 font-normal">or</span>
              <div className="flex-1 h-[1px] bg-gray-200" />
            </div>
          )}

          {/* Login / Sign Up Tab Selector */}
          <div className="flex border-b border-gray-200 mb-6 relative">
            <button
              type="button"
              onClick={() => { setViewMode('login'); setError(null); }}
              className={`w-1/2 py-2.5 text-center text-sm font-semibold transition-colors relative ${
                viewMode === 'login' ? 'text-[#5633D8]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Login
              {viewMode === 'login' && (
                <motion.div 
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#5633D8] rounded-full"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => { setViewMode('signup'); setError(null); }}
              className={`w-1/2 py-2.5 text-center text-sm font-semibold transition-colors relative ${
                viewMode === 'signup' ? 'text-[#5633D8]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Sign Up
              {viewMode === 'signup' && (
                <motion.div 
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#5633D8] rounded-full"
                />
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-normal text-center leading-relaxed">
              {error}
            </div>
          )}

          {/* AUTH FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Avatar Upload Picker in Signup Mode */}
            {viewMode === 'signup' && (
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="relative group">
                  <label className="relative cursor-pointer block">
                    <div className="w-20 h-20 rounded-full bg-purple-50 border-2 border-dashed border-purple-300 flex items-center justify-center overflow-hidden group-hover:border-[#5633D8] transition-colors shadow-sm">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center text-purple-600">
                          <Camera className="w-6 h-6 mb-0.5" />
                          <span className="text-[10px] font-semibold">Photo</span>
                        </div>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleAvatarChange} 
                      className="hidden" 
                    />
                  </label>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-transform active:scale-95"
                      title="Remove Photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-2 mt-1.5">
                  <span className="text-xs text-purple-700 font-medium">
                    {avatarPreview ? "Profile Photo Added" : "Add Profile Picture"}
                  </span>
                  {avatarPreview && (
                    <button 
                      type="button" 
                      onClick={handleRemoveAvatar} 
                      className="text-[11px] text-red-500 hover:underline font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Gender Selection (Male / Female) */}
                <div className="w-full mt-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 text-left">
                    Select Gender
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all active:scale-98 ${
                        gender === 'male'
                          ? 'border-[#5633D8] bg-purple-50/80 text-[#5633D8] shadow-xs'
                          : 'border-gray-200 bg-gray-50/60 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-base">👨</span>
                      <span>Male</span>
                      {gender === 'male' && <CheckCircle2 className="w-3.5 h-3.5 text-[#5633D8]" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all active:scale-98 ${
                        gender === 'female'
                          ? 'border-[#5633D8] bg-purple-50/80 text-[#5633D8] shadow-xs'
                          : 'border-gray-200 bg-gray-50/60 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-base">👩</span>
                      <span>Female</span>
                      {gender === 'female' && <CheckCircle2 className="w-3.5 h-3.5 text-[#5633D8]" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Username or Email Input */}
            <div>
              <div className="relative flex items-center">
                {viewMode === 'login' ? (
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                ) : (
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                )}
                <input
                  type="text"
                  required
                  placeholder={viewMode === 'login' ? "Email or Username" : "Username"}
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-gray-50/80 border border-gray-200/90 focus:border-[#5633D8] focus:bg-white rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Username availability indicator */}
              {viewMode === 'signup' && formData.username.trim().length >= 3 && (
                <div className="mt-1.5 pl-1 flex items-center space-x-1.5 text-[11px]">
                  {isUsernameChecking ? (
                    <span className="text-gray-400">Checking availability...</span>
                  ) : isUsernameValid === true ? (
                    <span className="text-emerald-600 font-medium flex items-center">
                      Username available <CheckCircle2 className="w-3.5 h-3.5 ml-1 stroke-[2.5]" />
                    </span>
                  ) : isUsernameValid === false ? (
                    <span className="text-red-500 font-normal">Username taken</span>
                  ) : null}
                </div>
              )}
            </div>

            {/* Mobile Number or Email Input (Sign Up mode) */}
            {viewMode === 'signup' && (
              <div className="relative flex items-center">
                <Smartphone className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Mobile Number or Email"
                  value={formData.mobileOrEmail}
                  onChange={(e) => setFormData({ ...formData, mobileOrEmail: e.target.value })}
                  className="w-full bg-gray-50/80 border border-gray-200/90 focus:border-[#5633D8] focus:bg-white rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400"
                />
              </div>
            )}

            {/* Password Input */}
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-gray-50/80 border border-gray-200/90 focus:border-[#5633D8] focus:bg-white rounded-xl pl-10 pr-10 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Confirm Password Input (Sign Up mode) */}
            {viewMode === 'signup' && (
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full bg-gray-50/80 border border-gray-200/90 focus:border-[#5633D8] focus:bg-white rounded-xl pl-10 pr-10 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Forgot Password Link */}
            {viewMode === 'login' && (
              <div className="text-right pt-0.5">
                <button
                  type="button"
                  onClick={() => setError('A password reset link has been sent to your registered email.')}
                  className="text-xs text-gray-500 hover:text-[#5633D8] transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#5633D8] hover:bg-[#4828C8] disabled:bg-[#5633D8]/60 text-white font-semibold py-3.5 rounded-xl text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center space-x-2 mt-4"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>{viewMode === 'login' ? 'Login' : 'Sign Up'}</span>
              )}
            </button>

            {/* Toggle Footer Link */}
            <div className="text-center pt-4">
              <p className="text-xs text-gray-600">
                {viewMode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode(viewMode === 'login' ? 'signup' : 'login');
                    setError(null);
                  }}
                  className="text-[#5633D8] font-bold hover:underline transition-all"
                >
                  {viewMode === 'login' ? 'Sign Up' : 'Login'}
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

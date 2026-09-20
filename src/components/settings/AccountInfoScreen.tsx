import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Camera, 
  MapPin, Compass, Phone, User as UserIcon, Mail, Check, Sparkles 
} from 'lucide-react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppStore } from '../../store';

interface AccountInfoScreenProps {
  onBack: () => void;
}

export const AccountInfoScreen: React.FC<AccountInfoScreenProps> = ({ onBack }) => {
  const { currentUser, setCurrentUser } = useAppStore();

  const [name, setName] = useState(currentUser?.name || 'Ennvo User');
  const [username, setUsername] = useState(currentUser?.username ? currentUser.username.replace('@', '') : 'user');
  const [email] = useState(currentUser?.email || '');
  const [mobileNumber, setMobileNumber] = useState(currentUser?.mobileNumber || currentUser?.phoneNumber || '');
  const [location, setLocation] = useState(currentUser?.location || 'Dhaka, Bangladesh');
  const [gender, setGender] = useState(currentUser?.gender || 'male');
  const [bio, setBio] = useState(currentUser?.bio || 'Hey there! I am using Ennvo.');

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const checkTimerRef = useRef<any>(null);

  // Auto detect location state
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Real-time username check whenever username changes
  const handleUsernameChange = (val: string) => {
    const clean = val.trim().toLowerCase().replace('@', '');
    setUsername(clean);
    setSaveError(null);

    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);

    const currentClean = (currentUser?.username || '').toLowerCase().replace('@', '');
    if (clean === currentClean) {
      setUsernameStatus('available');
      setUsernameError(null);
      return;
    }

    if (!clean || clean.length < 3) {
      setUsernameStatus('invalid');
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_.]+$/.test(clean)) {
      setUsernameStatus('invalid');
      setUsernameError('Letters, numbers, underscores and periods only');
      return;
    }

    setUsernameStatus('checking');
    setUsernameError(null);

    checkTimerRef.current = setTimeout(async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', clean));
        const snap = await getDocs(q);

        const isTaken = snap.docs.some(d => d.id !== currentUser?.uid);
        if (isTaken) {
          setUsernameStatus('taken');
          setUsernameError(`@${clean} is already taken. Please choose another username.`);
        } else {
          setUsernameStatus('available');
          setUsernameError(null);
        }
      } catch (err) {
        console.error('Username check error:', err);
        setUsernameStatus('available');
      }
    }, 450);
  };

  // Auto detect user location using Geolocation + Reverse Geocoding
  const handleAutoDetectLocation = async () => {
    setIsDetectingLocation(true);
    setLocationSuccessMsg(null);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
            );
            if (res.ok) {
              const data = await res.json();
              const addr = data.address || {};
              const city = addr.city || addr.town || addr.municipality || addr.district || addr.county || addr.state || '';
              const country = addr.country || '';
              const locStr = [city, country].filter(Boolean).join(', ') || 'Bangladesh';
              setLocation(locStr);
              setLocationSuccessMsg(`Location detected: ${locStr}`);
              setTimeout(() => setLocationSuccessMsg(null), 3500);
            } else {
              fallbackTimezone();
            }
          } catch (e) {
            fallbackTimezone();
          } finally {
            setIsDetectingLocation(false);
          }
        },
        (error) => {
          console.warn('Geolocation denied or failed, using timezone fallback', error);
          fallbackTimezone();
          setIsDetectingLocation(false);
        },
        { timeout: 8000 }
      );
    } else {
      fallbackTimezone();
      setIsDetectingLocation(false);
    }
  };

  const fallbackTimezone = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz.includes('Dhaka')) {
        setLocation('Dhaka, Bangladesh');
        setLocationSuccessMsg('Location set: Dhaka, Bangladesh');
      } else if (tz.includes('Kolkata')) {
        setLocation('Kolkata, India');
        setLocationSuccessMsg('Location set: Kolkata, India');
      } else {
        const parts = tz.split('/');
        const city = parts[1]?.replace(/_/g, ' ') || 'Dhaka';
        setLocation(`${city}, Bangladesh`);
        setLocationSuccessMsg(`Location set: ${city}`);
      }
    } catch {
      setLocation('Dhaka, Bangladesh');
      setLocationSuccessMsg('Location set: Dhaka, Bangladesh');
    }
    setTimeout(() => setLocationSuccessMsg(null), 3500);
  };

  // Save Account Information
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (usernameStatus === 'taken') {
      setSaveError('Please choose an available username before saving.');
      return;
    }
    if (usernameStatus === 'invalid') {
      setSaveError(usernameError || 'Invalid username');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const cleanUsername = username.trim().toLowerCase().replace('@', '');

    try {
      // Re-verify uniqueness one last time
      if (cleanUsername !== (currentUser.username || '').toLowerCase().replace('@', '')) {
        const q = query(collection(db, 'users'), where('username', '==', cleanUsername));
        const snap = await getDocs(q);
        if (snap.docs.some(d => d.id !== currentUser.uid)) {
          setUsernameStatus('taken');
          setSaveError(`@${cleanUsername} is already taken!`);
          setIsSaving(false);
          return;
        }
      }

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        name: name.trim(),
        username: cleanUsername,
        mobileNumber: mobileNumber.trim(),
        phoneNumber: mobileNumber.trim(),
        location: location.trim(),
        gender: gender,
        bio: bio.trim()
      });

      setCurrentUser({
        ...currentUser,
        name: name.trim(),
        username: cleanUsername,
        mobileNumber: mobileNumber.trim(),
        phoneNumber: mobileNumber.trim(),
        location: location.trim(),
        gender: gender as any,
        bio: bio.trim()
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onBack();
      }, 1200);
    } catch (err: any) {
      console.error('Failed saving account info:', err);
      setSaveError(err.message || 'Failed to update account information. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
        <button 
          onClick={onBack}
          type="button"
          className="p-1 -ml-1 text-gray-900 hover:text-gray-600 transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
          Account information
        </h1>
      </div>

      <div className="px-4 py-5 max-w-lg w-full mx-auto space-y-5">
        {/* Profile Avatar Header */}
        <div className="flex flex-col items-center justify-center pt-2 pb-1">
          <div className="relative">
            <img 
              src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`} 
              alt="Avatar"
              className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-sm ring-2 ring-gray-100"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-1 -right-1 bg-gray-900 text-white p-1.5 rounded-full shadow-md">
              <Camera className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-[13px] font-semibold text-gray-900 mt-2.5">{name}</p>
          <p className="text-xs text-gray-400">@{username}</p>
        </div>

        {/* Feedback Alerts */}
        {saveSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Account information updated successfully!</span>
          </div>
        )}

        {saveError && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {locationSuccessMsg && (
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-blue-800 text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-200">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{locationSuccessMsg}</span>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100/90 shadow-2xs divide-y divide-gray-100 overflow-hidden">
            {/* Full Name */}
            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Full Name</label>
              <div className="flex items-center space-x-2">
                <UserIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Username with real-time uniqueness validation */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-500">Username</label>
                {usernameStatus === 'checking' && (
                  <span className="text-[11px] text-gray-400 flex items-center space-x-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Checking availability...</span>
                  </span>
                )}
                {usernameStatus === 'available' && (
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    <span>Available</span>
                  </span>
                )}
                {usernameStatus === 'taken' && (
                  <span className="text-[11px] text-red-600 font-semibold flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                    <span>Already taken</span>
                  </span>
                )}
              </div>
              <div className="flex items-center">
                <span className="text-[15px] text-gray-400 font-semibold mr-1">@</span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="username"
                  className={`w-full text-[15px] font-medium focus:outline-none bg-transparent ${
                    usernameStatus === 'taken' ? 'text-red-600' : 'text-gray-900'
                  }`}
                />
              </div>
              {usernameError && (
                <p className="text-[11px] text-red-500 mt-1 font-medium">{usernameError}</p>
              )}
            </div>

            {/* Email (read-only for security) */}
            <div className="p-4 bg-gray-50/40">
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email Address</label>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full text-[15px] font-medium text-gray-500 bg-transparent cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Email is verified with your authentication provider</p>
            </div>

            {/* Phone Number Field */}
            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phone Number</label>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="+880 1700-000000"
                  className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Add your phone number for account recovery and 2-step verification</p>
            </div>

            {/* Location with Auto-detect Button */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-500">Location</label>
                <button
                  type="button"
                  onClick={handleAutoDetectLocation}
                  disabled={isDetectingLocation}
                  className="text-xs text-[#00a8b5] hover:text-[#008f9a] font-semibold flex items-center space-x-1 active:scale-95 transition-all"
                >
                  {isDetectingLocation ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Detecting...</span>
                    </>
                  ) : (
                    <>
                      <Compass className="w-3 h-3" />
                      <span>Auto-detect</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Dhaka, Bangladesh"
                  className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Gender Selection */}
            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent cursor-pointer"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Prefer not to say</option>
              </select>
            </div>

            {/* Bio Field */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-500">Bio</label>
                <span className="text-[10px] text-gray-400 font-medium">{bio.length}/150</span>
              </div>
              <textarea
                rows={2}
                maxLength={150}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe yourself to followers..."
                className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Action Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving || usernameStatus === 'taken' || usernameStatus === 'checking'}
              className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-bold text-[15px] rounded-2xl transition-all active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center space-x-2 shadow-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

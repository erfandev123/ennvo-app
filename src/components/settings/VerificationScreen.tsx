import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, BadgeCheck, CheckCircle2, Clock, Upload, 
  FileText, ShieldCheck, AlertCircle, Loader2, Link as LinkIcon, 
  Check, ChevronRight 
} from 'lucide-react';
import { doc, updateDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppStore } from '../../store';

interface VerificationScreenProps {
  onBack: () => void;
}

export const VerificationScreen: React.FC<VerificationScreenProps> = ({ onBack }) => {
  const { currentUser, setCurrentUser } = useAppStore();

  const [fullName, setFullName] = useState(currentUser?.name || '');
  const [knownAs, setKnownAs] = useState(currentUser?.username ? currentUser.username.replace('@', '') : '');
  const [category, setCategory] = useState('Creator / Influencer');
  const [documentType, setDocumentType] = useState('National ID (NID)');
  const [documentNumber, setDocumentNumber] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [additionalNote, setAdditionalNote] = useState('');
  const [documentFileName, setDocumentFileName] = useState<string | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Check if user already submitted a verification request
  useEffect(() => {
    if (!currentUser) {
      setLoadingInitial(false);
      return;
    }

    const checkExisting = async () => {
      try {
        const reqDoc = await getDoc(doc(db, 'verification_requests', currentUser.uid));
        if (reqDoc.exists()) {
          setExistingRequest(reqDoc.data());
        } else if (currentUser.verificationStatus === 'pending') {
          setExistingRequest({
            status: 'pending',
            fullName: currentUser.name,
            category: 'Creator / Influencer',
            submittedAt: currentUser.verificationRequestedAt
          });
        }
      } catch (e) {
        console.warn('Could not check existing verification request:', e);
      } finally {
        setLoadingInitial(false);
      }
    };

    checkExisting();
  }, [currentUser]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setDocumentPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!agreeTerms) {
      alert('Please confirm the declaration checkbox to proceed.');
      return;
    }

    setIsSubmitting(true);
    try {
      const requestData = {
        uid: currentUser.uid,
        userEmail: currentUser.email || '',
        username: currentUser.username || '',
        fullName: fullName.trim(),
        knownAs: knownAs.trim(),
        category,
        documentType,
        documentNumber: documentNumber.trim(),
        websiteLink: websiteLink.trim(),
        additionalNote: additionalNote.trim(),
        documentImage: documentPreview || null,
        status: 'pending',
        submittedAt: serverTimestamp()
      };

      // Save request in verification_requests collection
      await setDoc(doc(db, 'verification_requests', currentUser.uid), requestData);

      // Update user doc verificationStatus to 'pending'
      await updateDoc(doc(db, 'users', currentUser.uid), {
        verificationStatus: 'pending',
        verificationRequestedAt: Date.now()
      });

      setCurrentUser({
        ...currentUser,
        verificationStatus: 'pending',
        verificationRequestedAt: Date.now()
      });

      setExistingRequest(requestData);
    } catch (err: any) {
      console.error('Failed submitting verification request:', err);
      alert(err.message || 'Failed to submit verification request. Please try again.');
    } finally {
      setIsSubmitting(false);
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
          Request verification
        </h1>
      </div>

      <div className="px-4 py-5 max-w-lg w-full mx-auto space-y-5">
        {loadingInitial ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-7 h-7 animate-spin text-[#00c4cc]" />
            <span className="text-xs font-semibold text-gray-400">Loading verification status...</span>
          </div>
        ) : currentUser?.isVerified ? (
          /* Case 1: Already Verified */
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center space-y-4 animate-in fade-in duration-200">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border-2 border-blue-200">
              <BadgeCheck className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Your Account is Verified</h2>
              <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-sm mx-auto mt-1">
                Your profile displays the official blue verification badge, confirming authenticity across Ennvo.
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-2xl text-left text-xs space-y-1.5 border border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Account Name</span>
                <span className="text-gray-900 font-bold">{currentUser.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Username</span>
                <span className="text-gray-900 font-bold">@{currentUser.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Status</span>
                <span className="text-blue-600 font-bold flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Verified Official Account</span>
                </span>
              </div>
            </div>
          </div>
        ) : (existingRequest?.status === 'pending' || currentUser?.verificationStatus === 'pending') ? (
          /* Case 2: Pending Administrative Review */
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center space-y-4 animate-in fade-in duration-200">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border-2 border-amber-200">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 mb-2">
                Application Under Review
              </div>
              <h2 className="text-lg font-extrabold text-gray-900">Verification Submitted</h2>
              <p className="text-xs text-gray-500 font-normal leading-relaxed max-w-sm mx-auto mt-1.5">
                Your application has been received and is currently under administrative evaluation. The admin team will review your submitted documents and credentials.
              </p>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-2xl text-left text-xs space-y-2 border border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Applicant Name</span>
                <span className="text-gray-900 font-bold">{existingRequest?.fullName || currentUser.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Category</span>
                <span className="text-gray-900 font-bold">{existingRequest?.category || 'Creator / Influencer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Review Status</span>
                <span className="text-amber-600 font-bold flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pending Admin Decision</span>
                </span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 font-normal">
              You will receive an in-app notification and your badge will appear automatically once approved.
            </p>
          </div>
        ) : (
          /* Case 3: Application Form */
          <>
            {/* Header Hero Banner */}
            <div className="bg-gradient-to-r from-blue-500/10 via-sky-500/5 to-transparent p-4 rounded-2xl border border-blue-100/80 flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                <BadgeCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Apply for the Blue Verification Badge</h3>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                  Official badges indicate that Ennvo has confirmed this account is the authentic presence of a creator or public figure.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Step 1: Identity */}
              <div className="bg-white rounded-2xl border border-gray-100/90 shadow-2xs divide-y divide-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50/50">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Step 1: Confirm Authenticity</p>
                </div>

                <div className="p-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="As shown on official ID"
                    className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent"
                  />
                </div>

                <div className="p-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Known As / Stage Name</label>
                  <input
                    type="text"
                    required
                    value={knownAs}
                    onChange={(e) => setKnownAs(e.target.value)}
                    placeholder="e.g. Erfan or Tech Channel"
                    className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent"
                  />
                </div>

                <div className="p-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent cursor-pointer"
                  >
                    <option value="Creator / Influencer">Creator / Influencer</option>
                    <option value="News & Media">News & Media</option>
                    <option value="Business & Brand">Business & Brand</option>
                    <option value="Music & Entertainment">Music & Entertainment</option>
                    <option value="Sports & Athlete">Sports & Athlete</option>
                    <option value="Public Figure / Government">Public Figure / Government</option>
                  </select>
                </div>

                <div className="p-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Government Document Type</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent cursor-pointer"
                  >
                    <option value="National ID (NID)">National ID (NID)</option>
                    <option value="Passport">Passport</option>
                    <option value="Driver's License">Driver's License</option>
                    <option value="Official Business Tax Document">Official Business Tax Document</option>
                  </select>
                </div>

                <div className="p-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Document ID Number</label>
                  <input
                    type="text"
                    required
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="Enter document identification number"
                    className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent"
                  />
                </div>

                {/* Upload Document File */}
                <div className="p-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Upload Photo of ID Document</label>
                  <label className="border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50/40">
                    <Upload className="w-6 h-6 text-gray-400 mb-1.5" />
                    <span className="text-xs font-semibold text-gray-700">
                      {documentFileName ? documentFileName : 'Choose photo or drag file here'}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">JPG, PNG or PDF (Max 5MB)</span>
                    <input 
                      type="file" 
                      accept="image/*,.pdf" 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />
                  </label>
                  {documentPreview && (
                    <div className="mt-2.5 relative w-24 h-16 rounded-xl overflow-hidden border border-gray-200">
                      <img src={documentPreview} alt="ID Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Notability & Presence */}
              <div className="bg-white rounded-2xl border border-gray-100/90 shadow-2xs divide-y divide-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50/50">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Step 2: Confirm Notability</p>
                </div>

                <div className="p-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Official Website / Social Link</label>
                  <div className="flex items-center space-x-2">
                    <LinkIcon className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                      type="url"
                      value={websiteLink}
                      onChange={(e) => setWebsiteLink(e.target.value)}
                      placeholder="https://example.com or youtube.com/..."
                      className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div className="p-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Additional Pitch / Articles</label>
                  <textarea
                    rows={2}
                    value={additionalNote}
                    onChange={(e) => setAdditionalNote(e.target.value)}
                    placeholder="Provide any news articles, notable mentions, or background info..."
                    className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Terms declaration */}
              <label className="flex items-start space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#00c4cc] focus:ring-0"
                />
                <span className="text-xs text-gray-600 font-medium leading-tight">
                  I certify that the information provided is accurate and authentic. Submitting false credentials will lead to account suspension.
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !agreeTerms}
                className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-bold text-[15px] rounded-2xl transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center space-x-2 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Submitting request...</span>
                  </>
                ) : (
                  <span>Submit Verification Request</span>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

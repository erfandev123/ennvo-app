import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  MessageSquare, 
  Check, 
  X, 
  FileText, 
  Send, 
  User, 
  Headphones, 
  HelpCircle, 
  Search, 
  Filter, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  PhoneCall, 
  Mail, 
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { Language, i18n } from '../i18n';
import { verifyUserAction, logAdminAction } from '../services/adminService';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../../../src/firebase';
import { VerifiedBadge } from '../../../src/components/VerifiedBadge';

interface SupportTicket {
  id: string;
  userId?: string;
  user: string;
  email: string;
  phone?: string;
  category: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  deviceInfo?: string;
  adminReply?: string;
  repliedAt?: any;
  date: string;
  createdAt?: any;
}

interface VerificationApplicant {
  id: string;
  uid: string;
  name: string;
  username: string;
  avatar?: string;
  idDocType: string;
  category: string;
  proofUrl?: string;
  followersCount?: number;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const DEFAULT_APPLICANTS: VerificationApplicant[] = [
  { 
    id: 'req_101', 
    uid: 'user_erfan_sarker', 
    name: 'Erfan Sarker', 
    username: 'erfansarker', 
    idDocType: 'National ID (NID)', 
    category: 'Founder / Public Figure', 
    proofUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400',
    followersCount: 15420,
    status: 'pending', 
    date: '10m ago' 
  },
  { 
    id: 'req_102', 
    uid: 'user_tariq_hassan', 
    name: 'Tariq Hassan', 
    username: 'tariqhassan', 
    idDocType: 'Passport', 
    category: 'Journalist / Media', 
    proofUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    followersCount: 8900,
    status: 'pending', 
    date: '2h ago' 
  },
  { 
    id: 'req_103', 
    uid: 'user_salma_music', 
    name: 'Salma Akter', 
    username: 'salma_official', 
    idDocType: 'Govt. Verified License', 
    category: 'Music Artist', 
    proofUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    followersCount: 34100,
    status: 'pending', 
    date: '5h ago' 
  }
];

const DEFAULT_TICKETS: SupportTicket[] = [
  {
    id: 'TCK-8801',
    user: 'Shakil Ahmed',
    email: 'shakil.ahmed@example.com',
    phone: '+880 1712-345678',
    category: 'Video Calling',
    subject: 'Video call lagging on 3G cellular network',
    message: 'When connecting with audio and video, audio works but video stutters occasionally on weak network. Please optimize low bandwidth adaptive bitrate.',
    status: 'open',
    priority: 'high',
    deviceInfo: 'Samsung Galaxy A53 • Android 14 • App v1.1.0',
    date: '15m ago'
  },
  {
    id: 'TCK-8802',
    user: 'Farzana Rahman',
    email: 'farzana.r@example.com',
    phone: '+880 1911-987654',
    category: 'Reels Download',
    subject: 'How to save downloaded reel directly into phone gallery',
    message: 'I tapped download on my own reel but cannot find it in Google Photos gallery immediately.',
    status: 'in_progress',
    priority: 'normal',
    deviceInfo: 'Xiaomi Redmi Note 12 • Android 13 • App v1.1.0',
    adminReply: 'Hello Farzana! Videos are saved under Internal Storage / Download / EnnvoMedia. Please grant storage permissions in Settings.',
    date: '1h ago'
  },
  {
    id: 'TCK-8803',
    user: 'Tanvir Mahmud',
    email: 'tanvir.dev@example.com',
    category: 'Blue Badge Verification',
    subject: 'Requesting verified blue badge for official brand profile',
    message: 'We submitted trade license and website domain ownership proofs. Please review and verify our account.',
    status: 'open',
    priority: 'urgent',
    deviceInfo: 'iPhone 15 Pro • iOS 17.5 • Web App',
    date: '3h ago'
  },
  {
    id: 'TCK-8804',
    user: 'Nasir Uddin',
    email: 'nasir.u@example.com',
    category: 'Account & Login',
    subject: 'Need help resetting 4-digit privacy passcode',
    message: 'I forgot my secondary privacy lock pin. Need temporary authorization link.',
    status: 'resolved',
    priority: 'normal',
    deviceInfo: 'OnePlus 11 • Android 14',
    adminReply: 'Passcode recovery link sent to registered email address.',
    date: '1d ago'
  }
];

const DEFAULT_FAQS: FAQItem[] = [
  {
    id: 'faq_1',
    category: 'Verification',
    question: 'How do users qualify for the Official Blue Verified Badge?',
    answer: 'Users must have a complete profile, authentic government-issued identity (NID, Passport, Trade License), and active community engagement without policy violations.'
  },
  {
    id: 'faq_2',
    category: 'Reels & Media',
    question: 'How does the content deduplication and feed algorithm work?',
    answer: 'Our engine uses smart seen-state hashing and viral score weights. Admins can promote any post or reel to #1 position across all users feeds with 1 click.'
  },
  {
    id: 'faq_3',
    category: 'Security',
    question: 'What is the Master Admin security protocol?',
    answer: 'The Admin Panel is fully isolated from normal user sessions, equipped with 30-minute idle timeouts, anti-brute force gates, and passcode keys.'
  },
  {
    id: 'faq_4',
    category: 'Customer Care',
    question: 'How can users contact official 24/7 Ennvo Customer Support?',
    answer: 'Users can submit a support ticket via Settings > Help Center, or email ennvoapp@gmail.com or hotline +880 1700-000000.'
  }
];

export const VerificationSupportPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'verification' | 'faqs' | 'hotline'>('tickets');
  const [tickets, setTickets] = useState<SupportTicket[]>(DEFAULT_TICKETS);
  const [applicants, setApplicants] = useState<VerificationApplicant[]>(DEFAULT_APPLICANTS);
  const [faqs, setFaqs] = useState<FAQItem[]>(DEFAULT_FAQS);
  
  // Ticket filters & search
  const [ticketSearch, setTicketSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'urgent' | 'high' | 'normal'>('all');

  // Selected ticket for modal resolution
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // New FAQ Modal
  const [showAddFaqModal, setShowAddFaqModal] = useState(false);
  const [newFaqQuestion, setNewFaqQuestion] = useState('');
  const [newFaqAnswer, setNewFaqAnswer] = useState('');
  const [newFaqCategory, setNewFaqCategory] = useState('General');

  const t = i18n[lang];

  // Live Firestore subscription for support tickets if collection exists
  useEffect(() => {
    try {
      const q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'), limit(50));
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const remoteTickets = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            date: d.data().createdAt ? new Date(d.data().createdAt?.toDate ? d.data().createdAt.toDate() : d.data().createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'
          } as SupportTicket));
          setTickets(remoteTickets);
        }
      }, (err) => {
        // Fallback to rich default state
      });
      return () => unsub();
    } catch (e) {}
  }, []);

  // Filtered tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchSearch = (ticket.subject + ' ' + ticket.user + ' ' + ticket.message + ' ' + ticket.category)
      .toLowerCase()
      .includes(ticketSearch.toLowerCase());
    const matchStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const handleApproveVerification = async (applicant: VerificationApplicant) => {
    try {
      await verifyUserAction(applicant.uid, true, `Approved verification request (${applicant.id}) for ${applicant.name}`);
      setApplicants(prev => prev.map(a => a.id === applicant.id ? { ...a, status: 'approved' } : a));
      alert(`ðŸŽ‰ Official Blue Verified Badge granted to @${applicant.username}!`);
    } catch (e: any) {
      alert(`Error approving verification: ${e.message}`);
    }
  };

  const handleRejectVerification = async (applicant: VerificationApplicant) => {
    const reason = prompt('Please specify rejection reason for the applicant:', 'Documents provided were incomplete or ineligible');
    if (!reason) return;
    try {
      await logAdminAction({
        action: 'verification_rejected',
        targetType: 'user',
        targetId: applicant.uid,
        reason
      });
      setApplicants(prev => prev.map(a => a.id === applicant.id ? { ...a, status: 'rejected' } : a));
      alert(`Verification request rejected for @${applicant.username}.`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleSendTicketReply = async (newStatus: SupportTicket['status'] = 'resolved') => {
    if (!selectedTicket) return;
    setIsSubmittingReply(true);
    try {
      // 1. Update ticket in Firestore if it exists
      try {
        await updateDoc(doc(db, 'supportTickets', selectedTicket.id), {
          adminReply: replyText,
          status: newStatus,
          repliedAt: serverTimestamp()
        });
      } catch (e) {}

      // 2. Log admin action
      await logAdminAction({
        action: 'support_ticket_resolved',
        targetType: 'ticket',
        targetId: selectedTicket.id,
        afterValue: { status: newStatus, reply: replyText },
        reason: `Support agent responded and marked as ${newStatus}`
      });

      // 3. Update local state
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? {
        ...t,
        status: newStatus,
        adminReply: replyText
      } : t));

      alert(`Resolution notification dispatched to ${selectedTicket.user} (${selectedTicket.email})!`);
      setSelectedTicket(null);
      setReplyText('');
    } catch (e: any) {
      alert(`Error submitting reply: ${e.message}`);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleAddFaq = () => {
    if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) return;
    const newItem: FAQItem = {
      id: `faq_${Date.now()}`,
      category: newFaqCategory,
      question: newFaqQuestion,
      answer: newFaqAnswer
    };
    setFaqs([newItem, ...faqs]);
    setNewFaqQuestion('');
    setNewFaqAnswer('');
    setShowAddFaqModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-gray-900 p-6 sm:p-7 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center space-x-2">
                <span>Customer Care & Help Center</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold">24/7 Operations</span>
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Manage user support tickets, grant blue verified badges, respond to inquiries, and maintain Help Center knowledge base.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Pill */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'tickets' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Support Tickets ({tickets.filter(t => t.status === 'open').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('verification')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'verification' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Blue Badge Queue ({applicants.filter(a => a.status === 'pending').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('faqs')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'faqs' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Help Center FAQs ({faqs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('hotline')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'hotline' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Care Hotline</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SUPPORT TICKETS */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                placeholder="Search ticket subject, user, email..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <div className="flex items-center space-x-1 bg-gray-50 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg ${statusFilter === 'all' ? 'bg-purple-600 text-white' : 'text-gray-500'}`}
                >
                  All Status
                </button>
                <button
                  onClick={() => setStatusFilter('open')}
                  className={`px-2.5 py-1 rounded-lg ${statusFilter === 'open' ? 'bg-amber-500 text-white' : 'text-gray-500'}`}
                >
                  Open
                </button>
                <button
                  onClick={() => setStatusFilter('in_progress')}
                  className={`px-2.5 py-1 rounded-lg ${statusFilter === 'in_progress' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                >
                  In Progress
                </button>
                <button
                  onClick={() => setStatusFilter('resolved')}
                  className={`px-2.5 py-1 rounded-lg ${statusFilter === 'resolved' ? 'bg-emerald-600 text-white' : 'text-gray-500'}`}
                >
                  Resolved
                </button>
              </div>
            </div>
          </div>

          {/* Tickets List */}
          <div className="bg-white dark:bg-gray-900 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-400 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-3.5 px-5">Ticket ID & Subject</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Received</th>
                    <th className="py-3.5 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        No support tickets match the selected filters
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-bold text-gray-900 dark:text-white text-xs max-w-xs truncate">
                            {ticket.subject}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                            {ticket.id}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-semibold text-gray-900 dark:text-white">{ticket.user}</div>
                          <div className="text-[11px] text-gray-400">{ticket.email}</div>
                        </td>

                        <td className="py-4 px-4 font-medium text-purple-600 dark:text-purple-400">
                          {ticket.category}
                        </td>

                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            ticket.priority === 'urgent' ? 'bg-red-500/10 text-red-600' :
                            ticket.priority === 'high' ? 'bg-amber-500/10 text-amber-600' :
                            'bg-blue-500/10 text-blue-600'
                          }`}>
                            {ticket.priority}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            ticket.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600' :
                            ticket.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600' :
                            'bg-amber-500/10 text-amber-600'
                          }`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-gray-400 text-[11px]">
                          {ticket.date}
                        </td>

                        <td className="py-4 px-5 text-right">
                          <button
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setReplyText(ticket.adminReply || '');
                            }}
                            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                          >
                            {ticket.status === 'resolved' ? 'View Details' : 'Reply & Solve'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BLUE BADGE VERIFICATION REQUESTS */}
      {activeTab === 'verification' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                  <span>Verified Blue Badge Applications</span>
                  <VerifiedBadge className="w-5 h-5" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Review applicant authenticity, document proof, and grant official verified status without glow or border.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-400 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-3.5 px-5">Applicant</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">ID Document</th>
                    <th className="py-3.5 px-4">Followers</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Submitted</th>
                    <th className="py-3.5 px-5 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {applicants.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5">
                      <td className="py-4 px-5">
                        <div className="font-bold text-gray-900 dark:text-white flex items-center space-x-1.5">
                          <span>{a.name}</span>
                          {a.status === 'approved' && <VerifiedBadge className="w-4 h-4" />}
                        </div>
                        <div className="text-[11px] text-gray-400">@{a.username}</div>
                      </td>

                      <td className="py-4 px-4 font-semibold text-purple-600 dark:text-purple-400">
                        {a.category}
                      </td>

                      <td className="py-4 px-4 text-gray-700 dark:text-gray-300">
                        <span className="font-medium">{a.idDocType}</span>
                      </td>

                      <td className="py-4 px-4 font-semibold text-gray-900 dark:text-white">
                        {a.followersCount?.toLocaleString() || '1,200'}
                      </td>

                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          a.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' :
                          a.status === 'rejected' ? 'bg-red-500/10 text-red-600' :
                          'bg-amber-500/10 text-amber-600'
                        }`}>
                          {a.status}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-gray-400 text-[11px]">
                        {a.date}
                      </td>

                      <td className="py-4 px-5 text-right">
                        {a.status === 'approved' ? (
                          <span className="text-xs font-bold text-emerald-600 flex items-center justify-end space-x-1">
                            <Check className="w-4 h-4" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleApproveVerification(a)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center space-x-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Grant Badge</span>
                            </button>
                            <button
                              onClick={() => handleRejectVerification(a)}
                              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HELP CENTER FAQS */}
      {activeTab === 'faqs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs">
            <span className="text-xs font-bold text-gray-500">
              Knowledge Base for In-App Customer Help Center
            </span>
            <button
              onClick={() => setShowAddFaqModal(true)}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Help Article</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {faqs.map((faq) => (
              <div
                key={faq.id}
                className="bg-white dark:bg-gray-900 p-5 rounded-[24px] border border-gray-100 dark:border-white/5 shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                    {faq.category}
                  </span>
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                </div>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white leading-snug">
                  {faq.question}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CARE HOTLINE & COMPANY LEVEL INFO */}
      {activeTab === 'hotline' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <PhoneCall className="w-6 h-6" />
            </div>
            <h3 className="font-black text-lg text-gray-900 dark:text-white">Customer Care Hotline</h3>
            <p className="text-xs text-gray-500">Official toll-free telephone support line for priority users.</p>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm font-mono font-bold text-emerald-600">
              +880 1700-000000
            </div>
            <span className="text-[11px] text-gray-400 block">Available 24 Hours • 7 Days a Week</span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="font-black text-lg text-gray-900 dark:text-white">Help Desk Email Dispatch</h3>
            <p className="text-xs text-gray-500">Automated ticket routing for security, billing, and bugs.</p>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm font-mono font-bold text-purple-600">
              ennvoapp@gmail.com
            </div>
            <span className="text-[11px] text-gray-400 block">Average response SLA: under 15 minutes</span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-black text-lg text-gray-900 dark:text-white">Trust & Safety Escalation</h3>
            <p className="text-xs text-gray-500">High-priority moderation queue for content reports & bans.</p>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm font-mono font-bold text-blue-600">
              safety@ennvo.com
            </div>
            <span className="text-[11px] text-gray-400 block">Immediate intervention protocol active</span>
          </div>
        </div>
      )}

      {/* TICKET DETAILS & REPLY MODAL */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-[32px] p-6 sm:p-7 shadow-2xl space-y-4 border border-gray-100 dark:border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-purple-600 uppercase">
                  {selectedTicket.id} • {selectedTicket.category}
                </span>
                <h3 className="font-black text-lg text-gray-900 dark:text-white">
                  {selectedTicket.subject}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedTicket(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Meta */}
            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-400">Customer:</span>
                <span className="font-bold text-gray-900 dark:text-white">{selectedTicket.user}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-400">Email:</span>
                <span>{selectedTicket.email}</span>
              </div>
              {selectedTicket.phone && (
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-400">Phone:</span>
                  <span>{selectedTicket.phone}</span>
                </div>
              )}
              {selectedTicket.deviceInfo && (
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-400">Device:</span>
                  <span>{selectedTicket.deviceInfo}</span>
                </div>
              )}
            </div>

            {/* In-depth Inquiry Message */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Customer Message
              </label>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-xs text-gray-800 dark:text-gray-200 leading-relaxed">
                {selectedTicket.message}
              </div>
            </div>

            {/* Quick Macro Buttons */}
            <div>
              <span className="text-[11px] font-bold text-gray-400 mb-1 block">Quick Answer Macros:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setReplyText('Thank you for reaching out to Ennvo Care! We have investigated the issue and resolved it on our backend servers. Please restart the app.')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-[11px] font-semibold text-gray-700 dark:text-gray-300 rounded-lg"
                >
                  "Issue Resolved"
                </button>
                <button
                  type="button"
                  onClick={() => setReplyText('Your account has been officially verified! The blue verified badge is now visible on your profile picture and posts.')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-[11px] font-semibold text-gray-700 dark:text-gray-300 rounded-lg"
                >
                  "Badge Granted"
                </button>
                <button
                  type="button"
                  onClick={() => setReplyText('Our engineering team has pushed an update to fix network buffering during high load. Please check your connection and try again.')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-[11px] font-semibold text-gray-700 dark:text-gray-300 rounded-lg"
                >
                  "Call/Video Fix"
                </button>
              </div>
            </div>

            {/* Resolution Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Staff Official Resolution Reply
              </label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type resolution message to user..."
                className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 rounded-2xl text-xs border border-gray-200 dark:border-white/10 h-28 resize-none focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-white"
              >
                Close
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={isSubmittingReply || !replyText.trim()}
                  onClick={() => handleSendTicketReply('in_progress')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                >
                  Save In Progress
                </button>

                <button
                  type="button"
                  disabled={isSubmittingReply || !replyText.trim()}
                  onClick={() => handleSendTicketReply('resolved')}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs flex items-center space-x-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark Resolved & Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD FAQ MODAL */}
      {showAddFaqModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-[32px] p-6 shadow-2xl space-y-4 border border-gray-100 dark:border-white/10">
            <h3 className="font-bold text-base text-gray-900 dark:text-white">
              Add New Help Center Article
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Category</label>
                <input
                  type="text"
                  value={newFaqCategory}
                  onChange={(e) => setNewFaqCategory(e.target.value)}
                  placeholder="e.g. Verification, Reels, Privacy"
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Question</label>
                <input
                  type="text"
                  value={newFaqQuestion}
                  onChange={(e) => setNewFaqQuestion(e.target.value)}
                  placeholder="e.g. How do I get verified?"
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Answer / Guide</label>
                <textarea
                  value={newFaqAnswer}
                  onChange={(e) => setNewFaqAnswer(e.target.value)}
                  placeholder="Provide clear steps and information..."
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10 h-24 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowAddFaqModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddFaq}
                disabled={!newFaqQuestion.trim() || !newFaqAnswer.trim()}
                className="px-4 py-2 bg-purple-600 disabled:opacity-50 hover:bg-purple-700 text-white font-bold rounded-xl text-xs"
              >
                Save Article
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


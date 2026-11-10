import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Image as ImageIcon, 
  Phone, 
  Video, 
  Minimize2, 
  Maximize2, 
  ExternalLink, 
  Mic, 
  Trash2, 
  Check, 
  CheckCheck, 
  Play, 
  Pause,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { 
  sendMessage, 
  subscribeMessages, 
  createConversation, 
  markConversationRead, 
  compressChatImageBase64,
  createClientMessageId
} from '../services/chatService';
import { subscribePresence, setTyping, subscribeTyping } from '../services/presenceService';
import { initiateCall } from '../services/callService';
import { Message } from '../types';
import { formatTime } from '../utils';
import { playMessageSentSound } from '../services/soundService';
import { VerifiedBadge } from './VerifiedBadge';

export default function MiniChat() {
  const { 
    miniChatUser, 
    setMiniChatUser, 
    currentUser, 
    pushPage, 
    setActiveChat, 
    setActiveCallState,
    setViewingUser 
  } = useAppStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const recordingIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    if (miniChatUser && currentUser) {
      const initChat = async () => {
        try {
          const id = await createConversation(
            [currentUser.uid, miniChatUser.uid],
            {
              [currentUser.uid]: { name: currentUser.name, avatar: currentUser.avatar },
              [miniChatUser.uid]: { name: miniChatUser.name, avatar: miniChatUser.avatar }
            }
          );
          setConversationId(id);
        } catch (e) {
          console.error('Failed to init mini chat conversation:', e);
        }
      };
      initChat();
      
      const unsubPresence = subscribePresence(miniChatUser.uid, (data) => {
        setIsOnline(data.isOnline);
        setLastSeen(data.lastSeen);
      });
      return () => unsubPresence();
    } else {
      setConversationId(null);
      setMessages([]);
    }
  }, [miniChatUser, currentUser]);

  useEffect(() => {
    if (conversationId && currentUser) {
      const unsubMsgs = subscribeMessages(conversationId, (msgs) => {
        setMessages(msgs);
        markConversationRead(conversationId, currentUser.uid);
      });
      const unsubTyping = subscribeTyping(conversationId, (users) => {
        setTypingUsers(users.filter(uid => uid !== currentUser.uid));
      });
      return () => { 
        unsubMsgs(); 
        unsubTyping(); 
      };
    }
  }, [conversationId, currentUser]);

  // Fix: Scroll strictly within MiniChat's internal container, never cause parent window auto-scroll
  useEffect(() => {
    if (!isMinimized && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isMinimized, typingUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!isTyping && conversationId && currentUser) {
      setIsTyping(true);
      setTyping(conversationId, currentUser.uid, true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (conversationId && currentUser) setTyping(conversationId, currentUser.uid, false);
    }, 2000);
  };

  const handleStartCall = async (type: 'audio' | 'video') => {
    if (!currentUser || !miniChatUser) return;
    try {
      const { callId } = await initiateCall(
        { uid: currentUser.uid, name: currentUser.name, avatar: currentUser.avatar },
        { uid: miniChatUser.uid, name: miniChatUser.name, avatar: miniChatUser.avatar },
        type,
        () => {},
        () => {}
      );
      setActiveCallState({
        callId,
        otherUid: miniChatUser.uid,
        otherName: miniChatUser.name,
        otherAvatar: miniChatUser.avatar,
        type,
        status: 'ringing',
        isCaller: true
      });
    } catch (err) {
      console.error('Failed to initiate call:', err);
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    recordingIntervalRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  };

  const cancelRecording = () => {
    setIsRecording(false);
    clearInterval(recordingIntervalRef.current);
    setRecordingDuration(0);
  };

  const finishRecording = async () => {
    setIsRecording(false);
    clearInterval(recordingIntervalRef.current);
    if (!conversationId || !currentUser) return;
    const dur = recordingDuration;
    setRecordingDuration(0);
    playMessageSentSound();
    await sendMessage(
      conversationId, 
      currentUser.uid, 
      'voice', 
      `Voice message (${dur}s)`, 
      undefined, 
      undefined, 
      undefined,
      { duration: dur, clientMessageId: createClientMessageId(currentUser.uid) }
    );
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId || !currentUser) return;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const rawBase64 = reader.result as string;
        const compressed = await compressChatImageBase64(rawBase64);
        playMessageSentSound();
        await sendMessage(conversationId, currentUser.uid, 'image', 'Photo', compressed, undefined, undefined, {
          clientMessageId: createClientMessageId(currentUser.uid),
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to send image in mini chat:', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !conversationId || !currentUser || isSendingRef.current) return;
    isSendingRef.current = true;
    playMessageSentSound();
    const text = inputText.trim();
    setInputText('');
    setIsTyping(false);
    setTyping(conversationId, currentUser.uid, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    try {
      await sendMessage(conversationId, currentUser.uid, 'text', text, undefined, undefined, undefined, {
        clientMessageId: createClientMessageId(currentUser.uid),
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      isSendingRef.current = false;
    }
  };

  if (!miniChatUser) return null;

  if (isMinimized) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="fixed bottom-24 sm:bottom-16 right-5 sm:right-10 z-[120] select-none"
        >
          <div className="relative group">
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="w-14 h-14 rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.25)] border-2 border-white dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-center relative cursor-pointer transition-all overflow-hidden"
              title={`Chat with ${miniChatUser.name}`}
            >
              <img
                src={miniChatUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(miniChatUser.name)}&background=random`}
                className="w-full h-full object-cover rounded-full"
                alt={miniChatUser.name}
                referrerPolicy="no-referrer"
              />
            </button>

            {/* Online Indicator */}
            <div className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-neutral-900 ${
              isOnline ? 'bg-emerald-500' : 'bg-neutral-400'
            }`} />

            {/* Close Button on Hover */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMiniChatUser(null);
              }}
              title="Close Chat"
              className="absolute -top-1 -left-1 w-5 h-5 bg-neutral-900/80 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: 50, opacity: 0, scale: 0.94 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 50, opacity: 0, scale: 0.94 }}
        transition={{ type: 'spring', damping: 26, stiffness: 380, mass: 0.6 }}
        className="fixed bottom-24 sm:bottom-16 right-5 sm:right-10 w-[calc(100%-40px)] sm:w-[350px] h-[450px] bg-white dark:bg-[#11141b] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.18)] border border-neutral-200/90 dark:border-neutral-800 z-[120] flex flex-col overflow-hidden transition-all duration-300 font-sans"
      >
        {/* Real Chat Mini Header */}
        <div 
          className="px-3.5 py-2.5 bg-white dark:bg-black border-b border-gray-200/90 dark:border-white/20 flex items-center justify-between cursor-pointer select-none transition-colors"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div 
              className="relative shrink-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setViewingUser({ uid: miniChatUser.uid, name: miniChatUser.name, avatar: miniChatUser.avatar });
                pushPage('profile');
              }}
            >
              <img 
                src={miniChatUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(miniChatUser.name)}&background=random`} 
                className="w-9 h-9 rounded-full object-cover border border-gray-200/90 dark:border-white/20" 
                alt={miniChatUser.name} 
                referrerPolicy="no-referrer"
              />
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-black ${
                isOnline ? 'bg-emerald-500' : 'bg-gray-400'
              }`} />
            </div>

            <div className="truncate">
              <div className="flex items-center space-x-1 truncate">
                <h4 className="font-semibold text-[13.5px] text-gray-900 dark:text-white truncate">
                  {miniChatUser.name}
                </h4>
                {miniChatUser.isVerified && <VerifiedBadge className="w-3.5 h-3.5" />}
              </div>
              <p className="text-[10.5px] font-medium leading-none mt-0.5 truncate">
                {isOnline ? (
                  <span className="text-emerald-500 font-semibold">Active now</span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-400">
                    {lastSeen ? `Active ${formatTime({ toMillis: () => lastSeen } as any)}` : 'Offline'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center space-x-1 shrink-0 text-gray-600 dark:text-gray-300">
            {/* Audio Call */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleStartCall('audio');
              }}
              title="Voice Call"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>

            {/* Video Call */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleStartCall('video');
              }}
              title="Video Call"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <Video className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </button>

            {/* Open Full Chat */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setActiveChat(conversationId);
                pushPage('messages');
                setMiniChatUser(null);
              }}
              title="Open full conversation"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {/* Minimize / Maximize */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }} 
              title={isMinimized ? "Expand" : "Minimize"}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setMiniChatUser(null);
              }} 
              title="Close"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-gray-500 hover:text-red-500 transition-colors" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Real Chat Message Canvas */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-gray-50/50 dark:bg-black no-scrollbar"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <img 
                    src={miniChatUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(miniChatUser.name)}&background=random`} 
                    alt={miniChatUser.name} 
                    className="w-14 h-14 rounded-full object-cover border border-gray-200/90 dark:border-white/20 mb-2"
                  />
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{miniChatUser.name}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Start your conversation</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.senderId === currentUser?.uid;
                  const isLastMsg = idx === messages.length - 1;

                  return (
                    <motion.div 
                      key={msg.id || idx} 
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16 }}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div 
                        className={`max-w-[82%] px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed break-words shadow-none ${
                          isMe 
                            ? 'bg-blue-600 text-white rounded-br-none' 
                            : 'bg-white dark:bg-black text-gray-900 dark:text-white border border-gray-200/90 dark:border dark:border-white/30 rounded-bl-none'
                        }`}
                      >
                        {/* Voice message */}
                        {msg.type === 'voice' ? (
                          <div className="flex items-center space-x-2 py-0.5 min-w-[140px]">
                            <button 
                              onClick={() => setPlayingVoiceId(playingVoiceId === msg.id ? null : (msg.id || 'voice'))}
                              className={`p-1.5 rounded-full shrink-0 ${isMe ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-white/10 text-blue-600 dark:text-white'}`}
                            >
                              {playingVoiceId === msg.id ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              )}
                            </button>
                            <div className="flex-1 flex flex-col justify-center">
                              <div className={`h-1.5 rounded-full overflow-hidden ${isMe ? 'bg-white/30' : 'bg-gray-200 dark:bg-white/20'}`}>
                                <div className={`h-full ${playingVoiceId === msg.id ? 'w-2/3 animate-pulse' : 'w-1/3'} ${isMe ? 'bg-white' : 'bg-blue-600'}`} />
                              </div>
                              <span className={`text-[9.5px] mt-0.5 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                                0:{(msg as any).replyTo?.duration || '04'}s
                              </span>
                            </div>
                          </div>
                        ) : msg.mediaUrl ? (
                          /* Image attachment */
                          <div className="rounded-xl overflow-hidden my-1">
                            <img 
                              src={msg.mediaUrl} 
                              alt="attachment" 
                              className="max-w-full max-h-[160px] object-cover rounded-xl" 
                            />
                            {msg.content && msg.content !== 'Photo' && (
                              <p className="mt-1 text-[13px]">{msg.content}</p>
                            )}
                          </div>
                        ) : (
                          /* Text message */
                          <span>{msg.content}</span>
                        )}
                      </div>

                      {/* Read receipts for sender */}
                      {isMe && isLastMsg && (
                        <div className="flex items-center space-x-1 mt-0.5 mr-1 text-[10px] text-gray-400">
                          {msg.status === 'seen' ? (
                            <>
                              <CheckCheck className="w-3 h-3 text-blue-500" />
                              <span>Seen</span>
                            </>
                          ) : msg.status === 'delivered' ? (
                            <>
                              <CheckCheck className="w-3 h-3 text-gray-400" />
                              <span>Delivered</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3 text-gray-400" />
                              <span>Sent</span>
                            </>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}

              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-black border border-gray-200/90 dark:border-white/20 rounded-2xl rounded-bl-none px-3.5 py-2 flex items-center space-x-1.5">
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-2.5 bg-white dark:bg-black border-t border-gray-200/90 dark:border-white/20 flex items-center space-x-2 relative">
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageSelect} 
              />

              <AnimatePresence>
                {isRecording ? (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="absolute inset-0 bg-white dark:bg-black flex items-center justify-between px-3.5 z-10"
                  >
                    <div className="flex items-center space-x-2 text-rose-500 animate-pulse">
                      <Mic className="w-4 h-4" />
                      <span className="font-semibold text-xs">
                        0:{recordingDuration.toString().padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={cancelRecording} 
                        className="p-1.5 text-gray-500 hover:text-rose-500 rounded-full transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={finishRecording} 
                        className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-semibold transition-transform cursor-pointer"
                      >
                        Send
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Attach Image Button */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                title="Send photo"
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors shrink-0 cursor-pointer"
              >
                <ImageIcon className="w-4.5 h-4.5 text-emerald-500" />
              </button>

              {/* Message Input Pill */}
              <div className="flex-1 bg-gray-100 dark:bg-black rounded-full flex items-center px-3.5 py-1.5 border border-gray-200/90 dark:border dark:border-white/20 focus-within:ring-1 focus-within:ring-gray-300 dark:focus-within:ring-white/30 transition-all">
                <input 
                  type="text" 
                  placeholder="Message..." 
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="w-full bg-transparent outline-none text-[13px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              {/* Send or Voice Record Button */}
              {inputText.trim() ? (
                <button 
                  onClick={handleSend}
                  className="p-2 rounded-full bg-blue-600 text-white shadow-none hover:bg-blue-700 transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button 
                  onMouseDown={startRecording}
                  title="Hold to record voice"
                  className="p-2 rounded-full bg-gray-100 dark:bg-black dark:border dark:border-white/20 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-all cursor-pointer shrink-0"
                >
                  <Mic className="w-3.5 h-3.5 text-blue-500" />
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, User } from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  increment,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { UserProfile, Message, Chat } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface ChatModalProps {
  recipient: UserProfile;
  sessionContext?: string;
  onClose: () => void;
}

export default function ChatModal({ recipient, sessionContext, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'success' | 'skipped' | 'error' | null>(null);
  const [realTimeRecipient, setRealTimeRecipient] = useState<UserProfile>(recipient);
  const user = auth.currentUser;
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatId = user ? [user.uid, recipient.uid].sort().join('_') : '';

  useEffect(() => {
    if (!recipient.uid) return;
    const unsubscribe = onSnapshot(doc(db, 'users', recipient.uid), (docSnap) => {
      if (docSnap.exists()) {
        setRealTimeRecipient(docSnap.data() as UserProfile);
      }
    });
    return () => unsubscribe();
  }, [recipient.uid]);

  useEffect(() => {
    if (!chatId || !user) return;

    // Mark messages as read and reset unread count for current user
    const chatRef = doc(db, 'chats', chatId);
    updateDoc(chatRef, {
      [`unreadCount.${user.uid}`]: 0
    }).catch(() => {
      // If chat doc doesn't exist yet, that's fine
    });

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
      setLoading(false);
      
      // Auto scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }, (error) => {
      console.error("Error fetching messages:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim() || !chatId) return;

    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const chatRef = doc(db, 'chats', chatId);

      // Add message
      const messageData: any = {
        senderId: user.uid,
        receiverId: recipient.uid,
        text,
        timestamp: serverTimestamp(),
        read: false
      };
      if (sessionContext) {
        messageData.context = sessionContext;
      }
      await addDoc(messagesRef, messageData);

      // Update chat metadata
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          participants: [user.uid, recipient.uid],
          lastMessage: {
            text,
            senderId: user.uid,
            timestamp: serverTimestamp()
          },
          unreadCount: {
            [user.uid]: 0,
            [recipient.uid]: 1
          }
        });
      } else {
        await updateDoc(chatRef, {
          lastMessage: {
            text,
            senderId: user.uid,
            timestamp: serverTimestamp()
          },
          [`unreadCount.${recipient.uid}`]: increment(1)
        });
      }

      // Send email notification via API
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient.email, // fallback if backend can't resolve it
          recipientUid: recipient.uid,
          senderName: user.displayName || 'A player',
          messageText: text,
          type: 'chat_notification'
        })
      })
      .then(async (res) => {
        if (!res.ok) {
          console.error('Email API returned an error:', await res.text());
          setEmailStatus('error');
        } else {
          const data = await res.json().catch(() => null);
          if (data && data.message && data.message.includes('skipped')) {
            setEmailStatus('skipped');
          } else {
            setEmailStatus('success');
          }
        }
        // clear status after 4 seconds
        setTimeout(() => setEmailStatus(null), 4000);
      })
      .catch(err => {
        console.error('Email notification failed:', err);
        setEmailStatus('error');
        setTimeout(() => setEmailStatus(null), 4000);
      });

    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[600px] max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
              {realTimeRecipient.photoURL ? (
                <img src={realTimeRecipient.photoURL} alt={realTimeRecipient.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={20} className="text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{realTimeRecipient.displayName}</h3>
              {realTimeRecipient.isOnline ? (
                <p className="text-xs text-green-600 font-medium flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Online
                </p>
              ) : (
                <p className="text-xs text-slate-400 font-medium">
                  {realTimeRecipient.lastSeen 
                    ? `Last seen ${formatDistanceToNow(realTimeRecipient.lastSeen.toDate(), { addSuffix: true })}`
                    : 'Offline'}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Messages area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="animate-spin text-red-600" size={24} />
              <p className="text-sm text-slate-500 font-medium">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                <Send size={24} className="text-slate-300" />
              </div>
              <h4 className="font-bold text-slate-900 mb-1">Start a conversation</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Send a message to {recipient.displayName} to coordinate your session.</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.senderId === user?.uid;
              const showDate = idx === 0 || 
                (msg.timestamp && messages[idx-1].timestamp && 
                 format(msg.timestamp.toDate(), 'yyyy-MM-dd') !== format(messages[idx-1].timestamp.toDate(), 'yyyy-MM-dd'));
              const showContext = msg.context && (idx === 0 || msg.context !== messages[idx-1].context);

              return (
                <React.Fragment key={msg.id}>
                  {showDate && msg.timestamp && (
                    <div className="flex justify-center my-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded-full border border-slate-100 shadow-sm">
                        {format(msg.timestamp.toDate(), 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  {showContext && (
                    <div className="flex justify-center my-2">
                       <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                         {msg.context}
                       </span>
                    </div>
                  )}
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                      isMe 
                        ? 'bg-red-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                    }`}>
                      <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                      <p className={`text-[10px] mt-1 text-right opacity-70 ${isMe ? 'text-white' : 'text-slate-400'}`}>
                        {msg.timestamp ? format(msg.timestamp.toDate(), 'h:mm a') : '...'}
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Input area */}
        <form onSubmit={handleSendMessage} className="relative p-4 border-t border-slate-100 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
          <AnimatePresence>
            {emailStatus === 'skipped' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute -top-10 left-0 right-0 flex justify-center pointer-events-none"
              >
                <div className="bg-amber-100 text-amber-800 text-xs px-3 py-1.5 rounded-full shadow-sm border border-amber-200">
                  Message sent! (Friend will get email alerts after their next check-in)
                </div>
              </motion.div>
            )}
            {emailStatus === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute -top-10 left-0 right-0 flex justify-center pointer-events-none"
              >
                <div className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1.5 rounded-full shadow-sm border border-emerald-200">
                  Email notification sent!
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="relative flex items-center gap-2">
            <input 
              type="text" 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 transition-all outline-none"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="bg-red-600 text-white p-3 rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 shadow-md active:scale-95"
            >
              {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

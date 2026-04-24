import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Users, Archive, Trash2, Shield, Plus, Check, User } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Group, Message, UserProfile, GroupRequest } from '../types';
import { format } from 'date-fns';

interface ChatGroupModalProps {
  group: Group;
  onClose: () => void;
}

export default function ChatGroupModal({ group, onClose }: ChatGroupModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [pendingReqs, setPendingReqs] = useState<GroupRequest[]>([]);
  const [showReqs, setShowReqs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const user = auth.currentUser;
  const isSubAdmin = user && group.admins?.includes(user.uid);
  const isGlobalAdmin = user && (user.email === 'Neo.Dink@gmail.com' || user.email === 'neo.dink@gmail.com');

  useEffect(() => {
    if (!group.id || !user) return;

    if (isSubAdmin) {
      const parentQ = query(collection(db, 'group_requests'), where('groupId', '==', group.id), where('status', '==', 'pending'));
      const unsubReqs = onSnapshot(parentQ, async (snap) => {
        const reqs: GroupRequest[] = [];
        const newUids = new Set<string>();
        snap.forEach(d => {
          const req = { id: d.id, ...d.data() } as GroupRequest;
          reqs.push(req);
          if (!profiles[req.userId]) newUids.add(req.userId);
        });
        
        setPendingReqs(reqs);
        
        if (newUids.size > 0) {
          const fetchedProfiles = { ...profiles };
          for (const uid of newUids) {
            try {
              const snap = await getDoc(doc(db, 'users', uid));
              if (snap.exists()) fetchedProfiles[uid] = snap.data() as UserProfile;
            } catch (e) {}
          }
          setProfiles(fetchedProfiles);
        }
      }, (error) => {
        console.error("Error fetching group requests:", error);
      });
      return () => unsubReqs();
    }
  }, [group.id, user, isSubAdmin]);


  useEffect(() => {
    if (!group.id || !user) return;

    if (!group.members?.includes(user.uid) && !isGlobalAdmin) {
      setLoading(false);
      return;
    }

    const messagesRef = collection(db, 'groups', group.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs: Message[] = [];
      const newUids = new Set<string>();

      snapshot.forEach(d => {
        const data = d.data() as Message;
        msgs.push({ id: d.id, ...data });
        if (!profiles[data.senderId]) newUids.add(data.senderId);
      });

      setMessages(msgs);
      setLoading(false);

      if (newUids.size > 0) {
        const fetchedProfiles = { ...profiles };
        for (const uid of newUids) {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
              fetchedProfiles[uid] = snap.data() as UserProfile;
            }
          } catch (e) {}
        }
        setProfiles(fetchedProfiles);
      }
    }, (error) => {
      console.error("Error fetching messages:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [group.id, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim() || !group.id) return;
    
    // Only members can send message
    if (!group.members.includes(user.uid)) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      const messagesRef = collection(db, 'groups', group.id, 'messages');
      const groupRef = doc(db, 'groups', group.id);
      const msgDocRef = doc(messagesRef);

      const msgData = {
        senderId: user.uid,
        text: messageText,
        timestamp: serverTimestamp(),
      };

      await setDoc(msgDocRef, msgData);
      
      await updateDoc(groupRef, {
        lastMessage: {
          text: messageText,
          senderId: user.uid,
          timestamp: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending group message:', error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm("Are you sure you want to delete this group?")) return;
    try {
      // In a real app we might delete all messages first via Cloud Function or batched write
      await deleteDoc(doc(db, 'groups', group.id));
      onClose();
    } catch (e) {
      console.error(e);
      alert("Error deleting group.");
    }
  };

  const handleAccept = async (req: GroupRequest) => {
    try {
      await updateDoc(doc(db, 'group_requests', req.id), { status: 'approved' });
      await updateDoc(doc(db, 'groups', group.id), {
        members: arrayUnion(req.userId)
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDecline = async (req: GroupRequest) => {
    try {
      await updateDoc(doc(db, 'group_requests', req.id), { status: 'declined' });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm shadow-2xl" onClick={onClose}>
      <div 
        className="w-full max-w-lg bg-white rounded-2xl overflow-hidden flex flex-col h-[600px] max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center flex-shrink-0 relative">
              <Users size={18} className="text-slate-500" />
              {isSubAdmin && (
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                  <Shield size={12} className="text-slate-400 fill-slate-200" />
                </div>
              )}
            </div>
            <div>
              <h2 className="font-bold text-slate-900">{group.name}</h2>
              <p className="text-xs text-slate-500">{group.members.length} members &bull; {group.createdBy === user?.uid ? 'You created this' : 'Group'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isSubAdmin || isGlobalAdmin) && (
              <button 
                onClick={handleDeleteGroup}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Delete Group"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white flex flex-col relative">
          {pendingReqs.length > 0 && isSubAdmin && !showReqs && (
            <div className="bg-red-50 p-2 border-b border-red-100 flex justify-between items-center text-sm sticky top-0 z-10 shrink-0 shadow-sm px-4">
              <span className="text-red-800 font-medium">{pendingReqs.length} pending join request(s)</span>
              <button onClick={() => setShowReqs(true)} className="text-red-700 font-semibold hover:underline">View</button>
            </div>
          )}
          
          {showReqs ? (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col bg-slate-50 gap-2">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-800">Pending Requests</h3>
                <button onClick={() => setShowReqs(false)} className="text-slate-500 font-medium text-xs bg-slate-200 px-2 py-1 rounded hover:bg-slate-300">Close</button>
              </div>
              {pendingReqs.map(req => {
                const p = profiles[req.userId];
                return (
                  <div key={req.id} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 overflow-hidden">
                        {p?.photoURL ? <img src={p.photoURL} alt={p.displayName} /> : <User size={16} />}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{p?.displayName || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">{p?.level}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleDecline(req)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md">
                        <X size={18} />
                      </button>
                      <button onClick={() => handleAccept(req)} className="p-1 px-3 bg-slate-900 text-white hover:bg-slate-800 rounded-md text-xs font-semibold">
                        Accept
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 p-4 flex flex-col gap-4">
              {loading ? (
                <div className="flex justify-center flex-1 items-center">
                  <Loader2 className="animate-spin text-slate-300" size={24} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                  <Users size={48} className="mb-4 opacity-50" />
                  <p>Be the first to say something to the group!</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.senderId === user?.uid;
                  const DateFormatted = msg.timestamp?.toDate ? format(msg.timestamp.toDate(), 'h:mm a') : 'Sending...';
                  const showName = !isMe && (i === 0 || messages[i-1].senderId !== msg.senderId);
                  
                  return (
                    <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                      {showName && (
                        <span className="text-[10px] text-slate-400 ml-2 mb-1">{profiles[msg.senderId]?.displayName || 'Unknown'}</span>
                      )}
                      <div className={`px-4 py-2 rounded-2xl ${
                        isMe 
                          ? 'bg-red-600 text-white rounded-tr-sm' 
                          : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-sm'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap word-break break-words">{msg.text}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 space-x-1">
                        {DateFormatted}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {!showReqs && (group.members.includes(user?.uid || '') ? (
          <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Message group..."
                className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-200 rounded-full px-4 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-sm text-slate-500">
            You must be a member to send messages to this group.
          </div>
        ))}
      </div>
    </div>
  );
}

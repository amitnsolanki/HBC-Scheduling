import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Loader2, User, Users, Shield, UserPlus, Check } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, getDoc, doc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Chat, UserProfile, Group, GroupRequest } from '../types';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

interface InboxModalProps {
  onClose: () => void;
  onOpenChat: (recipient: UserProfile) => void;
  onOpenGroup: (group: Group) => void;
}

export default function InboxModal({ onClose, onOpenChat, onOpenGroup }: InboxModalProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [otherGroups, setOtherGroups] = useState<Group[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [requests, setRequests] = useState<Record<string, GroupRequest>>({});
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    
    // 1. Fetch direct chats
    const qChats = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
    const unsubChats = onSnapshot(qChats, async (snapshot) => {
      const chatsList: Chat[] = [];
      const newUids = new Set<string>();

      snapshot.forEach(d => {
        const data = d.data() as Chat;
        chatsList.push({ id: d.id, ...data });
        const otherId = data.participants.find(p => p !== user.uid);
        if (otherId && !profiles[otherId]) newUids.add(otherId);
      });

      chatsList.sort((a, b) => {
        const tA = a.lastMessage?.timestamp?.toMillis?.() || 0;
        const tB = b.lastMessage?.timestamp?.toMillis?.() || 0;
        return tB - tA;
      });
      setChats(chatsList);

      if (newUids.size > 0) {
        setProfiles(prev => {
          const np = { ...prev };
          newUids.forEach(async uid => {
            if (!np[uid]) {
              const snap = await getDoc(doc(db, 'users', uid));
              if (snap.exists()) np[uid] = snap.data() as UserProfile;
            }
          });
          return np;
        });
      }
    }, (error) => {
      console.error("Error fetching direct chats:", error);
    });

    // 2. Fetch all groups and separate
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      const myGs: Group[] = [];
      const otherGs: Group[] = [];
      
      snapshot.forEach(d => {
        const data = d.data() as Group;
        const g = { id: d.id, ...data };
        if (g.members?.includes(user.uid)) {
          myGs.push(g);
        } else {
          otherGs.push(g);
        }
      });
      
      setMyGroups(myGs);
      setOtherGroups(otherGs);
    }, (error) => {
      console.error("Error fetching groups:", error);
    });

    // 3. Fetch my group requests
    const qReqs = query(collection(db, 'group_requests'), where('userId', '==', user.uid));
    const unsubReqs = onSnapshot(qReqs, (snapshot) => {
      const reqMap: Record<string, GroupRequest> = {};
      snapshot.forEach(d => {
        const data = d.data() as GroupRequest;
        reqMap[data.groupId] = { id: d.id, ...data };
      });
      setRequests(reqMap);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching group requests:", error);
      setLoading(false);
    });

    // Cleanup
    return () => {
      unsubChats();
      unsubGroups();
      unsubReqs();
    };
  }, [user]);

  const handleRequestJoin = async (groupId: string) => {
    if (!user) return;
    const reqId = `${groupId}_${user.uid}`;
    try {
      await setDoc(doc(db, 'group_requests', reqId), {
        id: reqId,
        groupId,
        userId: user.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
      alert('Failed to send request.');
    }
  };

  return (
    <div className="fixed inset-0 z-[50] flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-sm h-[100dvh] bg-white shadow-2xl flex flex-col pt-[72px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
          <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <MessageSquare size={20} className="text-red-600" />
            Messages
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pb-20">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-red-600" size={24} />
            </div>
          ) : (
            <>
              {/* MY GROUPS */}
              {myGroups.length > 0 && (
                <div>
                  <h3 className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">My Groups</h3>
                  <div className="divide-y divide-slate-50">
                    {myGroups.map(group => (
                      <button 
                        key={group.id}
                        onClick={() => { onClose(); onOpenGroup(group); }}
                        className="w-full p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex flex-col items-center justify-center flex-shrink-0 border border-red-200">
                          <Users size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <span className="text-sm font-semibold truncate text-slate-900 flex items-center gap-1">
                              {group.name}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 truncate">
                            {group.lastMessage ? group.lastMessage.text : 'Tap to open group'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* DIRECT MESSAGES */}
              {chats.length > 0 && (
                <div>
                  <h3 className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">Direct Messages</h3>
                  <div className="divide-y divide-slate-50">
                    {chats.map(chat => {
                      const otherUid = chat.participants.find(p => p !== user?.uid);
                      const profile = otherUid ? profiles[otherUid] : null;
                      const unread = chat.unreadCount?.[user?.uid || ''] || 0;

                      if (!profile) return null;

                      return (
                        <button 
                          key={chat.id}
                          onClick={() => { onClose(); onOpenChat(profile); }}
                          className="w-full p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
                              {profile.photoURL ? (
                                <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                                  <User size={20} />
                                </div>
                              )}
                            </div>
                            {unread > 0 && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                                <span className="text-[9px] text-white font-bold">{unread}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-0.5">
                              <span className={`text-sm font-semibold truncate pr-2 ${unread > 0 ? 'text-slate-900' : 'text-slate-700'}`}>
                                {profile.displayName || 'Unknown Player'}
                              </span>
                              {chat.lastMessage?.timestamp?.toDate && (
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                  {formatDistanceToNow(chat.lastMessage.timestamp.toDate(), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                            <p className={`text-sm truncate ${unread > 0 ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                              {chat.lastMessage?.senderId === user?.uid && 'You: '}
                              {chat.lastMessage?.text || 'No messages'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DISCOVER GROUPS */}
              {otherGroups.length > 0 && (
                <div>
                  <h3 className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">Discover Groups</h3>
                  <div className="divide-y divide-slate-50">
                    {otherGroups.map(group => {
                      const req = requests[group.id];
                      return (
                        <button 
                          key={group.id}
                          onClick={() => { onClose(); onOpenGroup(group); }}
                          className="w-full p-4 flex flex-col gap-3 transition-colors text-left bg-white grayscale opacity-80 hover:bg-slate-50 cursor-pointer"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex flex-col items-center justify-center flex-shrink-0">
                              <Users size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-bold text-slate-900 block truncate">
                                {group.name}
                              </span>
                              {group.description && (
                                <p className="text-xs text-slate-500 mt-0.5 max-h-8 overflow-hidden">
                                  {group.description}
                                </p>
                              )}
                              <p className="text-xs text-slate-400 mt-1">{group.members?.length || 0} members</p>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            {req?.status === 'pending' ? (
                              <button disabled className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 cursor-default">
                                <Loader2 size={12} className="animate-spin" /> Requested
                              </button>
                            ) : req?.status === 'declined' ? (
                              <span className="text-xs text-red-500 font-semibold px-2 py-1">Declined</span>
                            ) : (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRequestJoin(group.id); }}
                                className="bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors"
                              >
                                <UserPlus size={14} /> Request to Join
                              </button>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {chats.length === 0 && myGroups.length === 0 && otherGroups.length === 0 && (
                <div className="p-8 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                    <MessageSquare className="text-slate-300" size={24} />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">No messages yet</h3>
                  <p className="text-sm text-slate-500">Create a group or reach out to players.</p>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

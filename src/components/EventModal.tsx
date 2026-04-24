import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, subMinutes, addMinutes, isBefore, isEqual, parse } from 'date-fns';
import { X, Loader2, Trash2, User, BarChart2, List, Shield, MessageSquare } from 'lucide-react';
import { BookingResult, UserProfile, SkillLevel, Chat } from '../types';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import PlayerProfileModal from './PlayerProfileModal';
import PlayerAvatar from './PlayerAvatar';
import ChatModal from './ChatModal';

const LEVEL_ORDER = {
  'National': 1,
  'Advanced': 2,
  'Intermediate-Advanced': 3,
  'Intermediate': 4,
  'Intermediate-Beginner': 5,
  'Beginner': 6,
  'Unknown': 7
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface EventModalProps {
  event: BookingResult;
  onClose: () => void;
}

interface Signup {
  id: string;
  eventId: number;
  uid: string;
  name: string;
  arrivalTime?: string;
  duration?: string;
  level?: string; // For backward compatibility
  time?: string; // For backward compatibility
  createdAt: any;
}

export default function EventModal({ event, onClose }: EventModalProps) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [showPlot, setShowPlot] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  const [selectedPlayer, setSelectedPlayer] = useState<UserProfile | null>(null);
  const [selectedChatRecipient, setSelectedChatRecipient] = useState<UserProfile | null>(null);
  const [selectedChatContext, setSelectedChatContext] = useState<string | undefined>();
  const [chats, setChats] = useState<Record<string, Chat>>({});
  const navigate = useNavigate();

  // Listen to chats for unread indicators
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatMap: Record<string, Chat> = {};
      snapshot.forEach(doc => {
        chatMap[doc.id] = { id: doc.id, ...doc.data() } as Chat;
      });
      setChats(chatMap);
    });
    return () => unsubscribe();
  }, [user]);

  // Form state
  const [playerName, setPlayerName] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [duration, setDuration] = useState('');

  const timeOptions = useMemo(() => {
    try {
      const start = subMinutes(parseISO(event.EventStart), 15);
      const end = subMinutes(parseISO(event.EventEnd), 30);
      const options = [];
      let current = start;

      while (isBefore(current, end) || isEqual(current, end)) {
        options.push(format(current, 'h:mm a'));
        current = addMinutes(current, 15);
      }
      return options;
    } catch (e) {
      return [];
    }
  }, [event.EventStart, event.EventEnd]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const profile = docSnap.data();
            if (!playerName) setPlayerName(profile.displayName || currentUser.displayName || 'Anonymous Player');
          } else {
            if (!playerName) setPlayerName(currentUser.displayName || 'Anonymous Player');
          }
        } catch (e) {
          if (!playerName) setPlayerName(currentUser.displayName || 'Anonymous Player');
        }
      }
    });
    return () => unsubscribe();
  }, [playerName]);

  useEffect(() => {
    const q = query(collection(db, 'signups'), where('eventId', '==', event.Id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Signup[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Signup);
      });
      // Sort by creation time
      data.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return a.createdAt.toMillis() - b.createdAt.toMillis();
      });
      setSignups(data);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching signups:", err);
      setError("Failed to load signups.");
      setLoading(false);
      try {
        handleFirestoreError(err, OperationType.LIST, 'signups');
      } catch (e) {
        // Error already logged and thrown by handleFirestoreError
      }
    });

    return () => unsubscribe();
  }, [event.Id]);

  useEffect(() => {
    const fetchProfiles = async () => {
      const uids: string[] = Array.from(new Set(signups.map(s => s.uid)));
      const profiles: Record<string, any> = { ...userProfiles };
      let fetched = false;
      for (const uid of uids) {
        if (!profiles[uid]) {
          try {
            const d = await getDoc(doc(db, 'users', uid));
            if (d.exists()) {
              profiles[uid] = d.data();
              fetched = true;
            }
          } catch (e) {}
        }
      }
      if (fetched) {
        setUserProfiles(profiles);
      }
    };
    if (signups.length > 0) {
      fetchProfiles();
    }
  }, [signups]);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if user has a profile
      if (result.user) {
        const docRef = doc(db, 'users', result.user.uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          // Close modal and redirect to profile
          onClose();
          navigate('/profile', { 
            state: { message: 'Welcome! Please take a moment to complete your profile so others can know your play style and level.' } 
          });
        }
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in was cancelled. Please try again and complete the Google sign-in process.");
      } else if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        setError(
          <div className="flex flex-col gap-2 text-left">
            <p className="font-bold text-red-800">Firebase Configuration Required</p>
            <p>Google blocks sign-ins from unknown websites to prevent phishing. You must authorize this exact URL in your Firebase Console.</p>
            <ol className="list-decimal ml-4 space-y-1 mt-1 text-sm">
              <li>Go to <strong>Firebase Console</strong> &gt; <strong>Authentication</strong> &gt; <strong>Settings</strong> &gt; <strong>Authorized domains</strong></li>
              <li>Click <strong>Add domain</strong></li>
              <li>Copy and paste this exact domain:<br/>
                <code className="bg-red-100 text-red-900 px-1.5 py-0.5 rounded select-all font-mono mt-1 inline-block border border-red-200">
                  {window.location.hostname}
                </code>
              </li>
            </ol>
          </div>
        );
      } else {
        setError(`Failed to sign in: ${err.message || err}`);
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!playerName || !arrivalTime || !duration) {
      setError("Please fill in all fields.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const docId = `${user.uid}_${event.Id}`;
      const signupRef = doc(db, 'signups', docId);
      
      let arrivalDateTimeMillis = 0;
      try {
        const arrivalDateObj = parse(arrivalTime, 'h:mm a', parseISO(event.EventStart));
        arrivalDateTimeMillis = arrivalDateObj.getTime();
      } catch (err) {
        console.error("Could not parse arrival time", err);
      }

      if (mySignup) {
        await updateDoc(signupRef, {
          arrivalTime,
          arrivalDateTimeMillis,
          duration,
          name: playerName,
          email: user.email || ''
        });
      } else {
        await setDoc(signupRef, {
          eventId: event.Id,
          uid: user.uid,
          name: playerName,
          email: user.email || '',
          arrivalTime,
          arrivalDateTimeMillis,
          duration,
          createdAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err.message || "Failed to sign up.");
      try {
        handleFirestoreError(err, OperationType.CREATE, `signups/${user.uid}_${event.Id}`);
      } catch (e) {}
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'signups', docId));
    } catch (err: any) {
      console.error("Delete error:", err);
      setError(err.message || "Failed to remove signup.");
      try {
        handleFirestoreError(err, OperationType.DELETE, `signups/${docId}`);
      } catch (e) {}
    }
  };

  const mySignup = signups.find(s => s.uid === user?.uid);

  useEffect(() => {
    if (mySignup) {
      if (mySignup.arrivalTime) setArrivalTime(mySignup.arrivalTime);
      if (mySignup.duration) setDuration(mySignup.duration);
    }
  }, [mySignup]);

  const isCancelled = event.StatusTypeId === -12;

  const plotData = useMemo(() => {
    const eventStart = parseISO(event.EventStart);
    const eventEnd = parseISO(event.EventEnd);
    
    const data = signups.map(s => {
      const profile = userProfiles[s.uid];
      const level = s.level || profile?.level || 'Unknown';
      
      let start = eventStart;
      if (s.arrivalTime) {
        const parsedTime = parse(s.arrivalTime, 'h:mm a', eventStart);
        if (!isNaN(parsedTime.getTime())) start = parsedTime;
      } else if (s.time) {
        const parsedTime = parse(s.time, 'h:mm a', eventStart);
        if (!isNaN(parsedTime.getTime())) start = parsedTime;
      }

      let end = eventEnd;
      if (s.duration && s.duration !== 'Until closing') {
        let mins = 0;
        if (s.duration.includes('hr')) {
          const val = parseFloat(s.duration.replace('hr', ''));
          mins = val * 60;
        } else if (s.duration.includes('min')) {
          const val = parseInt(s.duration.replace('min', ''));
          mins = val;
        }
        if (mins > 0) {
          end = addMinutes(start, mins);
        }
      }
      
      if (isBefore(eventEnd, end)) end = eventEnd;
      if (isBefore(start, eventStart)) start = eventStart;
      
      return {
        ...s,
        level,
        start,
        end
      };
    });
    
    data.sort((a, b) => {
      const orderA = LEVEL_ORDER[a.level as keyof typeof LEVEL_ORDER] || 7;
      const orderB = LEVEL_ORDER[b.level as keyof typeof LEVEL_ORDER] || 7;
      if (orderA !== orderB) return orderA - orderB;
      return a.start.getTime() - b.start.getTime();
    });
    
    return data;
  }, [signups, userProfiles, event.EventStart, event.EventEnd]);

  const renderPlot = () => {
    const eventStart = parseISO(event.EventStart);
    const eventEnd = parseISO(event.EventEnd);
    const totalDurationMs = eventEnd.getTime() - eventStart.getTime();
    
    // Generate time markers (every 30 mins)
    const markers = [];
    let current = eventStart;
    while (isBefore(current, eventEnd) || isEqual(current, eventEnd)) {
      markers.push(current);
      current = addMinutes(current, 30);
    }

    const getLeftPercent = (time: Date) => {
      const diff = time.getTime() - eventStart.getTime();
      return Math.max(0, Math.min(100, (diff / totalDurationMs) * 100));
    };
    
    const getWidthPercent = (start: Date, end: Date) => {
      const diff = end.getTime() - start.getTime();
      return Math.max(0, Math.min(100, (diff / totalDurationMs) * 100));
    };

    const getLevelColor = (level: string) => {
      switch(level) {
        case 'National': return 'bg-purple-500';
        case 'Advanced': return 'bg-red-500';
        case 'Intermediate-Advanced': return 'bg-orange-500';
        case 'Intermediate': return 'bg-yellow-500';
        case 'Intermediate-Beginner': return 'bg-green-500';
        case 'Beginner': return 'bg-blue-500';
        default: return 'bg-slate-400';
      }
    };

    return (
      <div className="mt-4 overflow-x-auto pb-4">
        <div className="min-w-[500px]">
          {/* X-axis (Time) */}
          <div className="relative h-6 border-b border-slate-200 mb-2">
            {markers.map((m, i) => (
              <div 
                key={i} 
                className="absolute text-[10px] text-slate-500 -translate-x-1/2"
                style={{ left: `${getLeftPercent(m)}%` }}
              >
                {format(m, 'h:mm a')}
                <div className="h-2 w-px bg-slate-200 mx-auto mt-1"></div>
              </div>
            ))}
          </div>
          
          {/* Y-axis (Players) */}
          <div className="space-y-2 relative pt-2">
            {/* Grid lines */}
            {markers.map((m, i) => (
              <div 
                key={`grid-${i}`} 
                className="absolute top-0 bottom-0 w-px bg-slate-100 -z-10"
                style={{ left: `${getLeftPercent(m)}%` }}
              ></div>
            ))}
            
            {plotData.map((p, i) => (
              <div key={p.id} className="relative h-8 flex items-center group">
                <div 
                  className={`absolute h-6 rounded-md shadow-sm flex items-center px-2 overflow-hidden transition-all ${getLevelColor(p.level)} text-white text-xs font-medium whitespace-nowrap`}
                  style={{ 
                    left: `${getLeftPercent(p.start)}%`, 
                    width: `${getWidthPercent(p.start, p.end)}%`,
                    minWidth: 'fit-content'
                  }}
                  title={`${p.name} (${p.level}) | ${format(p.start, 'h:mm a')} - ${format(p.end, 'h:mm a')}`}
                >
                  <span className="truncate">{p.name} <span className="opacity-75 font-normal ml-1 hidden sm:inline">({p.level})</span></span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-3 text-[10px] text-slate-600 justify-center">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-black"></div>National</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-500"></div>Advanced</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-orange-500"></div>Int-Adv</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-500"></div>Intermediate</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-yellow-400"></div>Int-Beg</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-blue-500"></div>Beginner</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-slate-400"></div>Unknown</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 md:p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Mobile drag handle indicator */}
        <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isCancelled ? '(CANCELLED) ' : ''}{event.EventName}
            </h2>
            {(() => {
              const eventDate = parseISO(event.EventStart);
              const isSunday = eventDate.getDay() === 0;
              const isClub = event.EventName.toLowerCase().includes('club');
              const isGSD = event.EventName.toLowerCase().includes('gsd');
              
              if (isGSD) {
                return <p className="text-sm font-bold text-red-600 mt-1">Design School Members Only</p>;
              } else if (isClub) {
                if (isSunday) {
                  return <p className="text-sm font-bold text-green-600 mt-1">Open for All Members</p>;
                } else {
                  return <p className="text-sm font-bold text-red-600 mt-1">Undergrad Club Only</p>;
                }
              }
              return null;
            })()}
            <p className="text-sm text-slate-500 mt-1">
              {format(parseISO(event.EventStart), 'EEEE, MMM d')} • {format(parseISO(event.EventStart), 'h:mm a')} - {format(parseISO(event.EventEnd), 'h:mm a')}
            </p>
            {event.Location && (
              <p className="text-xs text-slate-400 mt-1">
                📍 {event.Location.replace(/MalkinAthleticCenter - MAC /g, '').replace(/MalkinAthleticCenter - /g, '')}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 pb-8 md:pb-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
              {error}
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Who's Playing ({signups.length})</h3>
              {signups.length > 0 && (
                <button 
                  onClick={() => setShowPlot(!showPlot)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors shadow-sm"
                >
                  {showPlot ? <List size={14} /> : <BarChart2 size={14} />}
                  {showPlot ? 'List View' : 'Plot View'}
                </button>
              )}
            </div>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-slate-400" size={24} />
              </div>
            ) : signups.length === 0 ? (
              <p className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-lg text-center">No one has signed up yet. Be the first!</p>
            ) : showPlot ? (
              renderPlot()
            ) : (
              <ul className="space-y-2">
                {signups.map(s => {
                  const profile = userProfiles[s.uid];
                  return (
                    <li 
                      key={s.id} 
                      className={`flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100 ${profile ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''}`}
                      onClick={() => {
                        if (profile) {
                          setSelectedPlayer(profile as UserProfile);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <PlayerAvatar 
                            photoURL={profile?.photoURL} 
                            displayName={s.name} 
                            role={profile?.role}
                            level={profile?.level || s.level as SkillLevel}
                            playStyles={profile?.playStyles}
                            size="sm"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-500">
                            {s.arrivalTime ? `Arriving at ${s.arrivalTime} for ${s.duration}` : `${s.level} • Planning to go at ${s.time}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user && s.uid !== user.uid && profile && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedChatContext(`${format(parseISO(event.EventStart), 'MMM do')} session - ${event.EventName}`);
                              setSelectedChatRecipient(profile as UserProfile);
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-full transition-all relative group"
                            title={`Chat with ${s.name}`}
                          >
                            <MessageSquare size={18} />
                            {(() => {
                              const chatId = [user.uid, s.uid].sort().join('_');
                              const unread = chats[chatId]?.unreadCount?.[user.uid] || 0;
                              if (unread > 0) {
                                return (
                                  <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-600 text-[8px] text-white flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-sm">
                                    {unread}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </button>
                        )}
                        {user && s.uid === user.uid && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(s.id);
                            }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Remove my signup"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {!isCancelled && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{mySignup ? 'Modify your Session' : 'Join the Session'}</h3>
              {!user ? (
                <button 
                  onClick={handleSignIn}
                  className="w-full py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Sign in with Google to join
                </button>
              ) : (
                <form onSubmit={handleSignup} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Arrival Time *</label>
                      <select 
                        value={arrivalTime}
                        onChange={e => setArrivalTime(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        required
                      >
                        <option value="">Select time</option>
                        {timeOptions.map((t, i) => (
                          <option key={i} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Play Duration *</label>
                      <select 
                        value={duration}
                        onChange={e => setDuration(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        required
                      >
                        <option value="">Select duration</option>
                        <option value="Until closing">Until closing</option>
                        <option value="30min">30min</option>
                        <option value="1hr">1hr</option>
                        <option value="1.5hr">1.5hr</option>
                        <option value="2hr">2hr</option>
                        <option value="2.5hr">2.5hr</option>
                        <option value="3hr">3hr</option>
                        <option value="3.5hr">3.5hr</option>
                        <option value="4hr">4hr</option>
                        <option value="4.5hr">4.5hr</option>
                        <option value="5hr">5hr</option>
                      </select>
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={submitting || (mySignup && mySignup.arrivalTime === arrivalTime && mySignup.duration === duration)}
                    className="w-full py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-70 flex justify-center items-center"
                  >
                    {submitting ? <Loader2 className="animate-spin" size={18} /> : mySignup ? 'Update Session' : 'Sign Up'}
                  </button>
                  {mySignup && (
                    <div className="text-xs text-green-700 text-center font-medium mt-2">
                      You are signed up! Change options above to update.
                    </div>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {selectedPlayer && (
          <PlayerProfileModal 
            player={selectedPlayer} 
            onClose={() => setSelectedPlayer(null)} 
          />
        )}
        {selectedChatRecipient && (
          <ChatModal 
            recipient={selectedChatRecipient} 
            sessionContext={selectedChatContext}
            onClose={() => {
              setSelectedChatRecipient(null);
              setSelectedChatContext(undefined);
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

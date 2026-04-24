import { Link } from 'react-router-dom';
import { Calendar as CalendarIcon, User, LogIn, Search, MessageSquare } from 'lucide-react';
import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import PlayerAvatar from './PlayerAvatar';

export default function Header({ profileComplete = true, onOpenInbox }: { profileComplete?: boolean, onOpenInbox?: () => void }) {
  const [user, setUser] = useState(auth.currentUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    let unsubscribeChats: () => void;

    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
        } catch (error) {
          console.error('Error fetching profile for header:', error);
        }

        const q = query(collection(db, 'chats'), where('participants', 'array-contains', u.uid));
        unsubscribeChats = onSnapshot(q, (snapshot) => {
          let total = 0;
          snapshot.forEach(doc => {
            const data = doc.data();
            total += (data.unreadCount?.[u.uid] || 0);
          });
          setUnreadTotal(total);
        });

      } else {
        setProfile(null);
        setUnreadTotal(0);
        if (unsubscribeChats) unsubscribeChats();
      }
    });
    return () => {
      unsubscribe();
      if (unsubscribeChats) unsubscribeChats();
    }
  }, []);

  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        setAlertMessage('Sign-in was cancelled. Please try again and complete the Google sign-in process.');
      } else {
        setAlertMessage(error.message || 'An error occurred during sign in. Please try again.');
      }
    }
  };

  const getAbbrev = (level?: string) => {
    switch(level) {
      case 'National': return 'N';
      case 'Advanced': return 'A';
      case 'Intermediate-Advanced': return 'AI';
      case 'Intermediate': return 'I';
      case 'Intermediate-Beginner': return 'IB';
      case 'Beginner': return 'B';
      default: return '';
    }
  };

  const displayName = profile?.displayName || user?.displayName || 'Player';
  const profileText = displayName;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:h-16 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
        <Link 
          to={profileComplete ? "/" : "/profile"} 
          className={`flex items-center gap-3 w-full md:w-auto justify-center md:justify-start hover:opacity-90 transition-opacity ${!profileComplete && user ? 'pointer-events-none' : ''}`}
        >
          <div className="flex-shrink-0">
            <img 
              src="/logo.png" 
              alt="HBC Club Logo" 
              className="w-12 h-12 md:w-14 md:h-14 rounded-full shadow-sm border border-slate-100"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col items-center md:items-start">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 leading-none">
              HBC Club | Badminton Scheduling
            </h1>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">Live Schedule Fetched Every 4 hrs</span>
            </div>
          </div>
        </Link>
        
        <div className="flex items-center gap-2 sm:gap-4 w-full md:w-auto justify-center md:justify-end mt-1 md:mt-0">
          {profileComplete && (
            <Link 
              to="/players" 
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Search size={16} />
              <span className="hidden sm:inline">Players</span>
            </Link>
          )}
          
          {profileComplete && (user?.email?.toLowerCase() === 'neo.dink@gmail.com' || profile?.role === 'admin') && (
            <Link 
              to="/admin" 
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
            >
              Admin
            </Link>
          )}
          
          {user ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={onOpenInbox}
                className="relative p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-full transition-colors"
                title="Messages"
              >
                <MessageSquare size={20} />
                {unreadTotal > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-[9px] text-white flex items-center justify-center rounded-full border-2 border-white shadow-sm font-bold">
                    {unreadTotal > 9 ? '9+' : unreadTotal}
                  </span>
                )}
              </button>
              <Link 
                to="/profile" 
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors ${!profileComplete ? 'ring-2 ring-red-500 animate-pulse' : ''}`}
              >
                <PlayerAvatar 
                  photoURL={profile?.photoURL || user.photoURL} 
                  displayName={profileText} 
                  role={profile?.role}
                  level={profile?.level}
                  playStyles={profile?.playStyles}
                  size="xs"
                />
                <span className="hidden sm:inline">{profileText}</span>
              </Link>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
            >
              <LogIn size={16} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
      
      {alertMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Notice</h3>
            <p className="text-slate-600 mb-6">{alertMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setAlertMessage(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

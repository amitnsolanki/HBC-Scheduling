import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import Header from './components/Header';
import CalendarPage from './pages/CalendarPage';
import ProfilePage from './pages/ProfilePage';
import PlayersDirectory from './pages/PlayersDirectory';
import AdminPage from './pages/AdminPage';
import AnalyticsPage from './pages/AnalyticsPage';
import { UserProfile, Group } from './types';
import { seedGear } from './seedData';
import InboxModal from './components/InboxModal';
import ChatModal from './components/ChatModal';
import ChatGroupModal from './components/ChatGroupModal';
import { AnimatePresence } from 'motion/react';
import versionData from './version.json';

export default function App() {
  const [user, setUser] = useState<any>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showLoginPopup, setShowLoginPopup] = useState(true);
  
  // Custom modals
  const [showInbox, setShowInbox] = useState(false);
  const [inboxChatRecipient, setInboxChatRecipient] = useState<UserProfile | null>(null);
  const [inboxGroup, setInboxGroup] = useState<Group | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Seed gear data once if empty
    seedGear();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setLoadingProfile(true); // Must set this BEFORE setUser so the complete-check effect doesn't fire prematurely
        setUser(u);
        setShowLoginPopup(false);
      } else {
        setUser(u);
        setProfile(null);
        setLoadingProfile(false);
        setShowLoginPopup(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        // Auto-save email to Firestore if it's missing (needed for notifications)
        if (!data.email && user.email) {
          import('firebase/firestore').then(({ setDoc, doc }) => {
            setDoc(doc(db, 'users', user.uid), { email: user.email }, { merge: true });
          });
        }
        setProfile(data);
      } else {
        setProfile(null);
      }
      setLoadingProfile(false);
    }, (error) => {
      console.error('Error fetching profile in App:', error);
      setLoadingProfile(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Real-time presence system
  useEffect(() => {
    if (!user || user.uid === undefined) return;
    // We only want to set online status if profile is loaded and exists
    if (!profile) return;

    const userRef = doc(db, 'users', user.uid);

    const updatePresence = async (isOnline: boolean) => {
      try {
        await updateDoc(userRef, {
          isOnline,
          lastSeen: serverTimestamp()
        });
      } catch (e) {
        // fail silently if profile doesn't exist
      }
    };

    // Initially online
    updatePresence(true);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence(true);
      } else {
        updatePresence(false);
      }
    };

    const handleBeforeUnload = () => updatePresence(false);

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePresence(false);
    };
  }, [user, profile?.uid]);

  const isProfileComplete = (p: UserProfile | null) => {
    if (!p) return false;
    const hasBasicInfo = p.displayName && p.level && p.gender && p.dominantHand && (p.styleOfPlay && p.styleOfPlay.length > 0);
    const hasPlayStyles = p.playStyles && p.playStyles.some(style => style.preference > 0) && 
                         p.playStyles.every(style => style.preference === 0 || (style.preference > 0 && style.level));
    return !!(hasBasicInfo && hasPlayStyles);
  };

  const complete = isProfileComplete(profile);

  useEffect(() => {
    if (user && !loadingProfile && !complete && location.pathname !== '/profile') {
      navigate('/profile', { 
        state: { message: 'Please complete your profile to access all features.' } 
      });
    }
  }, [user, loadingProfile, complete, location.pathname, navigate]);

  const handleGlobalSignIn = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        const docRef = doc(db, 'users', result.user.uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          navigate('/profile', { 
            state: { message: 'Welcome! Please fill out your profile to the best of your knowledge so others know your play style and level.' } 
          });
        }
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in was cancelled. Please try again and complete the Google sign-in process.');
      } else {
        setAuthError(error.message || 'An error occurred during sign in. Please try again.');
      }
    }
  };

  if (user === undefined || (user && loadingProfile)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-red-600" size={48} />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] flex flex-col bg-slate-50 text-slate-900 font-sans overflow-x-hidden">
      <Header profileComplete={complete} onOpenInbox={() => setShowInbox(true)} />
      
      <main className="relative flex-1 flex flex-col">
        {/* Grey Ash Sheen View-Only Overlay */}
        {!user && (
          <div 
            className="absolute inset-0 z-40 bg-slate-800/10 backdrop-grayscale-[0.85] backdrop-contrast-125 cursor-pointer transition-all duration-500 flex items-center justify-center p-4 group"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowLoginPopup(true);
            }}
            title="Sign in to interact with the schedule"
          >
            {/* Optional subtle floating prompt that only appears on hover of the disabled area */}
            <div className="fixed top-24 origin-top bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border border-slate-200 text-slate-700 font-medium text-sm flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300 pointer-events-none">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Click anywhere to sign in and interact
            </div>
          </div>
        )}

        <div className={!user ? "pointer-events-none select-none opacity-80" : ""}>
          <Routes>
            <Route path="/" element={(!user || complete) ? <CalendarPage /> : <ProfilePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/players" element={(!user || complete) ? <PlayersDirectory /> : <ProfilePage />} />
            <Route path="/admin" element={(!user || complete) ? <AdminPage /> : <ProfilePage />} />
            <Route path="/admin/edit-user/:uid" element={(!user || complete) ? <ProfilePage /> : <ProfilePage />} />
            <Route path="/admin/analytics" element={(!user || complete) ? <AnalyticsPage /> : <ProfilePage />} />
          </Routes>
        </div>
      </main>
      
      {!user && showLoginPopup && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowLoginPopup(false)}
        >
          <div 
            className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl text-center max-w-md w-full border border-slate-100 relative my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowLoginPopup(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="w-28 h-28 mx-auto mb-6">
              <img 
                src="/logo.png" 
                alt="HBC Club Logo" 
                className="w-full h-full rounded-full shadow-md border border-slate-100"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Welcome to HBC Club</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">Please sign in to view the live schedule, join sessions, and connect with other players.</p>
            
            {authError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-left">
                <p className="font-semibold mb-1">Sign in failed</p>
                <p>{authError}</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleGlobalSignIn}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
              
              <button 
                onClick={() => setShowLoginPopup(false)}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-slate-600 font-semibold rounded-xl hover:bg-slate-50 border border-slate-200 transition-all active:scale-[0.98]"
              >
                Cancel / View Only
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showInbox && (
          <InboxModal 
            onClose={() => setShowInbox(false)} 
            onOpenChat={(recipient) => {
              setInboxChatRecipient(recipient);
              setShowInbox(false);
            }} 
            onOpenGroup={(group) => {
              setInboxGroup(group);
              setShowInbox(false);
            }}
          />
        )}
        
        {inboxChatRecipient && (
          <ChatModal 
            recipient={inboxChatRecipient} 
            onClose={() => {
              setInboxChatRecipient(null);
            }} 
          />
        )}

        {inboxGroup && (
          <ChatGroupModal
            group={inboxGroup}
            onClose={() => {
              setInboxGroup(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Fancy Version Number Badge */}
      <div className="fixed bottom-4 right-4 z-40 pointer-events-none">
        <div className="bg-white/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/60 shadow-sm flex items-center gap-2 group transition-all duration-300">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500/80 group-hover:text-slate-700 transition-colors">
            Ver {versionData.version.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

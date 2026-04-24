import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { UserProfile, SkillLevel, Racket, Shoe, BadmintonString, PlayStylePreference } from '../types';
import { Loader2, Save, Plus, Trash2, CheckCircle2, AlertCircle, LogOut, Camera, Image as ImageIcon } from 'lucide-react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { compressImage, getLevelTextColorClass } from '../lib/utils';
import GearAutocomplete from '../components/GearAutocomplete';
import PlayerAvatar from '../components/PlayerAvatar';

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export default function ProfilePage() {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [errorField, setErrorField] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { uid: targetUid } = useParams<{ uid: string }>();
  const [isAdmin, setIsAdmin] = useState(false);

  const displayNameRef = React.useRef<HTMLInputElement>(null);
  const levelRef = React.useRef<HTMLSelectElement>(null);
  const genderRef = React.useRef<HTMLSelectElement>(null);
  const dominantHandRef = React.useRef<HTMLSelectElement>(null);
  const styleOfPlayRef = React.useRef<HTMLDivElement>(null);
  const playStylesRef = React.useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<Partial<UserProfile>>({
    level: '' as SkillLevel,
    gender: 'Male',
    rackets: [],
    shoes: [],
    strings: [],
    playStyles: [
      { style: 'Singles', preference: 0, level: '' },
      { style: 'Doubles', preference: 0, level: '' },
      { style: 'Mixed', preference: 0, level: '' }
    ],
    styleOfPlay: [],
    dominantHand: '',
    playingSince: new Date().getFullYear(),
    homeClub: '',
    bio: ''
  });

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
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
  };

  useEffect(() => {
    // Validate connection to Firestore as per critical directive
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    if (location.state?.message) {
      setMessage({ text: location.state.message, type: 'success' });
      // Clear state so it doesn't persist on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (!u) {
        navigate('/');
      } else {
        // Check if admin
        let adminStatus = false;
        if (u.email?.toLowerCase() === 'neo.dink@gmail.com') {
          adminStatus = true;
        } else {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().role === 'admin') {
            adminStatus = true;
          }
        }
        setIsAdmin(adminStatus);

        const uidToFetch = targetUid && adminStatus ? targetUid : u.uid;
        fetchProfile(uidToFetch);
      }
    });
    return () => unsubscribe();
  }, [navigate, targetUid]);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile({
          ...data,
          gender: data.gender || 'Male',
          playStyles: data.playStyles || [
            { style: 'Singles', preference: 0, level: '' },
            { style: 'Doubles', preference: 0, level: '' },
            { style: 'Mixed', preference: 0, level: '' }
          ]
        });
      } else {
        // Initialize with default values if no profile exists
        setProfile(prev => ({
          ...prev,
          uid,
          displayName: targetUid ? 'New User' : (auth.currentUser?.displayName || ''),
          photoURL: targetUid ? '' : (auth.currentUser?.photoURL || ''),
          gender: 'Male'
        }));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const base64Image = await compressImage(file, 400, 400, 0.7);
      setProfile(prev => ({ ...prev, photoURL: base64Image }));
    } catch (error) {
      console.error('Error compressing image:', error);
      setMessage({ text: 'Failed to process image.', type: 'error' });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!profile.displayName) {
      setMessage({ text: 'Please enter your First and Last Name.', type: 'error' });
      setErrorField('displayName');
      displayNameRef.current?.focus();
      displayNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!profile.level) {
      setMessage({ text: 'Please select your skill level.', type: 'error' });
      setErrorField('level');
      levelRef.current?.focus();
      levelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!profile.gender) {
      setMessage({ text: 'Please select your gender.', type: 'error' });
      setErrorField('gender');
      genderRef.current?.focus();
      genderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!profile.dominantHand) {
      setMessage({ text: 'Please select your dominant hand.', type: 'error' });
      setErrorField('dominantHand');
      dominantHandRef.current?.focus();
      dominantHandRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!profile.styleOfPlay || profile.styleOfPlay.length === 0) {
      setMessage({ text: 'Please select at least one style of play.', type: 'error' });
      setErrorField('styleOfPlay');
      styleOfPlayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Check playStyles
    const hasPreference = profile.playStyles?.some(p => p.preference > 0);
    if (!hasPreference) {
      setMessage({ text: 'Please set at least one play preference (Singles, Doubles, or Mixed) to a value greater than 0.', type: 'error' });
      setErrorField('playStyles');
      playStylesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Ensure all playStyles have a level if preference > 0
    const missingStyleLevel = profile.playStyles?.find(p => p.preference > 0 && !p.level);
    if (missingStyleLevel) {
      setMessage({ text: `Please select a skill level for ${missingStyleLevel.style}.`, type: 'error' });
      setErrorField('playStyles');
      playStylesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      const uidToSave = targetUid && isAdmin ? targetUid : user.uid;
      const profileData: any = {
        uid: uidToSave,
        displayName: profile.displayName || (targetUid ? 'New User' : user.displayName) || 'Anonymous Player',
        email: profile.email || (targetUid ? '' : user.email) || '',
        photoURL: profile.photoURL || (targetUid ? '' : user.photoURL) || '',
        level: profile.level,
        gender: profile.gender,
        dominantHand: profile.dominantHand,
        styleOfPlay: profile.styleOfPlay,
        playStyles: profile.playStyles,
        playingSince: profile.playingSince,
        updatedAt: serverTimestamp()
      };

      if (profile.role) profileData.role = profile.role;
      if (profile.rackets) profileData.rackets = profile.rackets;
      if (profile.shoes) profileData.shoes = profile.shoes;
      if (profile.strings) profileData.strings = profile.strings;
      if (profile.homeClub !== undefined) profileData.homeClub = profile.homeClub;
      if (profile.bio !== undefined) profileData.bio = profile.bio;
      
      await setDoc(doc(db, 'users', uidToSave), profileData, { merge: true });
      setMessage({ text: 'Profile saved successfully!', type: 'success' });
      
      // Navigate to schedule page if it's the current user saving their own profile
      if (!targetUid || (targetUid && !isAdmin)) {
        setTimeout(() => {
          navigate('/');
        }, 500);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${targetUid && isAdmin ? targetUid : user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const updatePlayStyle = (index: number, field: keyof PlayStylePreference, value: any) => {
    setProfile(prev => {
      const newStyles = [...(prev.playStyles || [])];
      newStyles[index] = { ...newStyles[index], [field]: value };
      return { ...prev, playStyles: newStyles };
    });
  };

  const handleGearImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number, type: 'rackets' | 'shoes' | 'strings') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const base64Image = await compressImage(file, 400, 400, 0.7);
      setProfile(prev => {
        const newItems = [...(prev[type] || [])] as any[];
        newItems[index] = { ...newItems[index], photoURL: base64Image };
        return { ...prev, [type]: newItems };
      });
    } catch (error) {
      console.error('Error compressing image:', error);
      setMessage({ text: 'Failed to process image.', type: 'error' });
    }
  };

  const addRacket = () => {
    setProfile(prev => ({
      ...prev,
      rackets: [...(prev.rackets || []), { id: Date.now().toString(), name: '', weight: '', gripSize: '', gripType: '', isCurrent: false, isFavorite: false }]
    }));
  };

  const updateRacket = (index: number, field: keyof Racket, value: any, extraInfo?: any) => {
    setProfile(prev => {
      const newRackets = [...(prev.rackets || [])];
      if (field === 'isCurrent' && value === true) {
        newRackets.forEach(r => r.isCurrent = false); // Only one current
      }
      
      let updatedRacket = { ...newRackets[index], [field]: value };
      
      // Auto-populate defaults if we selected from database
      if (extraInfo && field === 'name') {
        if (!updatedRacket.weight) updatedRacket.weight = '4U';
        if (!updatedRacket.gripSize) updatedRacket.gripSize = 'G5';
        if (!updatedRacket.gripType) updatedRacket.gripType = 'Tacky';
      }
      
      newRackets[index] = updatedRacket;
      return { ...prev, rackets: newRackets };
    });
  };

  const removeRacket = (index: number) => {
    setProfile(prev => {
      const newRackets = [...(prev.rackets || [])];
      newRackets.splice(index, 1);
      return { ...prev, rackets: newRackets };
    });
  };

  const addShoe = () => {
    setProfile(prev => ({
      ...prev,
      shoes: [...(prev.shoes || []), { id: Date.now().toString(), name: '', size: '', isCurrent: false, isFavorite: false }]
    }));
  };

  const updateShoe = (index: number, field: keyof Shoe, value: any, extraInfo?: any) => {
    setProfile(prev => {
      const newShoes = [...(prev.shoes || [])];
      if (field === 'isCurrent' && value === true) {
        newShoes.forEach(s => s.isCurrent = false);
      }
      newShoes[index] = { ...newShoes[index], [field]: value };
      return { ...prev, shoes: newShoes };
    });
  };

  const removeShoe = (index: number) => {
    setProfile(prev => {
      const newShoes = [...(prev.shoes || [])];
      newShoes.splice(index, 1);
      return { ...prev, shoes: newShoes };
    });
  };

  const addString = () => {
    setProfile(prev => ({
      ...prev,
      strings: [...(prev.strings || []), { id: Date.now().toString(), name: '', tensionMain: '', tensionCross: '', isCurrent: false, isFavorite: false }]
    }));
  };

  const updateString = (index: number, field: keyof BadmintonString, value: any, extraInfo?: any) => {
    setProfile(prev => {
      const newStrings = [...(prev.strings || [])];
      if (field === 'isCurrent' && value === true) {
        newStrings.forEach(s => s.isCurrent = false);
      }
      
      let updatedString = { ...newStrings[index], [field]: value };
      
      // Auto-populate defaults if we selected from database
      if (extraInfo && field === 'name') {
        if (updatedString.tensionMain === '') updatedString.tensionMain = 26;
        if (updatedString.tensionCross === '') updatedString.tensionCross = 26;
      }
      
      newStrings[index] = updatedString;
      return { ...prev, strings: newStrings };
    });
  };

  const removeString = (index: number) => {
    setProfile(prev => {
      const newStrings = [...(prev.strings || [])];
      newStrings.splice(index, 1);
      return { ...prev, strings: newStrings };
    });
  };

  const toggleStyleOfPlay = (style: string) => {
    setProfile(prev => {
      const current = prev.styleOfPlay || [];
      if (current.includes(style)) {
        return { ...prev, styleOfPlay: current.filter(s => s !== style) };
      } else {
        return { ...prev, styleOfPlay: [...current, style] };
      }
    });
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1980 + 1 }, (_, i) => currentYear - i);
  const shoeSizes = Array.from({ length: 23 }, (_, i) => {
    const m = 4 + (i * 0.5);
    return `US M ${m.toFixed(1)} / W ${(m + 1.5).toFixed(1)}`;
  });
  const tensions = Array.from({ length: 26 }, (_, i) => 15 + i);

  const getBorderColor = (level?: SkillLevel) => {
    switch (level) {
      case 'National': return 'border-black';
      case 'Advanced': return 'border-red-500';
      case 'Intermediate-Advanced': return 'border-orange-500';
      case 'Intermediate': return 'border-green-500';
      case 'Intermediate-Beginner': return 'border-yellow-400';
      case 'Beginner': return 'border-blue-500';
      default: return 'border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{targetUid && isAdmin ? 'Edit Player Profile' : 'Your Player Profile'}</h2>
            <p className="text-sm text-slate-500 mt-1">This information will be visible to other players.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm ${saving ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Save size={16} />
              <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
            <button
              type="button"
              onClick={targetUid && isAdmin ? () => navigate('/admin') : handleSignOut}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${targetUid && isAdmin ? 'text-slate-600 bg-slate-100 hover:bg-slate-200' : 'text-red-600 bg-red-50 hover:bg-red-100'}`}
            >
              {targetUid && isAdmin ? null : <LogOut size={16} />}
              <span className="hidden sm:inline">{targetUid && isAdmin ? 'Back to Admin' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-8">
          {message.text && (
            <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Basic Information</h3>
            
            <div className="flex flex-col sm:flex-row gap-6 mb-6">
              <div className="flex flex-col items-center gap-2">
                <div className="relative group">
                  <PlayerAvatar 
                    photoURL={profile.photoURL} 
                    displayName={profile.displayName} 
                    role={profile.role}
                    level={profile.level}
                    playStyles={profile.playStyles}
                    size="xl"
                  />
                  <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                    <Camera size={24} className="text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
                  </label>
                </div>
                <span className="text-xs text-slate-500 font-medium">Profile Photo</span>
              </div>
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First and Last Name <span className="font-bold">(Required)</span></label>
                  <input 
                    type="text" 
                    required
                    ref={displayNameRef}
                    value={profile.displayName || ''} 
                    onChange={e => {
                      setProfile({...profile, displayName: e.target.value});
                      if (errorField === 'displayName') setErrorField(null);
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${errorField === 'displayName' ? 'border-red-500 animate-pulse ring-2 ring-red-500' : 'border-slate-300'}`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Skill Level <span className="font-bold">(Required)</span></label>
                  <select 
                    required
                    ref={levelRef}
                    value={profile.level || ''} 
                    onChange={e => {
                      setProfile({...profile, level: e.target.value as SkillLevel});
                      if (errorField === 'level') setErrorField(null);
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${profile.level ? getLevelTextColorClass(profile.level) : ''} ${errorField === 'level' ? 'border-red-500 animate-pulse ring-2 ring-red-500' : 'border-slate-300'}`}
                  >
                    <option value="" className="text-slate-900 font-normal">Select Level</option>
                    <option value="National" className={getLevelTextColorClass('National')}>National</option>
                    <option value="Advanced" className={getLevelTextColorClass('Advanced')}>Advanced</option>
                    <option value="Intermediate-Advanced" className={getLevelTextColorClass('Intermediate-Advanced')}>Intermediate-Advanced</option>
                    <option value="Intermediate" className={getLevelTextColorClass('Intermediate')}>Intermediate</option>
                    <option value="Intermediate-Beginner" className={getLevelTextColorClass('Intermediate-Beginner')}>Intermediate-Beginner</option>
                    <option value="Beginner" className={getLevelTextColorClass('Beginner')}>Beginner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gender <span className="font-bold">(Required)</span></label>
                  <select 
                    required
                    ref={genderRef}
                    value={profile.gender || 'Male'} 
                    onChange={e => {
                      setProfile({...profile, gender: e.target.value as 'Male' | 'Female'});
                      if (errorField === 'gender') setErrorField(null);
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${errorField === 'gender' ? 'border-red-500 animate-pulse ring-2 ring-red-500' : 'border-slate-300'}`}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dominant Hand <span className="font-bold">(Required)</span></label>
                  <select 
                    required
                    ref={dominantHandRef}
                    value={profile.dominantHand || ''} 
                    onChange={e => {
                      setProfile({...profile, dominantHand: e.target.value});
                      if (errorField === 'dominantHand') setErrorField(null);
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${errorField === 'dominantHand' ? 'border-red-500 animate-pulse ring-2 ring-red-500' : 'border-slate-300'}`}
                  >
                    <option value="">Select Hand</option>
                    <option value="Right">Right</option>
                    <option value="Left">Left</option>
                    <option value="Ambidextrous">Ambidextrous</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Playing Since</label>
                  <select 
                    value={profile.playingSince || currentYear} 
                    onChange={e => setProfile({...profile, playingSince: parseInt(e.target.value) || currentYear})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Home Club / Court</label>
                  <input 
                    type="text" 
                    value={profile.homeClub || ''} 
                    onChange={e => setProfile({...profile, homeClub: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="e.g. Harvard MAC"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bio / About Me</label>
              <textarea 
                rows={3}
                value={profile.bio || ''} 
                onChange={e => setProfile({...profile, bio: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Tell other players a bit about yourself..."
              />
            </div>
          </div>

          {/* Play Styles */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Play Preferences</h3>
            
            <div className={`mb-6 p-4 rounded-xl border ${errorField === 'styleOfPlay' ? 'border-red-500 bg-red-50 animate-pulse' : 'border-transparent'}`} ref={styleOfPlayRef}>
              <label className="block text-sm font-medium text-slate-700 mb-2">Style of Play <span className="font-bold">(Required)</span> (Select all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {[
                  'Attacking', 'Defensive', 'Drive', 'Drop', 'All around',
                  'Battery Drain', 'Controlled', 'Strategist', 'Brute Force', 
                  'Speedster', 'The Wall', 'Deceptive', 'Smasher', 'Net Ninja', 'All-Rounder',
                  'Fun to Play', 'Collaborative'
                ].map(style => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => {
                      toggleStyleOfPlay(style);
                      if (errorField === 'styleOfPlay') setErrorField(null);
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      (profile.styleOfPlay || []).includes(style)
                        ? 'bg-red-100 text-red-700 border-red-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${errorField === 'playStyles' ? 'border-red-500 bg-red-50 animate-pulse' : 'border-transparent'}`} ref={playStylesRef}>
              <label className="block text-sm font-medium text-slate-700 mb-4">Play Preferences & Levels <span className="font-bold">(Required)</span></label>
              <p className="text-sm text-slate-500 mb-4">Set your preference for each style (0 = Don't Play, 5 = Love It) and your specific level for that style.</p>
              
              <div className="grid grid-cols-1 gap-4">
                {profile.playStyles?.map((stylePref, index) => (
                  <div key={stylePref.style} className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="w-32 font-medium text-slate-800">{stylePref.style}</div>
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Preference (0-5)</label>
                      <select 
                        value={stylePref.preference} 
                        onChange={e => {
                          updatePlayStyle(index, 'preference', parseInt(e.target.value));
                          if (errorField === 'playStyles') setErrorField(null);
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-red-500"
                      >
                        <option value={0}>0 - Don't want to play</option>
                        <option value={1}>1 - Rarely</option>
                        <option value={2}>2 - Sometimes</option>
                        <option value={3}>3 - Neutral</option>
                        <option value={4}>4 - Often</option>
                        <option value={5}>5 - Love to play anytime</option>
                      </select>
                    </div>
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Level</label>
                      <select 
                        required
                        value={stylePref.level} 
                        onChange={e => updatePlayStyle(index, 'level', e.target.value)}
                        className={`w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-red-500 ${stylePref.level ? getLevelTextColorClass(stylePref.level) : ''}`}
                      >
                        <option value="" className="text-slate-900 font-normal">Select Level</option>
                        <option value="National" className={getLevelTextColorClass('National')}>National</option>
                        <option value="Advanced" className={getLevelTextColorClass('Advanced')}>Advanced</option>
                        <option value="Intermediate-Advanced" className={getLevelTextColorClass('Intermediate-Advanced')}>Intermediate-Advanced</option>
                        <option value="Intermediate" className={getLevelTextColorClass('Intermediate')}>Intermediate</option>
                        <option value="Intermediate-Beginner" className={getLevelTextColorClass('Intermediate-Beginner')}>Intermediate-Beginner</option>
                        <option value="Beginner" className={getLevelTextColorClass('Beginner')}>Beginner</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rackets */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-semibold text-slate-800">My Rackets</h3>
              <button type="button" onClick={addRacket} className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1">
                <Plus size={16} /> Add Racket
              </button>
            </div>
            
            {profile.rackets?.map((racket, index) => (
              <div key={racket.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 relative">
                <button type="button" onClick={() => removeRacket(index)} className="absolute top-3 right-3 text-slate-400 hover:text-red-500">
                  <Trash2 size={18} />
                </button>
                <div className="flex flex-col sm:flex-row gap-4 mb-4 pr-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-200 border border-slate-300 flex-shrink-0 group">
                      {racket.photoURL ? (
                        <img src={racket.photoURL} alt="Racket" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <ImageIcon size={24} />
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera size={20} className="text-white" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleGearImageUpload(e, index, 'rackets')} />
                      </label>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Photo</span>
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="sm:col-span-2 lg:col-span-4">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Racket Name/Model</label>
                      <GearAutocomplete
                        type="racket"
                        value={racket.name}
                        onChange={(val, info) => updateRacket(index, 'name', val, info)}
                        placeholder="e.g. Yonex Astrox 99"
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Weight</label>
                      <select value={racket.weight} onChange={e => updateRacket(index, 'weight', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-red-500">
                        <option value="">Select</option>
                        {['3U', '4U', '5U', '6U', '7U', '8U'].map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Grip Size</label>
                      <select value={racket.gripSize} onChange={e => updateRacket(index, 'gripSize', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-red-500">
                        <option value="">Select</option>
                        {['G1', 'G2', 'G3', 'G4', 'G5', 'G6'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Grip Type</label>
                      <select value={racket.gripType || ''} onChange={e => updateRacket(index, 'gripType', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-red-500">
                        <option value="">Select</option>
                        {['Towel', 'Tacky', 'Dry'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={racket.isCurrent} onChange={e => updateRacket(index, 'isCurrent', e.target.checked)} className="rounded text-red-600 focus:ring-red-500" />
                    Current Main
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={racket.isFavorite} onChange={e => updateRacket(index, 'isFavorite', e.target.checked)} className="rounded text-red-600 focus:ring-red-500" />
                    Favorite
                  </label>
                </div>
              </div>
            ))}
            {(!profile.rackets || profile.rackets.length === 0) && (
              <p className="text-sm text-slate-500 italic">No rackets added yet.</p>
            )}
          </div>

          {/* Shoes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-semibold text-slate-800">My Shoes</h3>
              <button type="button" onClick={addShoe} className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1">
                <Plus size={16} /> Add Shoes
              </button>
            </div>
            
            {profile.shoes?.map((shoe, index) => (
              <div key={shoe.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 relative">
                <button type="button" onClick={() => removeShoe(index)} className="absolute top-3 right-3 text-slate-400 hover:text-red-500">
                  <Trash2 size={18} />
                </button>
                <div className="flex flex-col sm:flex-row gap-4 mb-4 pr-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-200 border border-slate-300 flex-shrink-0 group">
                      {shoe.photoURL ? (
                        <img src={shoe.photoURL} alt="Shoe" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <ImageIcon size={24} />
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera size={20} className="text-white" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleGearImageUpload(e, index, 'shoes')} />
                      </label>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Photo</span>
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Shoe Name/Model</label>
                      <GearAutocomplete
                        type="shoe"
                        value={shoe.name}
                        onChange={(val, info) => updateShoe(index, 'name', val, info)}
                        placeholder="e.g. Yonex Power Cushion 65 Z3"
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Size</label>
                      <select value={shoe.size} onChange={e => updateShoe(index, 'size', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-red-500">
                        <option value="">Select Size</option>
                        {shoeSizes.map(size => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={shoe.isCurrent} onChange={e => updateShoe(index, 'isCurrent', e.target.checked)} className="rounded text-red-600 focus:ring-red-500" />
                    Current Main
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={shoe.isFavorite} onChange={e => updateShoe(index, 'isFavorite', e.target.checked)} className="rounded text-red-600 focus:ring-red-500" />
                    Favorite
                  </label>
                </div>
              </div>
            ))}
            {(!profile.shoes || profile.shoes.length === 0) && (
              <p className="text-sm text-slate-500 italic">No shoes added yet.</p>
            )}
          </div>

          {/* Strings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-semibold text-slate-800">My Strings</h3>
              <button type="button" onClick={addString} className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1">
                <Plus size={16} /> Add String
              </button>
            </div>
            
            {profile.strings?.map((string, index) => (
              <div key={string.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 relative">
                <button type="button" onClick={() => removeString(index)} className="absolute top-3 right-3 text-slate-400 hover:text-red-500">
                  <Trash2 size={18} />
                </button>
                <div className="flex flex-col sm:flex-row gap-4 mb-4 pr-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-200 border border-slate-300 flex-shrink-0 group">
                      {string.photoURL ? (
                        <img src={string.photoURL} alt="String" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <ImageIcon size={24} />
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera size={20} className="text-white" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleGearImageUpload(e, index, 'strings')} />
                      </label>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Photo</span>
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1">String Name/Model</label>
                      <GearAutocomplete
                        type="string"
                        value={string.name}
                        onChange={(val, info) => updateString(index, 'name', val, info)}
                        placeholder="e.g. Yonex BG80"
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Mains Tension (lbs)</label>
                      <select value={string.tensionMain} onChange={e => updateString(index, 'tensionMain', e.target.value ? Number(e.target.value) : '')} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-red-500">
                        <option value="">Select</option>
                        {tensions.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Cross Tension (lbs)</label>
                      <select value={string.tensionCross} onChange={e => updateString(index, 'tensionCross', e.target.value ? Number(e.target.value) : '')} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-red-500">
                        <option value="">Select</option>
                        {tensions.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={string.isCurrent} onChange={e => updateString(index, 'isCurrent', e.target.checked)} className="rounded text-red-600 focus:ring-red-500" />
                    Current Main
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={string.isFavorite} onChange={e => updateString(index, 'isFavorite', e.target.checked)} className="rounded text-red-600 focus:ring-red-500" />
                    Favorite
                  </label>
                </div>
              </div>
            ))}
            {(!profile.strings || profile.strings.length === 0) && (
              <p className="text-sm text-slate-500 italic">No strings added yet.</p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-70"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

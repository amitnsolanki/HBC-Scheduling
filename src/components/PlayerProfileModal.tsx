import React, { useState, useEffect, useMemo } from 'react';
import { X, User, Shield, Activity, Star, MessageSquare, ThumbsUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, SkillLevel, PlayerAssessment, GearReview } from '../types';
import PlayerAvatar from './PlayerAvatar';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getLevelTextColorClass } from '../lib/utils';

interface PlayerProfileModalProps {
  player: UserProfile;
  onClose: () => void;
}

const LEVEL_OPTIONS: SkillLevel[] = [
  'National',
  'Advanced',
  'Intermediate-Advanced',
  'Intermediate',
  'Intermediate-Beginner',
  'Beginner'
];

const FUN_STYLE_OPTIONS = [
  'Attacking', 'Defensive', 'Drive', 'Drop', 'All around',
  'Battery Drain', 'Controlled', 'Strategist', 'Brute Force', 
  'Speedster', 'The Wall', 'Deceptive', 'Smasher', 'Net Ninja', 'All-Rounder',
  'Fun to Play', 'Collaborative'
];

export default function PlayerProfileModal({ player, onClose }: PlayerProfileModalProps) {
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [assessments, setAssessments] = useState<PlayerAssessment[]>([]);
  const [gearReviews, setGearReviews] = useState<GearReview[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Forms state
  const [myAssessment, setMyAssessment] = useState<Partial<PlayerAssessment>>({});
  const [isEditingAssessment, setIsEditingAssessment] = useState(false);
  const [reviewingGear, setReviewingGear] = useState<{type: 'racket' | 'string' | 'shoe', id: string} | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (currentUser) {
      getDoc(doc(db, 'users', currentUser.uid)).then(docSnap => {
        if (docSnap.exists()) {
          setCurrentUserProfile(docSnap.data() as UserProfile);
        }
      });
    }
  }, [currentUser]);

  useEffect(() => {
    const assessmentsQ = query(collection(db, 'player_assessments'), where('assessedUid', '==', player.uid));
    const unsubAssessments = onSnapshot(assessmentsQ, (snapshot) => {
      const data: PlayerAssessment[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as PlayerAssessment));
      setAssessments(data);
    });

    const reviewsQ = query(collection(db, 'gear_reviews'), where('targetUid', '==', player.uid));
    const unsubReviews = onSnapshot(reviewsQ, (snapshot) => {
      const data: GearReview[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as GearReview));
      setGearReviews(data);
      setLoading(false);
    });

    return () => {
      unsubAssessments();
      unsubReviews();
    };
  }, [player.uid, currentUser]);

  const handleAssessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return setAlertMessage('Please sign in to assess players.');
    if (currentUser.uid === player.uid) return setAlertMessage('You cannot assess yourself.');
    
    setSubmitting(true);
    try {
      const docId = `${currentUser.uid}_${player.uid}`;
      const existingDoc = assessments.find(a => a.assessorUid === currentUser.uid);
      
      const assessmentData: any = {
        assessorUid: currentUser.uid,
        assessedUid: player.uid,
        assessorLevel: currentUserProfile?.level || 'Unknown',
        createdAt: existingDoc?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      if (myAssessment.assessedLevel) assessmentData.assessedLevel = myAssessment.assessedLevel;
      if (myAssessment.singlesLevel) assessmentData.singlesLevel = myAssessment.singlesLevel;
      if (myAssessment.doublesLevel) assessmentData.doublesLevel = myAssessment.doublesLevel;
      if (myAssessment.mixedLevel) assessmentData.mixedLevel = myAssessment.mixedLevel;
      if (myAssessment.assessedStyles && myAssessment.assessedStyles.length > 0) {
        assessmentData.assessedStyles = myAssessment.assessedStyles;
      }
      if (myAssessment.suggestedStyles && myAssessment.suggestedStyles.length > 0) {
        assessmentData.suggestedStyles = myAssessment.suggestedStyles;
      }

      await setDoc(doc(db, 'player_assessments', docId), assessmentData);
      setIsEditingAssessment(false);
    } catch (error: any) {
      console.error('Assessment error:', error);
      setAlertMessage('Failed to save assessment: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return setAlertMessage('Please sign in to leave a review.');
    if (!reviewingGear || !reviewComment.trim()) return;
    
    setSubmitting(true);
    try {
      const docId = `${currentUser.uid}_${player.uid}_${reviewingGear.type}_${reviewingGear.id}`;
      await setDoc(doc(db, 'gear_reviews', docId), {
        reviewerUid: currentUser.uid,
        targetUid: player.uid,
        reviewerLevel: currentUserProfile?.level || 'Unknown',
        gearType: reviewingGear.type,
        gearId: reviewingGear.id,
        comment: reviewComment.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setReviewingGear(null);
      setReviewComment('');
    } catch (error: any) {
      console.error('Review error:', error);
      setAlertMessage('Failed to save review: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate assessment stats
  const agg = useMemo(() => {
    const result = {
      overall: {} as Record<string, number>,
      singles: {} as Record<string, number>,
      doubles: {} as Record<string, number>,
      mixed: {} as Record<string, number>,
      assessedStyles: {} as Record<string, number>,
      suggestedStyles: {} as Record<string, number>,
    };
    assessments.forEach(a => {
      if (a.assessedLevel) result.overall[a.assessedLevel] = (result.overall[a.assessedLevel] || 0) + 1;
      if (a.singlesLevel) result.singles[a.singlesLevel] = (result.singles[a.singlesLevel] || 0) + 1;
      if (a.doublesLevel) result.doubles[a.doublesLevel] = (result.doubles[a.doublesLevel] || 0) + 1;
      if (a.mixedLevel) result.mixed[a.mixedLevel] = (result.mixed[a.mixedLevel] || 0) + 1;
      if (a.assessedStyles) {
        a.assessedStyles.forEach(s => {
          result.assessedStyles[s] = (result.assessedStyles[s] || 0) + 1;
        });
      }
      if (a.suggestedStyles) {
        a.suggestedStyles.forEach(s => {
          result.suggestedStyles[s] = (result.suggestedStyles[s] || 0) + 1;
        });
      }
    });
    return result;
  }, [assessments]);

  const getLevelColor = (level: string) => {
    switch(level) {
      case 'National': return 'bg-slate-900 text-white';
      case 'Advanced': return 'bg-red-100 text-red-800';
      case 'Intermediate-Advanced': return 'bg-orange-100 text-orange-800';
      case 'Intermediate': return 'bg-green-100 text-green-800';
      case 'Intermediate-Beginner': return 'bg-yellow-100 text-yellow-800';
      case 'Beginner': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getAbbrev = (level: string) => {
    switch(level) {
      case 'National': return 'N';
      case 'Advanced': return 'A';
      case 'Intermediate-Advanced': return 'IA';
      case 'Intermediate': return 'I';
      case 'Intermediate-Beginner': return 'IB';
      case 'Beginner': return 'B';
      default: return '?';
    }
  };

  const renderAggregatedLevels = (title: string, counts: Record<string, number>) => {
    if (Object.keys(counts).length === 0) return null;
    return (
      <div className="mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([level, count]) => (
            <div key={level} className={`flex items-center gap-1.5 px-2 py-1 rounded border ${getLevelColor(level).replace('bg-', 'bg-opacity-20 bg-').replace('text-', 'border-opacity-30 border-')}`}>
              <span className="text-xs font-semibold">{level}</span>
              <span className="bg-white/60 text-slate-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAggregatedStyles = (title: string, counts: Record<string, number>) => {
    if (Object.keys(counts).length === 0) return null;
    return (
      <div className="mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counts).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([style, count]) => (
            <div key={style} className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-full">
              <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider">{style}</span>
              <span className="bg-slate-200 text-slate-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold">{count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGearSection = (title: string, icon: React.ReactNode, items: any[], type: 'racket' | 'string' | 'shoe') => {
    if (!items || items.length === 0) return null;
    
    return (
      <div className="mb-6">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3 uppercase tracking-wider">
          {icon} {title}
        </h4>
        <div className="space-y-4">
          {items.map(item => {
            const itemReviews = gearReviews.filter(r => r.gearType === type && r.gearId === item.id);
            const myReview = itemReviews.find(r => r.reviewerUid === currentUser?.uid);
            
            return (
              <div key={item.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-4">
                    {item.photoURL && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0">
                        <img src={item.photoURL} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {type === 'racket' && `${item.weight} • ${item.gripSize} • ${item.gripType} grip`}
                        {type === 'string' && `${item.tensionMain}lbs / ${item.tensionCross}lbs`}
                        {type === 'shoe' && `Size ${item.size}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {item.isCurrent && <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded uppercase font-bold">Current</span>}
                    {item.isFavorite && <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded uppercase font-bold">Favorite</span>}
                  </div>
                </div>

                {/* Reviews List */}
                {itemReviews.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {itemReviews.map(review => (
                      <div key={review.id} className="bg-white p-2.5 rounded-lg border border-slate-100 text-sm flex gap-3">
                        <div className="shrink-0 flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-200" title={`Reviewer Level: ${review.reviewerLevel}`}>
                            {getAbbrev(review.reviewerLevel)}
                          </div>
                        </div>
                        <div className="text-slate-700 italic">
                          "{review.comment}"
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Review Button/Form */}
                {currentUser && currentUser.uid !== player.uid && (
                  <div className="mt-3">
                    {reviewingGear?.id === item.id && reviewingGear?.type === type ? (
                      <form onSubmit={handleReviewSubmit} className="bg-white p-3 rounded-lg border border-slate-200">
                        <textarea
                          value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          placeholder="Leave an anonymous recommendation/review..."
                          className="w-full text-sm p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-2"
                          rows={2}
                          required
                        />
                        <div className="flex justify-end gap-2">
                          <button 
                            type="button" 
                            onClick={() => setReviewingGear(null)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit"
                            disabled={submitting}
                            className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white hover:bg-red-700 rounded-md disabled:opacity-50 flex items-center gap-1"
                          >
                            {submitting && <Loader2 size={12} className="animate-spin" />}
                            {myReview ? 'Update' : 'Submit'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button 
                        onClick={() => {
                          setReviewingGear({type, id: item.id});
                          setReviewComment(myReview?.comment || '');
                        }}
                        className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <MessageSquare size={12} />
                        {myReview ? 'Edit your review' : 'Add recommendation'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getBorderColor = (level?: string) => {
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

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 md:p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <PlayerAvatar 
              photoURL={player.photoURL} 
              displayName={player.displayName} 
              role={player.role}
              level={player.level}
              playStyles={player.playStyles}
              size="md"
            />
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{player.displayName}</h2>
              <p className="text-xs text-slate-500">Player Profile</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {/* Main Info */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold ${getLevelColor(player.level)}`}>
                Self-Assessed: {player.level}
              </span>
              {player.dominantHand && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-slate-100 text-slate-700">
                  {player.dominantHand} Handed
                </span>
              )}
              {player.playingSince && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-slate-100 text-slate-700">
                  Playing since {player.playingSince}
                </span>
              )}
            </div>
            
            {player.bio && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 italic text-sm mb-4">
                "{player.bio}"
              </div>
            )}

            {/* Community Assessment */}
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-6">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                <ThumbsUp size={16} className="text-blue-600" /> Community Assessment
              </h4>
              
              {loading ? (
                <Loader2 className="animate-spin text-slate-400 mx-auto" size={20} />
              ) : (
                <>
                  {assessments.length > 0 ? (
                    <div className="mb-4">
                      {renderAggregatedLevels('Overall Level', agg.overall)}
                      {renderAggregatedLevels('Singles Level', agg.singles)}
                      {renderAggregatedLevels('Doubles Level', agg.doubles)}
                      {renderAggregatedLevels('Mixed Level', agg.mixed)}
                      {renderAggregatedStyles('Assessed Play Styles', agg.assessedStyles)}
                      {renderAggregatedStyles('Suggested Play Styles', agg.suggestedStyles)}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 mb-4 italic">No community assessments yet.</p>
                  )}

                  {isEditingAssessment ? (
                    <form onSubmit={handleAssessSubmit} className="pt-3 border-t border-blue-100 mt-4">
                      <h5 className="text-sm font-bold text-slate-800 mb-3">Your Assessment</h5>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Overall Level</label>
                          <select 
                            value={myAssessment.assessedLevel || ''} 
                            onChange={e => setMyAssessment({...myAssessment, assessedLevel: e.target.value as SkillLevel})}
                            className={`w-full text-sm p-2 border border-slate-300 rounded-md ${myAssessment.assessedLevel ? getLevelTextColorClass(myAssessment.assessedLevel) : ''}`}
                          >
                            <option value="" className="text-slate-900 font-normal">-- Select --</option>
                            {LEVEL_OPTIONS.map(l => <option key={l} value={l} className={getLevelTextColorClass(l)}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Singles Level</label>
                          <select 
                            value={myAssessment.singlesLevel || ''} 
                            onChange={e => setMyAssessment({...myAssessment, singlesLevel: e.target.value as SkillLevel})}
                            className={`w-full text-sm p-2 border border-slate-300 rounded-md ${myAssessment.singlesLevel ? getLevelTextColorClass(myAssessment.singlesLevel) : ''}`}
                          >
                            <option value="" className="text-slate-900 font-normal">-- Select --</option>
                            {LEVEL_OPTIONS.map(l => <option key={l} value={l} className={getLevelTextColorClass(l)}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Doubles Level</label>
                          <select 
                            value={myAssessment.doublesLevel || ''} 
                            onChange={e => setMyAssessment({...myAssessment, doublesLevel: e.target.value as SkillLevel})}
                            className={`w-full text-sm p-2 border border-slate-300 rounded-md ${myAssessment.doublesLevel ? getLevelTextColorClass(myAssessment.doublesLevel) : ''}`}
                          >
                            <option value="" className="text-slate-900 font-normal">-- Select --</option>
                            {LEVEL_OPTIONS.map(l => <option key={l} value={l} className={getLevelTextColorClass(l)}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Mixed Level</label>
                          <select 
                            value={myAssessment.mixedLevel || ''} 
                            onChange={e => setMyAssessment({...myAssessment, mixedLevel: e.target.value as SkillLevel})}
                            className={`w-full text-sm p-2 border border-slate-300 rounded-md ${myAssessment.mixedLevel ? getLevelTextColorClass(myAssessment.mixedLevel) : ''}`}
                          >
                            <option value="" className="text-slate-900 font-normal">-- Select --</option>
                            {LEVEL_OPTIONS.map(l => <option key={l} value={l} className={getLevelTextColorClass(l)}>{l}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-xs font-medium text-slate-600 mb-2">Assessed Play Style</label>
                        <div className="flex flex-wrap gap-2">
                          {FUN_STYLE_OPTIONS.map(style => {
                            const isSelected = myAssessment.assessedStyles?.includes(style);
                            return (
                              <button
                                key={style}
                                type="button"
                                onClick={() => {
                                  const current = myAssessment.assessedStyles || [];
                                  const updated = isSelected ? current.filter(s => s !== style) : [...current, style];
                                  setMyAssessment({...myAssessment, assessedStyles: updated});
                                }}
                                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-colors border ${
                                  isSelected 
                                    ? 'bg-blue-100 text-blue-800 border-blue-300' 
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {style}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-xs font-medium text-slate-600 mb-2">Suggested Play Style</label>
                        <div className="flex flex-wrap gap-2">
                          {FUN_STYLE_OPTIONS.map(style => {
                            const isSelected = myAssessment.suggestedStyles?.includes(style);
                            return (
                              <button
                                key={style}
                                type="button"
                                onClick={() => {
                                  const current = myAssessment.suggestedStyles || [];
                                  const updated = isSelected ? current.filter(s => s !== style) : [...current, style];
                                  setMyAssessment({...myAssessment, suggestedStyles: updated});
                                }}
                                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-colors border ${
                                  isSelected 
                                    ? 'bg-blue-100 text-blue-800 border-blue-300' 
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {style}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button 
                          type="button" 
                          onClick={() => setIsEditingAssessment(false)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit"
                          disabled={submitting}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md disabled:opacity-50 flex items-center gap-1"
                        >
                          {submitting && <Loader2 size={12} className="animate-spin" />}
                          Save Assessment
                        </button>
                      </div>
                    </form>
                  ) : (
                    currentUser && currentUser.uid !== player.uid && (
                      <div className="pt-3 border-t border-blue-100 mt-4">
                        <button
                          onClick={() => {
                            const mine = assessments.find(a => a.assessorUid === currentUser.uid);
                            if (mine) {
                              setMyAssessment(mine);
                            } else {
                              setMyAssessment({});
                            }
                            setIsEditingAssessment(true);
                          }}
                          className="w-full py-2 bg-white border border-blue-200 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          {assessments.some(a => a.assessorUid === currentUser.uid) ? 'Edit Your Assessment' : 'Assess This Player'}
                        </button>
                      </div>
                    )
                  )}
                </>
              )}
            </div>

            {/* Play Styles */}
            {player.playStyles && player.playStyles.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wider">Play Preferences</h4>
                <div className="flex flex-wrap gap-2">
                  {player.playStyles.filter(p => p.preference > 0).sort((a, b) => b.preference - a.preference).map(p => (
                    <div key={p.style} className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">{p.style}</span>
                      <div className="flex">
                        {[1,2,3,4,5].map(star => (
                          <Star key={star} size={10} className={star <= p.preference ? "text-yellow-400 fill-yellow-400" : "text-slate-300"} />
                        ))}
                      </div>
                      {p.level && <span className={`text-xs border-l border-slate-300 pl-2 ml-1 ${getLevelTextColorClass(p.level)}`}>{p.level}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Gear Section */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Gear & Equipment</h3>
            
            {(!player.rackets?.length && !player.strings?.length && !player.shoes?.length) ? (
              <p className="text-sm text-slate-500 italic text-center py-4 bg-slate-50 rounded-xl">No gear listed yet.</p>
            ) : (
              <>
                {renderGearSection('Rackets', <Shield size={16} />, player.rackets || [], 'racket')}
                {renderGearSection('Strings', <Activity size={16} />, player.strings || [], 'string')}
                {renderGearSection('Shoes', <Star size={16} />, player.shoes || [], 'shoe')}
              </>
            )}
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
        </div>
      </motion.div>
    </div>
  );
}

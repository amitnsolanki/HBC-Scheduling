import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Loader2, Search, User, Shield, Activity, Star, MessageSquare, Users } from 'lucide-react';
import PlayerProfileModal from '../components/PlayerProfileModal';
import PlayerAvatar from '../components/PlayerAvatar';
import ChatModal from '../components/ChatModal';
import CreateGroupModal from '../components/CreateGroupModal';
import { getLevelTextColorClass } from '../lib/utils';

export default function PlayersDirectory() {
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<UserProfile | null>(null);
  const [chatRecipient, setChatRecipient] = useState<UserProfile | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const playersData: UserProfile[] = [];
        querySnapshot.forEach((doc) => {
          playersData.push(doc.data() as UserProfile);
        });
        setPlayers(playersData);
      } catch (error) {
        console.error('Error fetching players:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  const filteredPlayers = players.filter(player => {
    const displayName = player.displayName || '';
    const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = filterLevel ? player.level === filterLevel : true;
    return matchesSearch && matchesLevel;
  });

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Players Directory</h2>
          <p className="text-slate-500 mt-1">Find and connect with other badminton players.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search players..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 w-full sm:w-64"
            />
          </div>
          <select 
            value={filterLevel}
            onChange={e => setFilterLevel(e.target.value)}
            className={`px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${filterLevel ? getLevelTextColorClass(filterLevel) : ''}`}
          >
            <option value="" className="text-slate-900 font-normal">All Levels</option>
            <option value="National" className={getLevelTextColorClass('National')}>National</option>
            <option value="Advanced" className={getLevelTextColorClass('Advanced')}>Advanced</option>
            <option value="Intermediate-Advanced" className={getLevelTextColorClass('Intermediate-Advanced')}>Intermediate-Advanced</option>
            <option value="Intermediate" className={getLevelTextColorClass('Intermediate')}>Intermediate</option>
            <option value="Intermediate-Beginner" className={getLevelTextColorClass('Intermediate-Beginner')}>Intermediate-Beginner</option>
            <option value="Beginner" className={getLevelTextColorClass('Beginner')}>Beginner</option>
          </select>
          {auth.currentUser && (
            <button 
              onClick={() => setShowCreateGroup(true)}
              className="flex items-center gap-2 whitespace-nowrap bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-sm ml-auto"
            >
              <Users size={18} />
              <span className="font-semibold">Create Group</span>
            </button>
          )}
        </div>
      </div>

      {filteredPlayers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <User className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-medium text-slate-900">No players found</h3>
          <p className="text-slate-500 mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlayers.map(player => (
            <div 
              key={player.uid} 
              onClick={() => setSelectedPlayer(player)}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-1 relative"
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (!auth.currentUser) {
                    alert("Please sign in to message players.");
                    return;
                  }
                  if (auth.currentUser.uid === player.uid) {
                    alert("You cannot message yourself.");
                    return;
                  }
                  setChatRecipient(player);
                }}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
                title="Message player"
              >
                <MessageSquare size={20} />
              </button>
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <PlayerAvatar 
                    photoURL={player.photoURL} 
                    displayName={player.displayName} 
                    role={player.role}
                    level={player.level}
                    playStyles={player.playStyles}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 truncate">{player.displayName}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        player.level === 'National' ? 'bg-slate-900 text-white' :
                        player.level === 'Advanced' ? 'bg-red-100 text-red-800' :
                        player.level === 'Intermediate-Advanced' ? 'bg-orange-100 text-orange-800' :
                        player.level === 'Intermediate' ? 'bg-green-100 text-green-800' :
                        player.level === 'Intermediate-Beginner' ? 'bg-yellow-100 text-yellow-800' :
                        player.level === 'Beginner' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {player.level}
                      </span>
                      {player.playStyles && player.playStyles.filter(p => p.preference >= 3).map(p => (
                        <span key={p.style} className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate">
                          {p.style} {p.level ? <span className={getLevelTextColorClass(p.level)}>({p.level})</span> : ''}
                        </span>
                      ))}
                    </div>
                    {player.styleOfPlay && player.styleOfPlay.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {player.styleOfPlay.map(style => (
                          <span key={style} className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            {style}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {player.bio && (
                  <p className="mt-4 text-sm text-slate-600 line-clamp-2 italic">"{player.bio}"</p>
                )}

                <div className="mt-5 space-y-2">
                  {player.rackets?.find(r => r.isCurrent) && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Shield size={16} className="text-slate-400" />
                      <span className="truncate">
                        <span className="font-medium text-slate-700">Racket:</span> {player.rackets.find(r => r.isCurrent)?.name}
                      </span>
                    </div>
                  )}
                  {player.strings?.find(s => s.isCurrent) && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Activity size={16} className="text-slate-400" />
                      <span className="truncate">
                        <span className="font-medium text-slate-700">String:</span> {player.strings.find(s => s.isCurrent)?.name} ({player.strings.find(s => s.isCurrent)?.tensionMain}lbs)
                      </span>
                    </div>
                  )}
                  {player.shoes?.find(s => s.isCurrent) && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Star size={16} className="text-slate-400" />
                      <span className="truncate">
                        <span className="font-medium text-slate-700">Shoe:</span> {player.shoes.find(s => s.isCurrent)?.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPlayer && (
        <PlayerProfileModal 
          player={selectedPlayer} 
          onClose={() => setSelectedPlayer(null)} 
        />
      )}

      {chatRecipient && (
        <ChatModal
          recipient={chatRecipient}
          onClose={() => setChatRecipient(null)}
        />
      )}

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
        />
      )}
    </div>
  );
}

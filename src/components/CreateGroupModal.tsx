import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Users } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Group } from '../types';
import PlayerAvatar from './PlayerAvatar';
import { v4 as uuidv4 } from 'uuid'; // need to install uuid or just use crypto

interface CreateGroupModalProps {
  onClose: () => void;
}

export default function CreateGroupModal({ onClose }: CreateGroupModalProps) {
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [creating, setCreating] = useState(false);
  
  const user = auth.currentUser;

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const playersData: UserProfile[] = [];
        querySnapshot.forEach((doc) => {
          if (doc.id !== user?.uid) { // exclude self
            playersData.push(doc.data() as UserProfile);
          }
        });
        setPlayers(playersData);
      } catch (error) {
        console.error('Error fetching players:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, [user]);

  const filteredPlayers = players.filter(player => 
    (player.displayName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const togglePlayer = (uid: string) => {
    const newSelected = new Set(selectedUids);
    if (newSelected.has(uid)) {
      newSelected.delete(uid);
    } else {
      newSelected.add(uid);
    }
    setSelectedUids(newSelected);
  };

  const handleCreate = async () => {
    if (!user || !groupName.trim()) return;
    setCreating(true);

    try {
      const generatedId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      const groupData: Group = {
        id: generatedId,
        name: groupName.trim(),
        description: groupDesc.trim(),
        createdBy: user.uid,
        admins: [user.uid],
        members: [user.uid, ...Array.from(selectedUids)],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'groups', generatedId), groupData);
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to create group.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col h-[700px] max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="text-red-500" /> Create New Group
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Group Name *</label>
            <input 
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="e.g. Weekend Warriors"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
            <textarea 
              value={groupDesc}
              onChange={e => setGroupDesc(e.target.value)}
              placeholder="What is this group about?"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
              rows={2}
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Members To Add</label>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search players..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 w-full border border-slate-300 rounded-lg text-sm"
              />
            </div>
            
            <div className="border border-slate-200 rounded-lg h-64 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-300" /></div>
              ) : filteredPlayers.length === 0 ? (
                <div className="text-center p-8 text-slate-500 text-sm">No players found</div>
              ) : (
                filteredPlayers.map(p => (
                  <label key={p.uid} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                      checked={selectedUids.has(p.uid)}
                      onChange={() => togglePlayer(p.uid)}
                    />
                    <PlayerAvatar photoURL={p.photoURL} displayName={p.displayName} size="sm" level={p.level} role={p.role} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{p.displayName}</p>
                      <p className="text-xs text-slate-500 truncate">{p.level}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 flex justify-between items-center bg-slate-50">
          <span className="text-sm text-slate-500">{selectedUids.size} members selected</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 text-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!groupName.trim() || creating}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {creating && <Loader2 size={16} className="animate-spin" />}
              Create Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

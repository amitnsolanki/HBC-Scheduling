import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { seedDatabase, removeSeedData, seedGear } from '../seedData';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '../types';
import { User, Shield, Trash2, Edit, Package, Plus, X, Users } from 'lucide-react';
import PlayerAvatar from '../components/PlayerAvatar';
import { Group } from '../types';

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [gear, setGear] = useState<any[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showGearForm, setShowGearForm] = useState(false);
  const [newGear, setNewGear] = useState({
    type: 'racket',
    brand: '',
    model: '',
    series: '',
    balance: '',
    flex: '',
    weight_class: '',
    player_level: '',
    cushion_technology: '',
    gauge_mm: '',
    characteristic: ''
  });
  const navigate = useNavigate();

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!auth.currentUser) {
        navigate('/');
        return;
      }
      
      if (auth.currentUser.email?.toLowerCase() === 'neo.dink@gmail.com') {
        setIsAdmin(true);
        fetchUsers();
        fetchGear();
        fetchGroups();
        return;
      }

      try {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().role === 'admin') {
          setIsAdmin(true);
          fetchUsers();
          fetchGear();
          fetchGroups();
        } else {
          navigate('/');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        navigate('/');
      }
    };

    checkAdmin();
  }, [navigate]);

  const fetchGroups = async () => {
    try {
      const snap = await getDocs(collection(db, 'groups'));
      const list: Group[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Group));
      setGroups(list);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersData: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        usersData.push(doc.data() as UserProfile);
      });
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const [filterType, setFilterType] = useState('all');
  const [filterBrand, setFilterBrand] = useState('all');

  const fetchGear = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'gear'));
      const gearData: any[] = [];
      querySnapshot.forEach((doc) => {
        gearData.push({ id: doc.id, ...doc.data() });
      });
      setGear(gearData);
    } catch (error) {
      console.error('Error fetching gear:', error);
    }
  };

  const filteredGear = gear.filter(item => {
    const typeMatch = filterType === 'all' || item.type === filterType;
    const brandMatch = filterBrand === 'all' || item.brand === filterBrand;
    return typeMatch && brandMatch;
  });

  const uniqueBrands = Array.from(new Set(gear.map(item => item.brand))).sort();

  const handleAddGear = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const gearToSave = { ...newGear, updatedAt: serverTimestamp() };
      // Remove empty fields
      Object.keys(gearToSave).forEach(key => {
        if (!(gearToSave as any)[key]) delete (gearToSave as any)[key];
      });
      
      await addDoc(collection(db, 'gear'), gearToSave);
      setShowGearForm(false);
      setNewGear({
        type: 'racket',
        brand: '',
        model: '',
        series: '',
        balance: '',
        flex: '',
        weight_class: '',
        player_level: '',
        cushion_technology: '',
        gauge_mm: '',
        characteristic: ''
      });
      fetchGear();
    } catch (error) {
      console.error('Error adding gear:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGear = async (id: string) => {
    setConfirmAction({
      message: 'Are you sure you want to delete this gear?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'gear', id));
          fetchGear();
        } catch (error) {
          console.error('Error deleting gear:', error);
        }
        setConfirmAction(null);
      }
    });
  };

  const [confirmAction, setConfirmAction] = useState<{ message: string, onConfirm: () => void } | null>(null);

  const handleMakeAdmin = async (uid: string, currentRole: string | undefined) => {
    setConfirmAction({
      message: `Are you sure you want to make this user an ${currentRole === 'admin' ? 'user' : 'admin'}?`,
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', uid), {
            role: currentRole === 'admin' ? 'user' : 'admin'
          });
          fetchUsers();
        } catch (error) {
          console.error('Error updating role:', error);
        }
        setConfirmAction(null);
      }
    });
  };

  const handleDeleteUser = async (uid: string) => {
    setConfirmAction({
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', uid));
          fetchUsers();
        } catch (error) {
          console.error('Error deleting user:', error);
        }
        setConfirmAction(null);
      }
    });
  };

  const handleDeleteGroup = async (groupId: string) => {
    setConfirmAction({
      message: 'Are you sure you want to delete this group? This will also orphan all messages.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'groups', groupId));
          fetchGroups();
        } catch (error) {
          console.error(error);
        }
        setConfirmAction(null);
      }
    });
  };

  if (!isAdmin) {
    return null;
  }

  const handleSeed = async () => {
    setLoading(true);
    await seedDatabase();
    setLoading(false);
    fetchUsers();
  };

  const handleSeedGear = async (force = false) => {
    setLoading(true);
    const result = await seedGear(force);
    setLoading(false);
    alert(result.message);
    fetchGear();
  };

  const handleRemove = async () => {
    setLoading(true);
    await removeSeedData();
    setLoading(false);
    fetchUsers();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Admin Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <button 
          onClick={handleSeed}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-md flex items-center justify-center gap-2"
        >
          Seed Test Data
        </button>
        <button 
          onClick={() => handleSeedGear(true)}
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Package size={18} />
          Force Seed Gear
        </button>
        <button 
          onClick={handleRemove}
          disabled={loading}
          className="px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all shadow-md flex items-center justify-center gap-2"
        >
          Remove Seed Data
        </button>
        <button 
          onClick={() => navigate('/admin/analytics')}
          className="px-6 py-3 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-900 transition-all shadow-md"
        >
          Analytics
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-bold text-slate-900">Manage Gear Database</h3>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-600 outline-none px-2 py-1 cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="racket">Rackets</option>
              <option value="shoe">Shoes</option>
              <option value="string">Strings</option>
            </select>
            <div className="w-px h-4 bg-slate-300"></div>
            <select 
              value={filterBrand} 
              onChange={(e) => setFilterBrand(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-600 outline-none px-2 py-1 cursor-pointer"
            >
              <option value="all">All Brands</option>
              {uniqueBrands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
        </div>
        <button 
          onClick={() => setShowGearForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Add New Gear
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left border-collapse sticky-header">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Brand</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Model</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredGear.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`capitalize text-xs font-semibold px-2 py-1 rounded-full ${
                      item.type === 'racket' ? 'bg-blue-50 text-blue-700' :
                      item.type === 'shoe' ? 'bg-orange-50 text-orange-700' :
                      'bg-green-50 text-green-700'
                    }`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                    {item.brand}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {item.model}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleDeleteGear(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredGear.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={32} className="text-slate-300" />
                      <p>No gear found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <span>Showing {filteredGear.length} items</span>
          {filteredGear.length > 10 && <span>Scroll to see more</span>}
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-4">Manage Groups</h3>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <th className="p-4 font-semibold text-slate-600 text-sm">Group Name</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Members</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Description</th>
                <th className="p-4 font-semibold text-slate-600 text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((group) => (
                <tr key={group.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <Users size={16} className="text-slate-400" />
                      {group.name}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    <span className="px-2 py-1 bg-slate-100 rounded-lg text-slate-700 font-medium">{group.members?.length || 0}</span>
                  </td>
                  <td className="p-4 text-sm text-slate-500 max-w-[200px] truncate">
                    {group.description || '-'}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Group"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Users size={32} className="text-slate-300 mb-2" />
                      No groups exist.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-4">Manage Users</h3>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Level</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((user) => (
                <tr key={user.uid} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar 
                        photoURL={user.photoURL} 
                        displayName={user.displayName} 
                        role={user.role}
                        level={user.level}
                        playStyles={user.playStyles}
                        size="sm"
                      />
                      <span className="font-medium text-slate-900">{user.displayName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {user.level}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'}`}>
                      {user.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => navigate(`/admin/edit-user/${user.uid}`)}
                        className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Edit User"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleMakeAdmin(user.uid, user.role)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title={user.role === 'admin' ? "Remove Admin" : "Make Admin"}
                      >
                        <Shield size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.uid)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gear Form Modal */}
      {showGearForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900">Add New Gear</h3>
              <button onClick={() => setShowGearForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddGear} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select 
                  value={newGear.type}
                  onChange={(e) => setNewGear({...newGear, type: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="racket">Racket</option>
                  <option value="shoe">Shoe</option>
                  <option value="string">String</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                  <input 
                    type="text"
                    required
                    value={newGear.brand}
                    onChange={(e) => setNewGear({...newGear, brand: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Yonex"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
                  <input 
                    type="text"
                    required
                    value={newGear.model}
                    onChange={(e) => setNewGear({...newGear, model: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Astrox 99"
                  />
                </div>
              </div>

              {newGear.type === 'racket' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Series</label>
                    <input 
                      type="text"
                      value={newGear.series}
                      onChange={(e) => setNewGear({...newGear, series: e.target.value})}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Balance</label>
                      <input 
                        type="text"
                        value={newGear.balance}
                        onChange={(e) => setNewGear({...newGear, balance: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g. Head Heavy"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Flex</label>
                      <input 
                        type="text"
                        value={newGear.flex}
                        onChange={(e) => setNewGear({...newGear, flex: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g. Stiff"
                      />
                    </div>
                  </div>
                </>
              )}

              {newGear.type === 'shoe' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Player Level</label>
                    <input 
                      type="text"
                      value={newGear.player_level}
                      onChange={(e) => setNewGear({...newGear, player_level: e.target.value})}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cushion Technology</label>
                    <input 
                      type="text"
                      value={newGear.cushion_technology}
                      onChange={(e) => setNewGear({...newGear, cushion_technology: e.target.value})}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </>
              )}

              {newGear.type === 'string' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gauge (mm)</label>
                    <input 
                      type="text"
                      value={newGear.gauge_mm}
                      onChange={(e) => setNewGear({...newGear, gauge_mm: e.target.value})}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Characteristic</label>
                    <input 
                      type="text"
                      value={newGear.characteristic}
                      onChange={(e) => setNewGear({...newGear, characteristic: e.target.value})}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-md disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add to Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Action</h3>
            <p className="text-slate-600 mb-6">{confirmAction.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, doc, getDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fakeData = {
  summary: { totalUsers: 142, activeSessions: 24, avgMemory: '128 MB' },
  activity: [
    { name: 'Mon', activeUsers: 15, signups: 2 },
    { name: 'Tue', activeUsers: 22, signups: 5 },
    { name: 'Wed', activeUsers: 18, signups: 3 },
    { name: 'Thu', activeUsers: 25, signups: 8 },
    { name: 'Fri', activeUsers: 30, signups: 10 },
    { name: 'Sat', activeUsers: 28, signups: 6 },
    { name: 'Sun', activeUsers: 20, signups: 4 },
  ],
  highIntensity: [
    { name: 'Alex Chen', sessions: 45, storage: '12 MB' },
    { name: 'Sarah Jenkins', sessions: 30, storage: '8 MB' },
    { name: 'Michael Chang', sessions: 15, storage: '5 MB' },
  ]
};

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [dataType, setDataType] = useState<'fake' | 'real'>('fake');
  const [realData, setRealData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!auth.currentUser) {
        navigate('/');
        return;
      }
      
      if (auth.currentUser.email?.toLowerCase() === 'neo.dink@gmail.com') {
        setIsAdmin(true);
        return;
      }

      try {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().role === 'admin') {
          setIsAdmin(true);
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

  useEffect(() => {
    if (dataType === 'real' && !realData && isAdmin) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const usersSnapshot = await getDocs(collection(db, 'users'));
          // Placeholder for sessions/activity data
          setRealData({
            summary: { totalUsers: usersSnapshot.size, activeSessions: 0, avgMemory: '0 MB' },
            activity: Array(7).fill(0).map((_, i) => ({ name: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i], activeUsers: 0, signups: 0 })),
            highIntensity: []
          });
        } catch (error) {
          console.error('Error fetching real data:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [dataType, realData]);

  const data = dataType === 'fake' ? fakeData : (realData || {
    summary: { totalUsers: 0, activeSessions: 0, avgMemory: '0 MB' },
    activity: Array(7).fill(0).map((_, i) => ({ name: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i], activeUsers: 0, signups: 0 })),
    highIntensity: []
  });

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h2>
        <div className="flex bg-slate-200 rounded-lg p-1">
          <button 
            onClick={() => setDataType('fake')}
            className={`px-4 py-2 rounded-md font-medium transition-all ${dataType === 'fake' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
          >
            Fake Data
          </button>
          <button 
            onClick={() => setDataType('real')}
            className={`px-4 py-2 rounded-md font-medium transition-all ${dataType === 'real' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
          >
            Real Data
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading real data...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-medium text-slate-500">Total Users</h3>
              <p className="text-3xl font-bold text-slate-900">{data.summary.totalUsers}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-medium text-slate-500">Active Sessions (Today)</h3>
              <p className="text-3xl font-bold text-slate-900">{data.summary.activeSessions}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-medium text-slate-500">Avg. Memory Usage</h3>
              <p className="text-3xl font-bold text-slate-900">{data.summary.avgMemory}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">User Activity (Last 7 Days)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.activity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="activeUsers" fill="#dc2626" name="Active Users" />
                    <Bar dataKey="signups" fill="#3b82f6" name="Signups" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">High Intensity Users</h3>
              <div className="space-y-4">
                {data.highIntensity.length > 0 ? data.highIntensity.map((user: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-semibold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">Storage: {user.storage}</p>
                    </div>
                    <span className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">{user.sessions} sessions</span>
                  </div>
                )) : (
                  <p className="text-slate-500 text-sm">No high intensity users found.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Clock, BarChart3, Settings, LogOut } from 'lucide-react';
import SortationPlan from './components/TaskTracker';
import Admin from './components/Admin';
import Summary from './components/Summary';
import Login from './components/Login';
import { initializeFirebase, authService } from './lib/firebase';
import { BreakProvider } from './context/BreakContext';

function App() {
  const [activeTab, setActiveTab] = useState<'tracker' | 'admin' | 'summary'>(() => {
    return (localStorage.getItem('activeTab') as 'tracker' | 'admin' | 'summary') || 'tracker';
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [user, setUser] = useState(false);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    initializeFirebase();
    const unsubscribe = authService.onAuthStateChanged((currentUser) => {
      setUser(!!currentUser);
      setIsInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    setUser(false);
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="animate-pulse">
          <Clock className="w-12 h-12 text-blue-400" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => setUser(true)} />;
  }

  return (
    <BreakProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-blue-400" />
                <h1 className="text-3xl font-bold text-white">Sortation Plan</h1>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-4 py-2 rounded-lg transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <button
              onClick={() => setActiveTab('tracker')}
              className={`p-4 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'tracker'
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Clock className="w-5 h-5" />
              Sortation Plan
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`p-4 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'summary'
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              Summary
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`p-4 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'admin'
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Settings className="w-5 h-5" />
              Admin
            </button>
          </div>

          <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 min-h-screen">
            {activeTab === 'tracker' && <SortationPlan />}
            {activeTab === 'summary' && <Summary />}
            {activeTab === 'admin' && <Admin />}
          </div>
        </div>
      </div>
    </BreakProvider>
  );
}

export default App;

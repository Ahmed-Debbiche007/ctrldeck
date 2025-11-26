import { useState } from 'react';
import { Zap, BarChart3, QrCode, Menu, X } from 'lucide-react';
import { ActionsPage } from './pages/ActionsPage';
import { MetricsPage } from './pages/MetricsPage';
import { ConnectionPage } from './pages/ConnectionPage';
import './App.css';

type Page = 'actions' | 'metrics' | 'connection';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('actions');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { id: 'actions' as Page, label: 'Actions', icon: Zap, description: 'Configure buttons' },
    { id: 'metrics' as Page, label: 'Metrics', icon: BarChart3, description: 'System monitoring' },
    { id: 'connection' as Page, label: 'Connect', icon: QrCode, description: 'Connect device' },
  ];

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } flex flex-col bg-gray-900/50 border-r border-gray-800 transition-all duration-300`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-800">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Zap size={20} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg text-white whitespace-nowrap">Stream Deck</h1>
              <p className="text-xs text-gray-500 whitespace-nowrap">Control Center</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/10'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    isActive ? 'bg-blue-500/20' : 'bg-gray-800/50'
                  }`}
                >
                  <Icon size={18} />
                </div>
                {sidebarOpen && (
                  <div className="text-left overflow-hidden">
                    <div className="font-medium text-sm whitespace-nowrap">{item.label}</div>
                    <div className="text-xs text-gray-500 whitespace-nowrap">{item.description}</div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Toggle */}
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white transition-colors"
          >
            {sidebarOpen ? (
              <>
                <X size={16} />
                <span className="text-sm">Collapse</span>
              </>
            ) : (
              <Menu size={16} />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-linear-to-br from-gray-950 via-gray-900 to-gray-950">
        {/* Background Pattern */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgb(55 65 81 / 0.5) 1px, transparent 0)`,
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        {/* Page Content */}
        <div className="relative z-10 pb-16">
          {currentPage === 'actions' && <ActionsPage />}
          {currentPage === 'metrics' && <MetricsPage />}
          {currentPage === 'connection' && <ConnectionPage />}
        </div>
      </main>
    </div>
  );
}

export default App;

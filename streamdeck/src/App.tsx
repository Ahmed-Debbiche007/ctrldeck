import { useState, useRef, useEffect } from 'react';
import { Zap, BarChart3, Settings, X, ChevronUp } from 'lucide-react';
import { ActionsPage } from './pages/ActionsPage';
import { MetricsPage } from './pages/MetricsPage';
import { ConnectionSetup } from './pages/ConnectionSetup';
import { getApiBase, isConfigured } from './api';
import './App.css';

type Page = 'buttons' | 'metrics';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('buttons');
  const [connected, setConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsHeight, setSettingsHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const pages: { id: Page; label: string; icon: typeof Zap }[] = [
    { id: 'buttons', label: 'Buttons', icon: Zap },
    { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  ];

  useEffect(() => {
    // If not configured, automatically show settings
    if (!isConfigured()) {
      setShowSettings(true);
    }
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (!isConfigured()) {
      setConnected(false);
      return;
    }
    
    try {
      const res = await fetch(`${getApiBase()}/api/buttons`);
      setConnected(res.ok);
    } catch {
      setConnected(false);
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollLeft = containerRef.current.scrollLeft;
    const width = containerRef.current.offsetWidth;
    const pageIndex = Math.round(scrollLeft / width);
    setCurrentPage(pages[pageIndex]?.id || 'buttons');
  };

  // Handle swipe up from bottom to open settings
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const windowHeight = window.innerHeight;
    // Only start drag if touch is in the bottom 40px area (swipe handle)
    if (touch.clientY > windowHeight - 40 && !showSettings) {
      setIsDragging(true);
      setDragStartY(touch.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const deltaY = dragStartY - touch.clientY;
    if (deltaY > 0) {
      setSettingsHeight(Math.min(deltaY, window.innerHeight * 0.9));
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    // If dragged more than 100px, open settings fully
    if (settingsHeight > 100) {
      setShowSettings(true);
      setSettingsHeight(0);
    } else {
      setSettingsHeight(0);
    }
  };

  const handleConnectionComplete = () => {
    setShowSettings(false);
    checkConnection();
  };

  return (
    <div 
      className="h-screen bg-gray-950 text-white overflow-hidden flex flex-col relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipable Pages Container - Full screen */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {/* Buttons Page */}
        <div className="w-full h-full flex-shrink-0 snap-center overflow-y-auto">
          <ActionsPage onSettingsClick={() => setShowSettings(true)} />
        </div>
        
        {/* Metrics Page */}
        <div className="w-full h-full flex-shrink-0 snap-center overflow-y-auto">
          <MetricsPage onSettingsClick={() => setShowSettings(true)} />
        </div>
      </div>

      {/* Bottom Swipe Handle - Small indicator to swipe up for settings */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-1 safe-area-bottom pointer-events-none">
        <div className="flex flex-col items-center gap-1 pointer-events-auto">
          {/* Page dots */}
          <div className="flex gap-1.5">
            {pages.map((page) => (
              <div
                key={page.id}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  currentPage === page.id
                    ? 'bg-blue-500 w-4'
                    : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
          {/* Swipe handle */}
          <div 
            className="w-10 h-1 bg-gray-600 rounded-full opacity-50"
            onClick={() => setShowSettings(true)}
          />
        </div>
      </div>

      {/* Settings Bottom Sheet - Swipe preview */}
      {settingsHeight > 0 && (
        <div 
          className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl border-t border-gray-800 transition-none"
          style={{ height: settingsHeight }}
        >
          <div className="flex justify-center pt-3">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>
        </div>
      )}

      {/* Settings Bottom Sheet - Full */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex flex-col">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          />
          
          {/* Sheet */}
          <div 
            ref={settingsRef}
            className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl border-t border-gray-800 max-h-[90vh] flex flex-col animate-slide-up"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div 
                className="w-10 h-1 bg-gray-600 rounded-full cursor-pointer"
                onClick={() => setShowSettings(false)}
              />
            </div>
            
            {/* Connection Setup Content */}
            <div className="flex-1 overflow-y-auto">
              <ConnectionSetup 
                onComplete={handleConnectionComplete} 
                isBottomSheet={true}
                onClose={() => setShowSettings(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

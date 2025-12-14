import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import logo from '../assets/ctrldeck.svg';

interface TitleBarProps {
  title: string;
}

export function TitleBar({ title }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check initial maximized state
    const checkMaximized = async () => {
      if (window.electronAPI?.windowIsMaximized) {
        const maximized = await window.electronAPI.windowIsMaximized();
        setIsMaximized(maximized);
      }
    };
    checkMaximized();

    // Listen for window resize to update maximized state
    const handleResize = async () => {
      if (window.electronAPI?.windowIsMaximized) {
        const maximized = await window.electronAPI.windowIsMaximized();
        setIsMaximized(maximized);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.windowMinimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.windowMaximize();
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    window.electronAPI?.windowClose();
  };

  // Check if we're in Electron
  const isElectron = !!window.electronAPI?.windowMinimize;

  if (!isElectron) {
    return null; // Don't render title bar in browser
  }

  return (
    <div className="title-bar flex items-center justify-between h-10 bg-gray-900 border-b border-gray-800 select-none">
      {/* Left section - Logo */}
      <div className="flex items-center gap-2 px-3 drag-region">
        <img src={logo} alt="CtrlDeck" className="w-5 h-5" />
      </div>

      {/* Center section - Page Title */}
      <div className="flex-1 flex justify-center drag-region">
        <span className="text-sm font-semibold text-white">CtrlDeck-{title}</span>
      </div>

      {/* Right section - Window Controls */}
      <div className="flex items-center h-full no-drag">
        <button
          onClick={handleMinimize}
          className="h-full px-4 flex items-center justify-center text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          title="Minimize"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-4 flex items-center justify-center text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Copy size={14} className="rotate-180" /> : <Square size={14} />}
        </button>
        <button
          onClick={handleClose}
          className="h-full px-4 flex items-center justify-center text-gray-400 hover:bg-red-600 hover:text-white transition-colors"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

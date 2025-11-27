const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Get backend URL from main process
  getBackendUrl: () => {
    return window.__BACKEND_URL__ || 'http://127.0.0.1:8080';
  },
  
  // Get backend port from main process
  getBackendPort: () => {
    return window.__BACKEND_PORT__ || 8080;
  },
  
  // Platform info
  platform: process.platform,
  
  // App version
  getVersion: () => {
    return process.env.npm_package_version || '0.0.0';
  }
});

// Inject backend URL as soon as available
window.addEventListener('DOMContentLoaded', () => {
  // The backend URL will be injected by the main process
  // This ensures the renderer can access it
  console.log('Preload script loaded');
});

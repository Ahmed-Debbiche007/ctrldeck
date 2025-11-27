const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const http = require('http');

let mainWindow = null;
let backendProcess = null;
let backendPort = null;

// Check if a port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

// Find an available port starting from the given port
async function findAvailablePort(startPort = 8080) {
  let port = startPort;
  while (port < startPort + 100) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  throw new Error('No available port found');
}

// Wait for backend to be ready
function waitForBackend(port, maxRetries = 30, retryDelay = 500) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    
    const checkHealth = () => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: '/health',
        method: 'GET',
        timeout: 1000
      }, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      
      req.on('error', () => retry());
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
      
      req.end();
    };
    
    const retry = () => {
      retries++;
      if (retries >= maxRetries) {
        reject(new Error('Backend failed to start'));
      } else {
        setTimeout(checkHealth, retryDelay);
      }
    };
    
    checkHealth();
  });
}

// Get the path to the backend binary
function getBackendPath() {
  const isPackaged = app.isPackaged;
  const platform = process.platform;
  const binaryName = platform === 'win32' ? 'streamdeck-server.exe' : 'streamdeck-server';
  
  if (isPackaged) {
    // In packaged app, binary is in resources/extraResources
    return path.join(process.resourcesPath, 'extraResources', binaryName);
  } else {
    // In development, look in the backend directory
    return path.join(__dirname, '..', '..', 'backend', 'cmd', 'server', binaryName);
  }
}

// Start the backend server
async function startBackend() {
  try {
    backendPort = await findAvailablePort(8080);
    console.log(`Starting backend on port ${backendPort}`);
    
    const backendPath = getBackendPath();
    console.log(`Backend path: ${backendPath}`);
    
    // Check if backend binary exists
    const fs = require('fs');
    if (!fs.existsSync(backendPath)) {
      throw new Error(`Backend binary not found at: ${backendPath}`);
    }
    
    backendProcess = spawn(backendPath, ['--port', backendPort.toString()], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend stdout: ${data}`);
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend stderr: ${data}`);
    });
    
    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
      dialog.showErrorBox('Backend Error', `Failed to start backend: ${err.message}`);
    });
    
    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend exited with code ${code}, signal ${signal}`);
      backendProcess = null;
    });
    
    // Wait for backend to be ready
    await waitForBackend(backendPort);
    console.log('Backend is ready');
    
    return backendPort;
  } catch (error) {
    console.error('Error starting backend:', error);
    throw error;
  }
}

// Stop the backend server
function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend...');
    
    if (process.platform === 'win32') {
      // On Windows, use taskkill to ensure process tree is killed
      spawn('taskkill', ['/pid', backendProcess.pid.toString(), '/f', '/t']);
    } else {
      // On Unix, send SIGTERM
      backendProcess.kill('SIGTERM');
      
      // Force kill after timeout
      setTimeout(() => {
        if (backendProcess) {
          backendProcess.kill('SIGKILL');
        }
      }, 5000);
    }
    
    backendProcess = null;
  }
}

// Create the main window
function createWindow() {
  const isDev = !app.isPackaged;
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'public', 'vite.svg'),
    title: 'StreamDeck'
  });
  
  // Remove menu bar on Windows/Linux
  mainWindow.setMenuBarVisibility(false);
  
  if (isDev) {
    // In development, load from Vite dev server
    // You need to run `npm run dev` separately
    mainWindow.loadURL(`http://localhost:5173`);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Start backend first
    await startBackend();
    
    // Then create window
    createWindow();
    
    // Inject backend port into renderer
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.executeJavaScript(`
        window.__BACKEND_PORT__ = ${backendPort};
        window.__BACKEND_URL__ = 'http://127.0.0.1:${backendPort}';
      `);
    });
  } catch (error) {
    dialog.showErrorBox('Startup Error', `Failed to start application: ${error.message}`);
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('will-quit', () => {
  stopBackend();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  stopBackend();
});

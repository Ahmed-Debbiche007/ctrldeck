const { app, BrowserWindow, dialog, Tray, Menu, nativeImage, ipcMain } = require("electron");
const path = require("path");

// Import utility modules
const { checkLinuxDependencies } = require("./utils/dependencies.cjs");
const { startBackend, stopBackend, getBackendPort } = require("./utils/backend.cjs");
const { getIconPath, getTrayIconPath } = require("./utils/paths.cjs");

// Single instance lock - ensure only one instance runs
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one immediately
  app.quit();
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Handle second instance attempt - show, focus, and maximize existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    mainWindow.maximize();
  }
});

// Create system tray (production only)
function createTray() {
  const iconPath = getTrayIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show CtrlDeck",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.maximize();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  
  tray.setToolTip("CtrlDeck");
  tray.setContextMenu(contextMenu);
  
  // Double-click to show window
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Create the main window
function createWindow() {
  const isDev = !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Frameless window for custom title bar
    titleBarStyle: "hidden", // Hidden title bar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
    icon: getIconPath(),
    title: "CtrlDeck",
  });

  // Maximize window on startup
  mainWindow.maximize();

  if (isDev) {
    // In development, load from Vite dev server
    // You need to run `npm run dev` separately
    mainWindow.loadURL(`http://localhost:5173`);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Handle window close - minimize to tray in production
  mainWindow.on("close", (event) => {
    if (!isDev && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Check for required Linux dependencies
    const depsOk = await checkLinuxDependencies();
    if (!depsOk) {
      return; // User chose to quit or critical error
    }

    // Start backend first
    const backendPort = await startBackend();

    // Create system tray in production only
    if (app.isPackaged) {
      createTray();
    }

    // Then create window
    createWindow();

    // Inject backend port into renderer
    mainWindow.webContents.on("did-finish-load", () => {
      mainWindow.webContents.executeJavaScript(`
        window.__BACKEND_PORT__ = ${backendPort};
        window.__BACKEND_URL__ = 'http://127.0.0.1:${backendPort}';
      `);
    });
  } catch (error) {
    dialog.showErrorBox(
      "Startup Error",
      `Failed to start application: ${error.message}`
    );
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  // In production with tray, don't quit when window is closed
  if (!app.isPackaged) {
    stopBackend();
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  stopBackend();
});

app.on("will-quit", () => {
  stopBackend();
  if (tray) {
    tray.destroy();
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  stopBackend();
});

// IPC handlers for window controls
ipcMain.on("window-minimize", () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("window-close", () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle("window-is-maximized", () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

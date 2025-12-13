const { app, BrowserWindow, dialog, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");
const http = require("http");

let mainWindow = null;
let backendProcess = null;
let backendPort = null;
let tray = null;
let isQuitting = false;
let firewallOpened = false;

// Get the path to the app icon
function getIconPath() {
  if (app.isPackaged) {
    // In production, icon is in extraResources folder
    return path.join(process.resourcesPath, "extraResources", "ctrldeck-256.png");
  } else {
    // In development, use public folder
    return path.join(__dirname, "..", "public", "ctrldeck.png");
  }
}

// Get the path to the tray icon (smaller size for system tray)
function getTrayIconPath() {
  if (app.isPackaged) {
    // In production, use smaller tray icon
    return path.join(process.resourcesPath, "extraResources", "ctrldeck-tray.png");
  } else {
    // In development, use public folder
    return path.join(__dirname, "..", "public", "ctrldeck.png");
  }
}

// Check if a port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port, "127.0.0.1");
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
  throw new Error("No available port found");
}

// Wait for backend to be ready
function waitForBackend(port, maxRetries = 30, retryDelay = 500) {
  return new Promise((resolve, reject) => {
    let retries = 0;

    const checkHealth = () => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: port,
          path: "/health",
          method: "GET",
          timeout: 1000,
        },
        (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
        }
      );

      req.on("error", () => retry());
      req.on("timeout", () => {
        req.destroy();
        retry();
      });

      req.end();
    };

    const retry = () => {
      retries++;
      if (retries >= maxRetries) {
        reject(new Error("Backend failed to start"));
      } else {
        setTimeout(checkHealth, retryDelay);
      }
    };

    checkHealth();
  });
}

// Open firewall port to expose backend to the network
async function openFirewallPort(port) {
  return new Promise((resolve) => {
    console.log(`Opening firewall port ${port}...`);
    
    let proc;
    
    if (process.platform === "linux") {
      // Use pkexec for GUI authentication on Linux with UFW
      proc = spawn("pkexec", ["ufw", "allow", `${port}/tcp`, "comment", "CtrlDeck"]);
    } else if (process.platform === "win32") {
      // Windows - use netsh (requires admin elevation)
      proc = spawn("netsh", [
        "advfirewall", "firewall", "add", "rule",
        `name=CtrlDeck-${port}`,
        "dir=in",
        "action=allow",
        "protocol=tcp",
        `localport=${port}`
      ], { shell: true });
    } else if (process.platform === "darwin") {
      // macOS - firewall is typically handled differently
      console.log("macOS firewall management not implemented - may prompt for access automatically");
      resolve(true);
      return;
    } else {
      console.log(`Firewall management not supported on ${process.platform}`);
      resolve(false);
      return;
    }

    proc.stdout?.on("data", (data) => {
      console.log(`Firewall stdout: ${data}`);
    });

    proc.stderr?.on("data", (data) => {
      console.error(`Firewall stderr: ${data}`);
    });

    proc.on("error", (err) => {
      console.error("Failed to open firewall port:", err);
      resolve(false);
    });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log(`Firewall port ${port} opened successfully`);
        firewallOpened = true;
        resolve(true);
      } else {
        console.log(`Firewall command exited with code ${code} - port may not be open`);
        resolve(false);
      }
    });
  });
}

// Close firewall port when app closes
async function closeFirewallPort(port) {
  return new Promise((resolve) => {
    if (!firewallOpened || !port) {
      resolve(true);
      return;
    }
    
    console.log(`Closing firewall port ${port}...`);
    
    let proc;
    
    if (process.platform === "linux") {
      // Use pkexec for GUI authentication on Linux with UFW
      proc = spawn("pkexec", ["ufw", "delete", "allow", `${port}/tcp`]);
    } else if (process.platform === "win32") {
      // Windows - use netsh
      proc = spawn("netsh", [
        "advfirewall", "firewall", "delete", "rule",
        `name=CtrlDeck-${port}`
      ], { shell: true });
    } else {
      resolve(true);
      return;
    }

    proc.stdout?.on("data", (data) => {
      console.log(`Firewall stdout: ${data}`);
    });

    proc.stderr?.on("data", (data) => {
      console.error(`Firewall stderr: ${data}`);
    });

    proc.on("error", (err) => {
      console.error("Failed to close firewall port:", err);
      resolve(false);
    });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log(`Firewall port ${port} closed successfully`);
      } else {
        console.log(`Firewall delete command exited with code ${code}`);
      }
      firewallOpened = false;
      resolve(true);
    });
  });
}

// Get the path to the backend binary
function getBackendPath() {
  const isPackaged = app.isPackaged;
  const platform = process.platform;
  const binaryName =
    platform === "win32" ? "ctrldeck-server.exe" : "ctrldeck-server";

  if (isPackaged) {
    // In production, extraResources are in the resources folder
    return path.join(process.resourcesPath, "extraResources", binaryName);
  } else {
    // In development, use relative path from electron folder
    return path.join(__dirname, "..", "extraResources", binaryName);
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
    const fs = require("fs");
    if (!fs.existsSync(backendPath)) {
      throw new Error(`Backend binary not found at: ${backendPath}`);
    }

    backendProcess = spawn(backendPath, ["--port", backendPort.toString()], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    backendProcess.stdout.on("data", (data) => {
      console.log(`Backend stdout: ${data}`);
    });

    backendProcess.stderr.on("data", (data) => {
      console.error(`Backend stderr: ${data}`);
    });

    backendProcess.on("error", (err) => {
      console.error("Failed to start backend:", err);
      dialog.showErrorBox(
        "Backend Error",
        `Failed to start backend: ${err.message}`
      );
    });

    backendProcess.on("exit", (code, signal) => {
      console.log(`Backend exited with code ${code}, signal ${signal}`);
      backendProcess = null;
    });

    // Wait for backend to be ready
    await waitForBackend(backendPort);
    console.log("Backend is ready");

    // Open firewall port to expose backend to the network
    try {
      await openFirewallPort(backendPort);
    } catch (err) {
      console.log("Firewall configuration skipped or failed:", err.message);
    }

    return backendPort;
  } catch (error) {
    console.error("Error starting backend:", error);
    throw error;
  }
}

// Stop the backend server
async function stopBackend() {
  // Close firewall port first
  if (firewallOpened && backendPort) {
    try {
      await closeFirewallPort(backendPort);
    } catch (err) {
      console.log("Failed to close firewall port:", err.message);
    }
  }

  if (backendProcess) {
    console.log("Stopping backend...");

    if (process.platform === "win32") {
      // On Windows, use taskkill to ensure process tree is killed
      spawn("taskkill", ["/pid", backendProcess.pid.toString(), "/f", "/t"]);
    } else {
      // On Unix, send SIGTERM
      backendProcess.kill("SIGTERM");

      // Force kill after timeout
      setTimeout(() => {
        if (backendProcess) {
          backendProcess.kill("SIGKILL");
        }
      }, 5000);
    }

    backendProcess = null;
  }
}

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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
    icon: getIconPath(),
    title: "CtrlDeck",
  });

  // Remove menu bar on Windows/Linux
  mainWindow.setMenuBarVisibility(false);

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
    // Start backend first
    await startBackend();

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

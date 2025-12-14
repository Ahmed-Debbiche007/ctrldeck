const { app } = require("electron");
const path = require("path");

// Get the path to the app icon
function getIconPath() {
  if (app.isPackaged) {
    // In production, icon is in extraResources folder
    return path.join(process.resourcesPath, "extraResources", "ctrldeck-256.png");
  } else {
    // In development, use public folder
    return path.join(__dirname, "..", "..", "public", "ctrldeck.png");
  }
}

// Get the path to the tray icon (smaller size for system tray)
function getTrayIconPath() {
  if (app.isPackaged) {
    // In production, use smaller tray icon
    return path.join(process.resourcesPath, "extraResources", "ctrldeck-tray.png");
  } else {
    // In development, use public folder
    return path.join(__dirname, "..", "..", "public", "ctrldeck.png");
  }
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
    return path.join(__dirname, "..", "..", "extraResources", binaryName);
  }
}

module.exports = {
  getIconPath,
  getTrayIconPath,
  getBackendPath
};

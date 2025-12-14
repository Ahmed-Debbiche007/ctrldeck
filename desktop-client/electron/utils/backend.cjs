const { dialog } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");

const { getBackendPath } = require("./paths.cjs");
const { findAvailablePort, waitForBackend } = require("./network.cjs");
const { openFirewallPort, closeFirewallPort, isFirewallOpened } = require("./firewall.cjs");

let backendProcess = null;
let backendPort = null;

// Start the backend server
async function startBackend() {
  try {
    backendPort = await findAvailablePort(8080);
    console.log(`Starting backend on port ${backendPort}`);

    const backendPath = getBackendPath();
    console.log(`Backend path: ${backendPath}`);

    // Check if backend binary exists
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
  if (isFirewallOpened() && backendPort) {
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

// Get the current backend port
function getBackendPort() {
  return backendPort;
}

module.exports = {
  startBackend,
  stopBackend,
  getBackendPort
};

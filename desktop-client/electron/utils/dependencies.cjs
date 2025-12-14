const { app, dialog } = require("electron");
const { spawn } = require("child_process");

// Check if a command-line tool is installed
function isToolInstalled(toolName) {
  return new Promise((resolve) => {
    const proc = spawn("which", [toolName]);
    
    proc.on("error", () => {
      resolve(false);
    });
    
    proc.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

// Check for required Linux dependencies
async function checkLinuxDependencies() {
  if (process.platform !== "linux") {
    return true;
  }

  const requiredTools = [
    { name: "pactl", package: "pulseaudio-utils", description: "PulseAudio control (for volume/mic control)" },
    { name: "brightnessctl", package: "brightnessctl", description: "Brightness control (for laptop display brightness)" }
  ];

  const missingTools = [];

  for (const tool of requiredTools) {
    const installed = await isToolInstalled(tool.name);
    if (!installed) {
      missingTools.push(tool);
    }
  }

  if (missingTools.length > 0) {
    const toolList = missingTools.map(t => `• ${t.name} (${t.description})`).join("\n");
    const packageList = missingTools.map(t => t.package).join(" ");
    
    const result = await dialog.showMessageBox({
      type: "warning",
      title: "Missing Dependencies",
      message: "Some required tools are not installed",
      detail: `The following tools are missing:\n\n${toolList}\n\nWould you like to install them now?\n\nThis will run:\nsudo apt install ${packageList}`,
      buttons: ["Install Now", "Skip", "Quit"],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      // User chose to install
      return await installLinuxDependencies(packageList);
    } else if (result.response === 2) {
      // User chose to quit
      app.quit();
      return false;
    }
    // User chose to skip - continue with warning
    console.log("User skipped dependency installation. Some features may not work.");
    return true;
  }

  return true;
}

// Install missing Linux dependencies using pkexec
async function installLinuxDependencies(packages) {
  return new Promise((resolve) => {
    console.log(`Installing packages: ${packages}`);
    
    // Use pkexec for GUI authentication
    const proc = spawn("pkexec", ["apt", "install", "-y", ...packages.split(" ")]);
    
    let stdout = "";
    let stderr = "";
    
    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
      console.log(`Install stdout: ${data}`);
    });
    
    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
      console.error(`Install stderr: ${data}`);
    });
    
    proc.on("error", (err) => {
      console.error("Failed to install dependencies:", err);
      dialog.showErrorBox(
        "Installation Failed",
        `Failed to install dependencies: ${err.message}\n\nPlease install manually:\nsudo apt install ${packages}`
      );
      resolve(false);
    });
    
    proc.on("close", (code) => {
      if (code === 0) {
        console.log("Dependencies installed successfully");
        dialog.showMessageBox({
          type: "info",
          title: "Installation Complete",
          message: "Dependencies installed successfully",
          detail: "All required tools have been installed."
        });
        resolve(true);
      } else {
        console.error(`Installation failed with code ${code}`);
        dialog.showErrorBox(
          "Installation Failed",
          `Installation failed with exit code ${code}\n\nPlease install manually:\nsudo apt install ${packages}`
        );
        resolve(false);
      }
    });
  });
}

module.exports = {
  isToolInstalled,
  checkLinuxDependencies,
  installLinuxDependencies
};

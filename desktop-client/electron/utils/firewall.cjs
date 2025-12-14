const { spawn } = require("child_process");
const fs = require("fs");

let firewallOpened = false;

// Check if UFW rule already exists for a port (without needing root) - Linux
function isUfwRuleExists(port) {
  return new Promise((resolve) => {
    const rulesPath = "/etc/ufw/user.rules";
    
    // Check if UFW rules file exists and is readable
    fs.readFile(rulesPath, "utf8", (err, data) => {
      if (err) {
        // Can't read file - assume rule doesn't exist
        console.log("Could not read UFW rules file, will attempt to add rule");
        resolve(false);
        return;
      }
      
      // Look for a rule that allows the port
      // UFW rules format includes lines like: -A ufw-user-input -p tcp --dport 8080 -j ACCEPT
      const portRegex = new RegExp(`--dport ${port}\\s+-j\\s+ACCEPT`);
      resolve(portRegex.test(data));
    });
  });
}

// Check if Windows Firewall rule already exists for a port (without needing admin)
function isWindowsFirewallRuleExists(port) {
  return new Promise((resolve) => {
    const ruleName = `CtrlDeck-${port}`;
    
    // Use netsh to check if rule exists - this doesn't require admin
    const proc = spawn("netsh", [
      "advfirewall", "firewall", "show", "rule",
      `name=${ruleName}`
    ], { shell: true });
    
    let output = "";
    
    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });
    
    proc.stderr?.on("data", (data) => {
      // Ignore stderr
    });
    
    proc.on("error", () => {
      resolve(false);
    });
    
    proc.on("close", (code) => {
      // If the rule exists, netsh returns 0 and outputs rule details
      // If no rule found, it outputs "No rules match the specified criteria"
      if (code === 0 && !output.includes("No rules match")) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

// Open firewall port to expose backend to the network
async function openFirewallPort(port) {
  return new Promise(async (resolve) => {
    console.log(`Checking firewall for port ${port}...`);
    
    let proc;
    
    if (process.platform === "linux") {
      // Check if UFW rule already exists (no root needed)
      const ruleExists = await isUfwRuleExists(port);
      if (ruleExists) {
        console.log(`Firewall rule for port ${port} already exists, skipping pkexec`);
        firewallOpened = true;
        resolve(true);
        return;
      }
      
      console.log(`Opening firewall port ${port}...`);
      // Use pkexec for GUI authentication on Linux with UFW
      proc = spawn("pkexec", ["ufw", "allow", `${port}/tcp`, "comment", "CtrlDeck"]);
    } else if (process.platform === "win32") {
      // Check if Windows Firewall rule already exists (no admin needed)
      const ruleExists = await isWindowsFirewallRuleExists(port);
      if (ruleExists) {
        console.log(`Firewall rule for port ${port} already exists, skipping admin prompt`);
        firewallOpened = true;
        resolve(true);
        return;
      }
      
      console.log(`Opening firewall port ${port}...`);
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

// Check if firewall was opened
function isFirewallOpened() {
  return firewallOpened;
}

module.exports = {
  isUfwRuleExists,
  isWindowsFirewallRuleExists,
  openFirewallPort,
  closeFirewallPort,
  isFirewallOpened
};

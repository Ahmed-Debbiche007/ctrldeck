const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Custom Expo plugin to properly configure Android network security
 * This ensures HTTP (cleartext) traffic is allowed to local network IPs
 */
function withAndroidNetworkConfig(config) {
  // Step 1: Create the network_security_config.xml file
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const resPath = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml"
      );

      // Create the xml directory if it doesn't exist
      if (!fs.existsSync(resPath)) {
        fs.mkdirSync(resPath, { recursive: true });
      }

      const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext (HTTP) traffic for local development and LAN access -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    
    <!-- Explicitly allow cleartext for common local network ranges -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.0.0/8</domain>
        <domain includeSubdomains="true">172.16.0.0/12</domain>
        <domain includeSubdomains="true">192.168.0.0/16</domain>
    </domain-config>
</network-security-config>`;

      fs.writeFileSync(
        path.join(resPath, "network_security_config.xml"),
        networkSecurityConfig
      );

      return config;
    },
  ]);

  // Step 2: Reference the config in AndroidManifest.xml
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    // Ensure application array exists
    if (!manifest.application) {
      manifest.application = [{}];
    }

    const application = manifest.application[0];

    // Set network security config reference
    application.$["android:networkSecurityConfig"] =
      "@xml/network_security_config";

    // Also ensure usesCleartextTraffic is set (belt and suspenders)
    application.$["android:usesCleartextTraffic"] = "true";

    return config;
  });

  return config;
}

module.exports = withAndroidNetworkConfig;

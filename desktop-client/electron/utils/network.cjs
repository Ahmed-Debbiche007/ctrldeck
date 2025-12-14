const net = require("net");
const http = require("http");

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

module.exports = {
  isPortAvailable,
  findAvailablePort,
  waitForBackend
};

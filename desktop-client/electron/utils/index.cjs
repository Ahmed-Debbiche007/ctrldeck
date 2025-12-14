// Central export for all utility modules

const dependencies = require("./dependencies.cjs");
const firewall = require("./firewall.cjs");
const backend = require("./backend.cjs");
const paths = require("./paths.cjs");
const network = require("./network.cjs");

module.exports = {
  // Dependencies
  ...dependencies,
  
  // Firewall
  ...firewall,
  
  // Backend
  ...backend,
  
  // Paths
  ...paths,
  
  // Network
  ...network
};

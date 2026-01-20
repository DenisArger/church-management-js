/**
 * Helper to require compiled modules from dist/src.
 * Use when running tests from scripts/test/ so ./dist resolves to project root/dist.
 *
 * Usage: const requireDist = require('./require-dist');
 *        const { fn } = requireDist('services/calendarService');
 */
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

function requireDist(modulePath) {
  // modulePath e.g. "utils/pollTextGenerator" or "services/calendarService"
  const full = path.join(PROJECT_ROOT, "dist", "src", ...modulePath.split("/"));
  return require(full);
}

module.exports = requireDist;

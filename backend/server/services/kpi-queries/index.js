/**
 * KPI Query Registry
 *
 * Maps client names to their KPI query modules.
 * To add KPIs for a new client:
 *   1. Create a new file (e.g., flex-mobile.js) exporting fetchKpis(pool)
 *   2. Register it here in the clientKpiModules map
 */
import * as nal from './nal.js';

// Map client name (lowercase) to KPI module
const clientKpiModules = {
  'north american local': nal,
};

/**
 * Get the KPI module for a given client name
 * @param {string} clientName
 * @returns {object|null} Module with fetchKpis(pool) or null
 */
export function getKpiModule(clientName) {
  if (!clientName) return null;
  return clientKpiModules[clientName.toLowerCase()] || null;
}

/**
 * Check if a client has KPIs configured
 * @param {string} clientName
 * @returns {boolean}
 */
export function hasKpis(clientName) {
  return !!getKpiModule(clientName);
}

/**
 * projectRowMapper.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Maps a raw ProjectRecord + its tasks into a fully resolved ProjectRowViewModel.
 * This is the SINGLE transformation point used by the project list UI.
 *
 * Components consume ProjectRowViewModel — never raw ProjectRecord directly.
 *
 * @typedef {import('./types.js').ProjectRecord} ProjectRecord
 * @typedef {import('./types.js').ProjectTask} ProjectTask
 * @typedef {import('./types.js').ProjectRowViewModel} ProjectRowViewModel
 */

import { getProjectPriority, getDaysInStatus, getStatusLabel } from './statusRules.js';
import { getAllOpenTasks, getOpenTasksCount, getOverdueTasksCount } from './tasks.js';
import { getNextAction } from './nextAction.js';

/**
 * Builds a display name from address fields.
 * @param {ProjectRecord} project
 * @returns {string}
 */
const buildDisplayName = (project) => {
  if (project.street) return `${project.street}${project.city ? ', ' + project.city : ''}`;
  if (project.address) return project.address.split(',')[0];
  return project.projectTitle || project.id || '—';
};

/**
 * Main mapper function.
 * @param {ProjectRecord} project
 * @param {Date} [now]
 * @returns {ProjectRowViewModel}
 */
export const mapProjectToRowViewModel = (project, now = new Date()) => {
  const { priority, reason, urgency } = getProjectPriority(project);
  const allTasks = getAllOpenTasks(project);
  const openCount = getOpenTasksCount(allTasks);
  const overdueCount = getOverdueTasksCount(allTasks, now);
  const { action, icon } = getNextAction(project, allTasks);
  const daysInStatus = getDaysInStatus(project);
  const isUnassigned = !project.assignedTo || project.assignedTo.trim() === '';

  return {
    id:                 project.id,
    projectNumber:      project.projectNumber || project.id,
    displayName:        buildDisplayName(project),
    client:             project.client || '—',
    currentStatus:      project.status,
    currentStatusLabel: getStatusLabel(project.status),
    daysInStatus,
    priority,
    reason,
    urgency,
    nextAction:         action,
    nextActionIcon:     icon,
    openTasksCount:     openCount,
    overdueTasksCount:  overdueCount,
    assignedTo:         project.assignedTo || null,
    isUnassigned,
    lastActivityAt:     project.lastActivityAt || null,
    tasks:              allTasks,
    // Pass-through for status change button
    _raw:               project,
  };
};

/**
 * Maps an array of ProjectRecords to row view models.
 * @param {ProjectRecord[]} projects
 * @returns {ProjectRowViewModel[]}
 */
export const mapProjectsToRows = (projects) => {
  const now = new Date();
  return projects
    .filter(p => p.status !== 'Abgeschlossen' && p.status !== 'rechnung')
    .map(p => mapProjectToRowViewModel(p, now));
};

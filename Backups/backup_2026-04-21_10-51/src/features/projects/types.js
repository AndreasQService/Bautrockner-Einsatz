/**
 * types.js
 * JSDoc type definitions for the Office Project Control feature.
 * These provide IDE intellisense and documentation without requiring TypeScript.
 *
 * DESIGN RULE:
 *   Status = broad project phase (managed by office only)
 *   Tasks  = concrete work items within a phase (auto-derived or manual)
 *
 * Technician mode does NOT interact with these types directly.
 */

/**
 * @typedef {'green' | 'yellow' | 'red'} ProjectPriority
 */

/**
 * Canonical project phases. Must stay lean — no micro-states.
 * Micro-steps (e.g. "call tenant") are Tasks, not Statuses.
 * @typedef {'eingang' | 'kontakt' | 'aufnahme' | 'leckortung' | 'bericht' | 'trocknung' | 'instandstellung' | 'rechnung'} ProjectStatus
 */

/**
 * @typedef {'auto' | 'manual'} TaskCategory
 */

/**
 * @typedef {Object} ProjectTask
 * @property {string}          id          - UUID
 * @property {string}          projectId   - Parent project ID
 * @property {string}          title       - Human-readable task title
 * @property {boolean}         done        - Whether task is completed
 * @property {string|null}     dueDate     - ISO date string or null
 * @property {TaskCategory}    category    - 'auto' (derived) or 'manual'
 * @property {boolean}         urgent      - Whether task is overdue/critical
 * @property {string}          createdAt   - ISO timestamp
 */

/**
 * Core project record as stored in / fetched from Supabase damage_reports.
 * Fields map to BOTH the flat report_data JSON blob and the indexed columns.
 * @typedef {Object} ProjectRecord
 * @property {string}           id
 * @property {string}           projectNumber
 * @property {string}           projectTitle
 * @property {string|null}      address
 * @property {string|null}      street
 * @property {string|null}      city
 * @property {string|null}      zip
 * @property {string|null}      client
 * @property {string}           status          - Current status string (maps to ProjectStatus via STATUS_MAP)
 * @property {string|null}      statusStartedAt - ISO timestamp of status change
 * @property {string|null}      assignedTo      - Assignee name
 * @property {string|null}      lastActivityAt  - ISO timestamp of last activity
 * @property {string|null}      date            - Project creation date (ISO)
 * @property {string|null}      dryingStarted   - ISO timestamp drying started
 * @property {Array}            contacts        - Contact list
 * @property {Array}            rooms           - Room list (with measurements)
 * @property {Array}            equipment       - Equipment list
 * @property {Array}            images          - Image list
 * @property {ProjectTask[]}    officeTasks     - Manually added office tasks
 * @property {Object[]}         statusHistory   - Status history entries
 */

/**
 * Status history entry (stored locally or in project_status_history table).
 * @typedef {Object} ProjectStatusHistoryEntry
 * @property {string}               id
 * @property {string}               projectId
 * @property {string|null}          oldStatus
 * @property {string}               newStatus
 * @property {string}               changedAt   - ISO timestamp
 * @property {string|null}          changedBy   - User name
 * @property {string|null}          reason
 */

/**
 * Fully resolved view model consumed by the project list row component.
 * Created by mapProjectToRowViewModel().
 * @typedef {Object} ProjectRowViewModel
 * @property {string}           id
 * @property {string}           projectNumber
 * @property {string}           displayName       - Street + city or title
 * @property {string}           client
 * @property {string}           currentStatus     - Raw status string
 * @property {string}           currentStatusLabel - Human-readable label
 * @property {number|null}      daysInStatus
 * @property {ProjectPriority}  priority
 * @property {string}           reason            - Why this priority
 * @property {number}           urgency           - Days-based urgency score (for sorting)
 * @property {string}           nextAction        - Concrete action text
 * @property {string}           nextActionIcon    - Emoji icon for action
 * @property {number}           openTasksCount
 * @property {number}           overdueTasksCount
 * @property {string|null}      assignedTo
 * @property {boolean}          isUnassigned
 * @property {string|null}      lastActivityAt
 * @property {ProjectTask[]}    tasks             - All open tasks for detail view
 */

/**
 * Aggregated dashboard statistics.
 * @typedef {Object} DashboardStats
 * @property {number}       total
 * @property {number}       red
 * @property {number}       yellow
 * @property {number}       green
 * @property {number}       unassigned
 * @property {number}       openReports
 * @property {number}       openInvoices
 * @property {number}       noActivity
 * @property {number|null}  avgDaysLeckortung
 * @property {number|null}  avgDaysTrocknung
 */

/**
 * @typedef {'all' | 'critical' | 'delayed' | 'reportOpen' | 'invoiceOpen' | 'unassigned' | 'noActivity'} ProjectFilterKey
 */

/**
 * Result returned by updateProjectStatus().
 * @typedef {Object} StatusUpdateResult
 * @property {boolean}      success
 * @property {string|null}  error
 * @property {ProjectRecord|null} project
 */

// This file exports nothing at runtime — it is pure JSDoc documentation.
export {};

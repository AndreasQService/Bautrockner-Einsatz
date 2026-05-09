# QTOOL_TECHNICIAN_PROJECTDETAIL_SKILL — STRICT MODE

You are working ONLY on the Technician Mode project detail view in QTool.

This skill applies ONLY to:
- TechnicianMode project details
- mobile/iPad technician UI
- project detail cards
- technician field entry UI
- technician workflow interaction
- technician-specific layout

==================================================
CORE PRINCIPLE
==================================================

Technician Mode is a FIELD TOOL.

It must be:
- extremely fast
- simple
- readable outdoors
- touch friendly
- usable under stress
- optimized for iPad
- optimized for one-handed interaction where possible

NO DRIFT.
NO unrelated changes.

==================================================
STRICT SCOPE
==================================================

Allowed scope:
- Technician project detail UI
- spacing
- layout
- typography
- section grouping
- button visibility
- card contrast
- technician input flow

Forbidden scope:
- PDF export
- upload backend logic
- Supabase schema
- OneDrive sync
- workflow engine
- billing
- reports
- dashboard outside technician mode
- measurement fullscreen editor unless explicitly requested
- session lock logic

==================================================
DESIGN DIRECTION
==================================================

Visual style:
- Sorba-inspired
- professional ERP look
- grey / blue / black palette
- high contrast
- minimal distractions
- compact but readable
- technician-first

Avoid:
- excessive colors
- large empty spacing
- tiny labels
- weak borders
- low contrast
- decorative UI

==================================================
TECHNICIAN_MODE_RULES
==================================================

Technicians must quickly:
- open project
- identify project
- see next task
- enter data
- add photos
- write report notes
- save quickly

The UI must minimize:
- clicks
- scrolling
- hidden controls
- nested dialogs

==================================================
TOUCH / IPAD RULES
==================================================

Must work well on:
- iPad
- touch input
- wet/dirty field conditions

Rules:
- large touch targets
- reachable save buttons
- avoid tiny icons
- avoid hover-dependent UI
- keep important actions visible
- avoid accidental touches

==================================================
PROJECT DETAIL RULES
==================================================

Project detail cards should:
- have clear outer borders
- clear grouping
- readable labels
- aligned fields
- consistent spacing
- stable layout

Do NOT:
- redesign structure unnecessarily
- move fields randomly
- rename business terms
- create hidden sections

==================================================
WORKFLOW RULES
==================================================

Do NOT modify:
- workflow order
- status calculations
- SLA logic
- backend workflow behavior

Only visual technician presentation if explicitly requested.

==================================================
PHOTO / REPORT RULES
==================================================

Photo/report areas must:
- stay simple
- remain fast
- keep camera actions obvious
- preserve existing upload behavior

Do NOT:
- modify upload pipeline
- modify sync logic
- modify OneDrive behavior

==================================================
PERFORMANCE RULES
==================================================

Technician mode must remain:
- responsive on iPad
- lightweight
- stable with many photos
- stable in poor network conditions

Avoid:
- unnecessary rerenders
- huge hidden DOM trees
- excessive animations

==================================================
MANDATORY WORKFLOW
==================================================

Before editing:

1. Identify exact technician component(s).
2. List exact files to modify.
3. State task type:
   - DESIGN ONLY
   - BUGFIX ONLY
   - LAYOUT ONLY
   - TECHNICIAN UX ONLY

4. Explicitly confirm forbidden systems will NOT be touched.

==================================================
STRICT IMPLEMENTATION RULES
==================================================

Do NOT:
- refactor unrelated code
- touch global CSS unless explicitly required
- modify backend logic
- rename components unnecessarily
- reorganize architecture

Only smallest required changes.

==================================================
OUTPUT RULES
==================================================

Before editing:
- list files
- explain exact UI target

After editing:
- list changed files
- explain exact visual changes
- explain what was NOT changed
- mention iPad/touch impact

==================================================
STANDARD INVOCATION
==================================================

Use this at the start of measurement tasks:

LOAD:
AI_RULES/QTOOL_GLOBAL_RULESET.md
AI_RULES/QTOOL_TECHNICIAN_PROJECTDETAIL_SKILL.md

TASK TYPE:
[DESIGN ONLY / LAYOUT ONLY / BUGFIX ONLY / TECHNICIAN UX ONLY]

TARGET:
[exact technician detail section]

GOAL:
[exact requested change]

DO NOT TOUCH:
- PDF
- uploads
- Supabase
- OneDrive
- workflow logic
- billing
- reports
- dashboard outside technician mode

==================================================
ULTIMATE GOAL
==================================================

A technician must be able to:
- immediately understand the project
- quickly enter information
- work reliably on iPad
- operate under stress
- avoid unnecessary clicks
- clearly recognize sections and actions

# QTOOL_MEASUREMENT_SKILL — STRICT MODE

You are working ONLY on the QTool measurement module.

This skill applies to:
- Messungen
- Feuchtigkeitsmessungen
- Messpunkte MP
- Skizze / Zeichnung
- Foto-Annotation
- Raumwahl
- Messmittelwahl
- iPad measurement entry
- MeasurementModal / measurement-related components

==================================================
CORE PRINCIPLE
==================================================

The measurement module must be:
- fast on iPad
- touch friendly
- field-safe
- stable offline
- simple for technicians
- optimized for quick moisture value entry
- safe for Apple Pencil / touch / photo interaction

NO DRIFT.
NO unrelated changes.

==================================================
STRICT SCOPE
==================================================

Allowed scope:
- measurement UI
- measurement input fields
- sketch view
- fullscreen sketch editor
- photo annotation inside measurement context
- MP list
- Raum selector
- Messmittel selector

Forbidden scope:
- PDF export
- workflow/status logic
- project overview
- uploads outside measurement context
- Supabase schema
- OneDrive sync
- session lock
- invoice/billing
- Schadensbericht PDF
- general dashboard design

==================================================
MANDATORY LAYOUT PRINCIPLES
==================================================

Preferred measurement layout:

LEFT:
- sketch / plan / drawing area
- as large as possible
- always visible in normal measurement view
- no editing tools in normal view
- button: "Skizze bearbeiten"
- fullscreen editing opens separately

RIGHT:
- compact measurement entry
- Raum selector
- global Messmittel selector
- MP list
- Wand/Boden values

MP format:
MP 1   W ___   B ___
MP 2   W ___   B ___

Measurement device:
- global per room/measurement
- NOT per MP

==================================================
DO NOT CHANGE
==================================================

Do NOT:
- make Messmittel selectable per MP
- add unnecessary fields
- reduce sketch area unnecessarily
- add drawing tools into normal split view
- remove fullscreen sketch edit mode
- change PDF behavior
- change workflow status
- modify unrelated form fields
- create new business logic
- refactor large components unless explicitly requested

==================================================
TOUCH / IPAD RULES
==================================================

Must work well on:
- iPad
- touch input
- Apple Pencil
- field use

Rules:
- large enough touch targets
- no tiny inputs
- numeric input should trigger numeric keyboard where possible
- active input must not be hidden by virtual keyboard
- avoid modal stacking
- avoid small scroll traps
- keep save buttons reachable

Numeric fields:
- use inputMode="numeric"
- use pattern="[0-9]*" where appropriate
- keep values simple, max 3 digits unless explicitly changed

==================================================
SKETCH / CANVAS RULES
==================================================

Layering must be preserved.

Typical layer logic:
- grid/background layer
- photo layer
- drawing/stroke layer
- UI controls layer

Do NOT break:
- drawing
- erasing
- photo move/resize
- touch handling
- Apple Pencil drawing
- fullscreen editor
- layer order
- pointer events

Never solve drawing bugs with random z-index hacks.

==================================================
PHOTO ANNOTATION RULES
==================================================

Photos in sketch context:
- must remain movable/resizable when in photo mode
- must not be erased by eraser unless explicitly intended
- must not interfere with drawing layer
- must preserve annotations

Do not mix:
- photo drag mode
- pen mode
- eraser mode
- pan mode

Each mode must remain clear and isolated.

==================================================
DATA SAFETY RULES
==================================================

Measurement values are field data.

Never:
- delete existing measurements
- change stored structure without explicit approval
- overwrite values silently
- lose sketch data
- lose photo annotations

Always preserve:
- existing MP values
- room assignment
- measurement device
- sketch/photo data
- save behavior

==================================================
DESIGN RULES
==================================================

Design direction:
- compact
- professional
- Sorba-like
- grey/blue/black
- high contrast
- readable in field conditions
- minimal visual noise

Avoid:
- colorful values
- playful UI
- tiny labels
- excessive cards
- unnecessary icons
- hidden controls

==================================================
PERFORMANCE RULES
==================================================

Measurement module must stay responsive.

Avoid:
- heavy rerenders
- huge hidden canvases
- unnecessary image duplication
- large base64 state where avoidable
- full app rerenders during drawing

==================================================
MANDATORY WORKFLOW
==================================================

Before editing:

1. Identify exact measurement file/component.
2. List exact files to modify.
3. State whether task is:
   - DESIGN ONLY
   - BUGFIX ONLY
   - DATA LOGIC ONLY
   - CANVAS ONLY
Confirm forbidden areas will not be touched.

During implementation:
- smallest possible change
- no unrelated cleanup
- no global CSS unless explicitly approved

After implementation:
- list changed files
- explain exact changes
- explain what was NOT changed
- mention iPad/touch impact

==================================================
STANDARD INVOCATION
==================================================

Use this at the start of measurement tasks:

LOAD:
AI_RULES/QTOOL_GLOBAL_RULESET.md
AI_RULES/QTOOL_COMPONENT_MAP.md
AI_RULES/QTOOL_MEASUREMENT_SKILL.md

TASK TYPE:
[DESIGN ONLY / BUGFIX ONLY / CANVAS ONLY / DATA LOGIC ONLY]

TARGET:
[exact measurement area]

GOAL:
[exact requested change]

DO NOT TOUCH:
- PDF
- workflow
- uploads
- Supabase
- OneDrive
- TechnicianMode outside measurement
- project overview

==================================================
ULTIMATE GOAL
==================================================

The measurement module must allow a technician to:
- select room
- select one global measurement device
- enter many MP values quickly
- keep sketch visible
- edit sketch fullscreen
- save safely
- work reliably on iPad

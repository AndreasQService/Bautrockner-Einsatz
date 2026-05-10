# QTool UI Contrast Audit Report (Light Mode)

## Final Summary
- **Pages/States Tested**: ~10 per viewport
- **Screenshots Captured**: 5
- **Critical Findings**: 2
- **Medium Findings**: 6
- **Cosmetic Findings**: 0 (script focused on WCAG failures)

## Critical Findings (White-on-White / Black-on-Dark)

### 1. [Dashboard] BUTTON Element
- **Text**: "Aktuell"
- **DOM Class**: ``
- **Viewport**: Desktop_1440x900
- **Screenshot**: [Link](AI_REPORTS/screenshots/light-mode-audit/Desktop_1440x900_Dashboard.png)
- **Text Color**: #4B5563
- **Background Color**: #1E6DB7
- **Ratio**: 1.41:1 (Required: 4.5:1)
- **Severity**: CRITICAL (Black text on dark background)
- **Guideline**: WCAG 2.2 Contrast, Apple HIG
- **Recommended Fix**: Adjust colors to ensure at least 4.5:1 contrast.

### 2. [ProjektDetails] BUTTON Element
- **Text**: "Aktuell"
- **DOM Class**: ``
- **Viewport**: iPad_Landscape_1024x768
- **Screenshot**: [Link](AI_REPORTS/screenshots/light-mode-audit/iPad_Landscape_1024x768_ProjektDetails.png)
- **Text Color**: #4B5563
- **Background Color**: #1E6DB7
- **Ratio**: 1.41:1 (Required: 4.5:1)
- **Severity**: CRITICAL (Black text on dark background)
- **Guideline**: WCAG 2.2 Contrast, Apple HIG
- **Recommended Fix**: Adjust colors to ensure at least 4.5:1 contrast.

## Medium Findings (Low Contrast)

| Section | Element/Text | Text Color | Bg Color | Ratio | Required |
|---------|--------------|------------|----------|-------|----------|
| Dashboard | BUTTON ("✕") | #6366F1 | #F1F5F9 | 4.08 | 4.5 |
| Dashboard | BUTTON ("") | #EF4444 | #FFFFFF | 3.76 | 4.5 |
| Dashboard | BUTTON ("") | #25D366 | #FFFFFF | 1.98 | 4.5 |
| ProjektDetails | BUTTON ("✕") | #10B981 | #F1F5F9 | 2.32 | 4.5 |
| ProjektDetails | BUTTON ("") | #EF4444 | #FFFFFF | 3.76 | 4.5 |
| ProjektDetails | BUTTON ("") | #25D366 | #FFFFFF | 1.98 | 4.5 |

# Design System — Meridian

## Brand

**Primärfarbe:** Meridian Pink `#E040FB`
**Stil:** Minimal, professionell, Linear-ähnlich
**Layout:** Dunkle Sidebar, heller Content-Bereich

## Farben

| Token | Hex | Verwendung |
|-------|-----|------------|
| `primary` | `#E040FB` | CTAs, aktive States, Badges, Links |
| `primary-dark` | `#AA00FF` | Hover/aktiv auf primary |
| `sidebar-bg` | `#0F0F11` | Sidebar-Hintergrund |
| `content-bg` | `#FAFAFA` | Haupt-Content-Bereich |
| `surface` | `#FFFFFF` | Karten, Modals |
| `border` | `#E5E5E5` | Trennlinien, Rahmen |
| `text-primary` | `#111111` | Haupttext |
| `text-muted` | `#6B7280` | Sekundärtext, Labels |
| `success` | `#10B981` | Erfolgsmeldungen, Approved-Status |
| `warning` | `#F59E0B` | Warnungen, In Progress |
| `error` | `#EF4444` | Fehler, Destructive Actions |

## Typografie

- **Font:** Inter (system-ui Fallback)
- **Heading 1:** 24px, font-semibold
- **Heading 2:** 18px, font-semibold
- **Body:** 14px, font-normal
- **Caption:** 12px, font-normal, text-muted

## Layout

- **Sidebar:** 240px fix, `sidebar-bg`, weiße Icons/Text
- **Content:** flex-1, `content-bg`, max-width 960px zentriert
- **Spacing:** 4px Grid (Tailwind default)
- **Border-Radius:** 6px für Karten/Buttons, 4px für Inputs

## Komponenten-Prinzipien

- shadcn/ui als Basis — nie eigene Versionen bauen
- Jede async Operation hat Loading State (Spinner oder Skeleton)
- Jeder leere Zustand hat klaren Call-to-Action
- Kein Mobile-Breakpoint für MVP

## Status-Badges

| Status | Farbe |
|--------|-------|
| running | `#3B82F6` (blue) |
| completed | `#10B981` (green) |
| high priority | `#E040FB` (primary) |
| medium priority | `#F59E0B` (warning) |
| low priority | `#6B7280` (muted) |

## Use Case Typ-Icons

- `automation` — ⚡
- `llm_extraction` — 📄
- `decision_support` — 🎯
- `rag` — 🔍

---
name: Clonehand
description: Drive a simulated right hand one muscle at a time and see what moves.
colors:
  bench-paper: "#f6f4ee"
  card-white: "#fffefa"
  graphite-ink: "#252b2b"
  lichen-grey: "#626860"
  hairline: "#d7d7ce"
  selection-teal: "#166b65"
  selection-teal-deep: "#11534e"
  selection-wash: "#e4eeea"
  activation-red: "#c85836"
  activation-red-deep: "#9e4127"
  resting-path: "#9b958b"
  belly-relaxed: "#c98f84"
  belly-active: "#b3261e"
  belly-context: "#c4aaa3"
  tendon-blue-grey: "#9fb3ba"
  bone-ivory: "#f0e9d9"
  error-wash: "#f7e2d9"
  error-ink: "#6e3220"
typography:
  headline:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "23px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  brand:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.035em"
  title:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  reading:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    fontFeature: "tnum"
  body:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "11px"
    fontWeight: 500
rounded:
  control: "4px"
  none: "0"
  dot: "50%"
spacing:
  row: "11px 16px 8px"
  panel: "22px"
  gutter: "16px"
components:
  button-primary:
    backgroundColor: "{colors.selection-teal}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-primary-hover:
    backgroundColor: "{colors.selection-teal-deep}"
  button-secondary:
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
    height: "36px"
  muscle-row-selected:
    backgroundColor: "{colors.selection-wash}"
    padding: "{spacing.row}"
  error-banner:
    backgroundColor: "{colors.error-wash}"
    textColor: "{colors.error-ink}"
---

# Design System: Clonehand

## Overview

**Creative North Star: "The Specimen Bench"**

The app should feel like a well-lit bench in an anatomy lab: a pale work surface, an ivory skeleton in the middle, and the instruments arranged around it. The left panel lists muscles and their excitation sliders. The centre is the 3D hand. The right panel reads out what the selected muscle is doing. Chrome stays quiet so that the hand and its readings carry the screen.

Color carries meaning, not decoration. Two hues do almost all the work: teal says "this is what you selected" and brick red says "this muscle is active". Everything else is paper, graphite, and hairlines. The interface is dense, because people compare numbers across 39 to 44 muscles, but it never stacks cards or shadows to get there.

The source of truth is `src/gui/style.css` (CSS variables on `:root`) and the material colors in `src/gui/viewer.ts`. This file describes them; if they disagree, the code wins and this file needs updating.

**Key Characteristics:**
- Selection (teal) and activation (red) are separate and never share a color.
- Measured state (activation, angles, force) is shown as numbers with tabular figures.
- Flat surfaces divided by hairlines; no drop shadows on panels.
- One typeface, IBM Plex Sans, in three weights.

## Colors

A warm off-white bench with graphite text, one teal for selection, and one red family for activation.

### Primary
- **Selection Teal**: the selected muscle's path, outline, list row tint, primary buttons, focus rings, and slider accents. Teal only ever means "selected" or "act on this".
- **Activation Red**: an active muscle's path, the excitation readout, and joint-limit flags. It means the simulation is producing force. The deep variant is used for text so it stays readable on paper.

### Secondary
- **Belly reds** (relaxed, active, context): the belly & tendon view blends from the relaxed pink-brown to the active red as activation rises. Relaxed, unselected bellies use the faint context color at low opacity so they never hide the selected muscle.
- **Tendon Blue-Grey**: tendons in the belly view. Pale and cool, so tendons read as a different tissue from bellies.

### Neutral
- **Bench Paper**: page and panel background.
- **Card White**: inputs and text on teal.
- **Graphite Ink**: body text and headings.
- **Lichen Grey**: secondary text, captions, and units.
- **Hairline**: panel and row dividers.
- **Bone Ivory**: bone meshes in the 3D view.
- **Resting Path**: relaxed, unselected muscle paths.

### Named Rules
**The Two Signals Rule.** Teal is selection, red is activation, and neither is used for anything else. A selected muscle that is also active keeps its red fill and gains a teal outline; it never turns teal.

**The Context Recedes Rule.** In the 3D view, anything that is neither selected nor active is drawn faint (bellies at 0.14 opacity, tendons at 0.22, paths at 0.22). Emphasis comes from the other muscles fading, not from the selected one getting louder.

## Typography

**Body Font:** IBM Plex Sans (fallback: sans-serif), loaded locally via @fontsource in weights 400, 500, and 600.

**Character:** A plain technical sans with clear figures. It reads like an instrument label, which suits a tool that is mostly names and numbers.

### Hierarchy
- **Brand** (600, 24px, −0.035em): the "Clonehand" wordmark in the header only.
- **Headline** (500, 23px, line-height 1.25, −0.025em, balanced wrapping): the selected muscle's name in the inspector.
- **Title** (600, 15–16px): panel headings such as "Muscles" and "Right hand & wrist".
- **Reading** (400, 18px, tabular figures): measured values such as activation, force, and belly length.
- **Body** (400, 13px): descriptions, button text, and the muscle list.
- **Label** (500, 10–12px): units, captions, legend entries, muscle codes, and limit flags.

### Named Rules
**The Tabular Numbers Rule.** Every number that changes while the simulation runs uses tabular figures, so columns don't jitter at 30 updates a second.

## Layout

A three-column workspace fills the window below the header: muscle list (260px), 3D view (flexible, at least 320px), and inspector (310px). At 1500px and wider the side columns grow to 280px and 340px. Below 1150px they shrink to 220px and 280px. Below 880px the inspector moves under the 3D view. Below 600px (phones in portrait) the screen becomes an app frame: the 3D view stays at the top (34% of the viewport height, framed on the hand and wrist), then one scrolling row of view options, the run controls, and two tabs. The tabs switch the remaining space between the muscle list and the selected muscle, so the hand is always visible while muscles are chosen and driven. Sliders grow to 32px tall for touch. On short landscape screens the muscle list and the hand sit side by side at full height, with the inspector below. The page body never scrolls sideways.

**The Hand Stays Visible Rule.** On any screen, choosing a muscle or moving its slider must not push the 3D view off screen.

Rows in the muscle list use 11px top and 16px side padding with a hairline between rows. The inspector uses 22px padding. The 3D view keeps its legend and view caption as overlays in its corners, so the hand gets the full panel. It opens on the belly & tendon view, looking straight at the palm.

## Elevation & Depth

The interface is flat. Panels sit side by side on the same paper, separated by 1px hairlines, with no shadows. Depth exists only inside the 3D view, from the scene lighting (a hemisphere light plus a key and a fill). The only box-shadow is the 2px teal ring on the "selected" legend swatch, which mirrors the outline drawn around the selected belly.

## Shapes

Controls have small 4px corners. Segmented controls (Belly & tendon / Paths; Palm / Dorsal / Radial / Ulnar / reset) join their buttons with square inner edges and keep the 4px radius only on the outer ends. Panels, rows, and the 3D view have square corners. Status dots and activation indicators are circles.

## Components

### Buttons
- **Shape:** gently rounded (4px), at least 36px tall.
- **Primary:** Selection Teal fill with Card White text, used for Run/Pause only. Hover and press go one and two steps darker.
- **Secondary:** transparent with a hairline border and graphite text: Reset, Relax all, view toggles. Hover adds a light paper tint.
- **Focus:** every control shows a 2px teal outline offset by 3px.

### Inputs / Fields
- **Search field:** hairline border, 4px radius, Card White fill, 38px tall, with a search icon inset on the left.
- **Excitation sliders:** native range inputs tinted teal. The value shows to two decimals next to each slider, and the selected muscle's excitation repeats large in the inspector in Activation Red.

### Muscle list rows
Each row shows the muscle name, its model code, a small activation dot, and its slider. The selected row gets the Selection Wash background. The dot fills red when activation passes 2.5%. Selecting a row never changes its excitation.

### Inspector readouts
Label-over-value pairs (Measured activation, Muscle force, Belly length, Tendon length) set in the Reading style. A joint table lists each DOF the muscle crosses with its moment arm, the direction of pull, the measured angle, and an *At flexion limit* style flag in Activation Red Deep when the joint sits at a limit.

### 3D view legend
Short line samples for Selected, Active, and Resting in the paths view; a belly gradient swatch, an outlined swatch, a faint context swatch, and a tendon line in the belly view. The legend always matches the colors set in `viewer.ts`.

### Error banner
A full-width strip under the header in a pale red-brown wash with dark red-brown text and one action button (Reconnect, or Restart in the browser demo). It explains what failed and what to do next.

## Do's and Don'ts

### Do:
- **Do** keep selection and activation visually separate (The Two Signals Rule).
- **Do** show measured values next to their units and label moment arms as influence, not motion.
- **Do** fade context muscles rather than brightening the selected one.
- **Do** use tabular figures for any value that updates while running.
- **Do** keep every new color in `style.css` variables or the `viewer.ts` material table, and update this file when either changes.

### Don't:
- **Don't** use teal or red for decoration, headings, or links.
- **Don't** add drop shadows or card stacks to panels; divide with hairlines.
- **Don't** introduce a second typeface.
- **Don't** let any element push the page wider than the viewport at 390px.

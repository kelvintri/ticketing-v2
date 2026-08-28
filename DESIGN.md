---
name: Ticket.Ops
description: Trustworthy Service Command Center untuk operasi helpdesk berbasis AI dan SLA.
colors:
  primary: "#1769e0"
  navy: "#102a52"
  cyan: "#087ea4"
  canvas: "#f6f8fc"
  surface: "#ffffff"
  line: "#e2e8f2"
  ink: "#17233b"
  muted: "#66758f"
  success: "#16794c"
  warning: "#c77910"
  danger: "#c53b49"
  primary-soft: "#eaf2ff"
  cyan-soft: "#e8f8fc"
  warning-soft: "#fff5e2"
  danger-soft: "#fff0f2"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(1.8rem, 4vw, 2.7rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
  body:
    fontFamily: "DM Sans, Arial, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "DM Sans, Arial, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  control: "9px"
  surface: "14px"
  chip: "999px"
spacing:
  compact: "0.75rem"
  regular: "1rem"
  surface: "1.2rem"
  page: "clamp(1.25rem, 4vw, 3rem)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0.7rem 1rem"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "0.7rem 1rem"
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.75rem"
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "1.2rem"
  chip-status:
    rounded: "{rounded.chip}"
    padding: "0.28rem 0.55rem"
---

## Overview

**Creative North Star: "Trustworthy Service Command Center."** Ticket.Ops is a calm, professional operating console for agents who must rapidly understand ticket status, SLA risk, and AI-provided context. The system earns trust with a high-clarity workspace, disciplined semantic status colors, and generous white space rather than ornamental technical styling.

The navy navigation frame establishes a stable operations context; the light canvas keeps tables, forms, and reporting easy to scan for sustained work. Blue is the action voice, cyan identifies AI assistance, and warm colors carry only service risk. Small lifts and short state transitions add a friendly, capable energy without making the workspace feel playful or noisy.

**Key Characteristics:**

- Operational clarity before decoration.
- Restrained depth with approachable motion.
- AI is visibly helpful but never visually authoritative over an agent.
- Semantic color has one stable meaning across the product.

## Colors

The palette is a trustworthy blue system: deep navy frames the work, clear blue moves it forward, cyan signals AI context, and semantic warm/cool tones communicate service health.

### Primary

- **Service Blue:** Primary action, active controls, links, and the visual anchor for ticket operations.
- **Command Navy:** Persistent navigation and high-confidence brand framing.

### Secondary

- **Assist Cyan:** AI insight, knowledge context, and supporting intelligent-assistance signals. It must not communicate a ticket status.

### Tertiary

- **Service Green:** Resolved or safe SLA states only.
- **SLA Amber:** Warning, approaching deadline, or elevated ticket priority only.
- **SLA Red:** Breached SLA, urgent priority, error, or destructive action only.

### Neutral

- **Cool Canvas:** Default application workspace and page background.
- **Clean Surface:** Forms, cards, tables, and dialog surfaces.
- **Quiet Line:** Structural separation between controls, rows, and panels.
- **Operational Ink:** Primary reading color for headings, values, and agent-owned information.
- **Support Muted:** Secondary explanatory copy, dates, and labels.

**The Semantic Signal Rule.** Status, SLA, priority, and AI assistance must never borrow each other's color roles. Every status signal is paired with readable text and, where relevant, a dot indicator.

## Typography

**Display Font:** Manrope (with sans-serif fallback)

**Body Font:** DM Sans (with Arial fallback)

**Character:** Manrope gives operational headings a compact, confident edge; DM Sans maintains an open, familiar reading rhythm for extended ticket and report content. Labels are compact and deliberate, while body copy stays conversational in Indonesian.

### Hierarchy

- **Display:** Used for page-level headings and high-salience numerical values.
- **Title:** Used for panel, card, and section headings within a workspace.
- **Body:** Used for descriptions, ticket text, reports, and supporting instructions.
- **Label:** Used for filter labels, metadata, compact navigation, and eyebrow-level categorization.

**The Scan-First Type Rule.** A heading, its immediate purpose, and its primary action should be understandable without reading every supporting label.

## Layout

The desktop application shell uses a fixed-width, sticky navy sidebar and a fluid light workspace. Content is capped at a wide but readable container, with page padding that scales from compact mobile gutters to a generous desktop gutter. The primary dashboard uses a six-metric row that collapses to three and then two columns; workspaces reduce from paired columns to a single continuous task column on narrow screens.

Mobile navigation replaces the sidebar with a compact top header. Tables preserve data integrity through horizontal overflow rather than compressed or hidden columns. Forms, filters, modals, and dashboard groups stack at the narrow breakpoint so every primary control remains discoverable.

**The Workspace Priority Rule.** The main task surface gets the most width; metadata, context, and secondary actions yield first when space is constrained.

## Elevation & Depth

Depth is restrained and structural. White work surfaces use a faint ambient lift to separate them from the cool canvas; they do not stack shadow on top of heavy outlines. The sidebar receives its authority from navy contrast rather than elevation. AI callouts use tonal cyan surfaces and a fine cyan boundary rather than a larger shadow.

### Shadow Vocabulary

- **Ambient Surface Lift:** Used on cards, tables, and panels to gently establish task groups against the canvas.
- **Dialog Lift:** Used only for modal focus and interruption, with a soft navy-tinted shadow and blurred backdrop.

**The Quiet Elevation Rule.** Use either a restrained boundary or ambient lift to group a surface; never use heavy shadow as decoration.

## Shapes

Controls use gently rounded corners; larger work surfaces have a more generous, consistent radius. Compact state indicators are pills, while layout containers never become pill-shaped. Borders are cool and fine, providing order without turning the interface into a grid of boxes.

## Components

### Buttons

- **Character:** Direct, confident controls for agent decisions.
- **Primary:** Service Blue fill with white text; reserved for the dominant action within a local group.
- **Secondary / Ghost:** White surface with a quiet border and muted text for exports, cancellation, and lower-emphasis actions.
- **Hover / Focus:** Hover is a small brightness adjustment; keyboard focus uses a soft blue focus ring that remains visible against light surfaces.

### Chips

- **Style:** Compact pill labels with a semantic soft background, readable text, and a small dot for status, priority, or SLA states.
- **State:** Status chips, priority chips, and SLA chips are distinct component roles but share the same compact silhouette and semantic-color discipline.

### Cards / Containers

- **Character:** Calm, white work surfaces with generous internal breathing room.
- **Internal Padding:** Use the surface spacing token for regular panels and the regular spacing token for dense metric cards.
- **Special Variants:** Risk metrics use warning-toned detail; AI insight cards use cyan framing and clearly state that human review remains required.

### Inputs / Fields

- **Style:** White fields with quiet structural boundaries and body typography.
- **Focus:** A visible blue boundary plus soft focus ring; labels remain outside the field for clear context.
- **Error / Disabled:** Errors use the danger role with explicit copy. Disabled controls reduce emphasis but keep their label readable.

### Navigation

- **Style:** A sticky Command Navy sidebar on desktop with light text, compact item labels, and a white translucent active state.
- **Mobile Treatment:** The sidebar is replaced with a compact navy header while the page workspace becomes single-column.

### AI Insight

- **Character:** A contextual recommendation card, never a command surface.
- **Treatment:** Assist Cyan identifies the panel and its confidence label. The card must state that AI provides context and a draft only; agents own the final response and ticket action.

## Do's and Don'ts

### Do:

- **Do** use Service Blue for the primary action and active operational state.
- **Do** make SLA risk, breach, completion, priority, and ticket status explicit in text as well as color.
- **Do** use Assist Cyan exclusively to identify AI context, knowledge help, and reviewable recommendations.
- **Do** keep motion short, subtle, and informative: a card or button may lift or brighten on hover, but it should never distract from an active ticket.
- **Do** preserve the dense-to-spacious responsive rhythm: stack groups before shrinking text or hiding task information.

### Don't:

- **Don't** use cyan as a substitute for a ticket status or SLA outcome.
- **Don't** make AI actions appear autonomous, irreversible, or more prominent than an agent's decision.
- **Don't** use amber or red decoratively; they are reserved for priority, risk, breach, error, and destructive moments.
- **Don't** add dark terminal textures, acid accents, or ornamental data-grid treatments to the light operational workspace.
- **Don't** compress tables into unreadable mobile cards when horizontal scrolling preserves the data more faithfully.

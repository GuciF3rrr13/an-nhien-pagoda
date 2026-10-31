---
name: Chùa An Nhiên LIVE
description: A golden painted Vietnamese temple with a quiet ivory and jade operator interface.
colors:
  jade-primary: "#224e37"
  jade-hover: "#183e2a"
  jade-navigation: "#19382c"
  jade-navigation-hover: "#244837"
  jade-active-text: "#224632"
  ivory-background: "#f5f3ec"
  ivory-paper: "#fffcf6"
  ivory-button: "#fffdf2"
  ivory-active: "#edf0e1"
  ivory-hover: "#edf0e4"
  ink: "#25372f"
  secondary-ink: "#607054"
  muted-ink: "#627168"
  navigation-ink: "#c5d0c1"
  secondary-button-ink: "#364c3e"
  divider: "#e2e3d9"
  panel-border: "#e2e4d8"
  button-border: "#dce0d4"
  field-background: "#fffefa"
  field-border: "#dce0d3"
  field-ink: "#304832"
  tag-background: "#edefe4"
  tag-ink: "#59684d"
  focus-bronze: "#a88649"
  temple-title: "#ffe2a0"
  temple-ink: "#fff1d0"
  temple-gold: "#f4d593"
  temple-progress: "#d4af63"
  temple-panel: "#231d13c9"
typography:
  display:
    fontFamily: '"Lora", serif'
    fontSize: "6.3cqw"
    fontWeight: 500
    letterSpacing: "-0.025em"
  headline:
    fontFamily: '"Lora", serif'
    fontSize: "31px"
    fontWeight: 500
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Lora", serif'
    fontSize: "19px"
    fontWeight: 500
    letterSpacing: "-0.015em"
  body:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  tag: "4px"
  field: "6px"
  control: "7px"
  action: "8px"
  navigation: "9px"
  panel: "12px"
  preview: "15px"
spacing:
  compact: "8px"
  medium: "12px"
  section: "18px"
  sheet: "24px"
components:
  button-primary:
    backgroundColor: "{colors.jade-primary}"
    textColor: "{colors.ivory-button}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-primary-hover:
    backgroundColor: "{colors.jade-hover}"
  button-secondary:
    backgroundColor: "{colors.ivory-paper}"
    textColor: "{colors.secondary-button-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  field:
    backgroundColor: "{colors.field-background}"
    textColor: "{colors.field-ink}"
    rounded: "{rounded.field}"
    padding: "9px 11px"
  navigation:
    textColor: "{colors.navigation-ink}"
    rounded: "{rounded.navigation}"
    padding: "13px 14px"
  navigation-active:
    backgroundColor: "{colors.ivory-active}"
    textColor: "{colors.jade-active-text}"
  tag:
    backgroundColor: "{colors.tag-background}"
    textColor: "{colors.tag-ink}"
    rounded: "{rounded.tag}"
    padding: "4px 7px"
  panel:
    backgroundColor: "{colors.ivory-paper}"
    rounded: "{rounded.panel}"
    padding: "23px"
  temple-progress:
    backgroundColor: "{colors.temple-panel}"
    textColor: "{colors.temple-ink}"
    rounded: "{rounded.control}"
    padding: "3cqw 3.5cqw"
---

# Design System: Chùa An Nhiên LIVE

## Overview

**Creative North Star: "Chùa An Nhiên"**

The approved [temple concept](docs/reference/temple-concept.png) remains the visual authority: an ornate golden Vietnamese altar, warm lanterns, dark carved teak, red prayer carpets and a kneeling congregation. Painted layered 2.5D artwork gives the temple its richness; Vietnamese labels and simple effects are rendered in code with smooth raster filtering.

The operator interface provides quiet ivory paper and deep jade navigation around the portrait preview. Restrained bronze details and Lora headings connect it to the temple while familiar Be Vietnam Pro controls keep operation legible and calm. This document records the implemented system, including the final small-text contrast corrections.

**Key Characteristics:**
- Golden painted temple with an altar focal point and layered congregation.
- Quiet ivory and jade operator surfaces with restrained ornament.
- Vietnamese typography, clear focus states and truthful connection labels.

Evidence: `apps/web/src/style.css`, `admin.tsx`, `TempleView.tsx`, `main.tsx`; desktop/mobile and wide/close captures in `.impeccable/review/`. Frontmatter values describe current source; they are not a new theme abstraction. Sidecar tonal ramps are generated swatch previews, not production token scales.

## Colors

The operator palette is botanical jade on warm ivory; the temple uses luminous gold on translucent brown.

### Primary
- **Jade Primary / Jade Hover:** primary actions; deep jade navigation anchors the operator shell. Active navigation reverses to ivory with dark jade text.

### Secondary
- **Focus Bronze:** visible keyboard outline. Bronze and muted lotus/sage details also identify offering types; preserve their source values when extending existing patterns.
- **Temple Gold:** shared progress count and fill; Temple Title highlights the name above the altar. Temple Panel provides a translucent reading surface over the art.

### Neutral
- **Ivory Background / Ivory Paper:** page and bounded operator panels.
- **Ink / Secondary Ink / Muted Ink:** primary copy, corrected supporting copy, and remaining muted interface text. Use the final selector values in CSS; older declarations can be overridden later in the file.
- **Divider / Panel Border / Field Border:** quiet separation without heavy outlines.

**The Reference Rule.** Preserve the approved golden temple artwork and its warm lighting when adding visual assets.

## Typography

**Display Font:** Lora with serif fallback. **Body Font:** Be Vietnam Pro with sans-serif fallback. Both are bundled locally through Fontsource; Lora loads weights 400/500 and Be Vietnam Pro 400/500/600.

The serif gives temple and section titles a measured, contemplative voice. Compact sans-serif labels support dense operator tasks without decorative lettering.

- **Display:** temple title scales with its portrait container; its role is separate from admin headings.
- **Headline:** operator page heading; reduces to (27px) at and below the observed (1000px) breakpoint.
- **Title:** general section heading; panel headings use (18px), returning to (19px) on mobile.
- **Body:** root baseline. Controls and explanatory text use smaller explicit source sizes; descriptions and field labels are (11px), hints are (10px).
- **Label:** final shared button treatment. Workspace section labels use Be Vietnam Pro (13px, 600); values and timestamps use tabular numerals where implemented.

## Layout

The game is a (1080 × 1920), (9:16) portrait composition. Wide shows the congregation; close crops toward the altar. The provisional composition targets remain shrine around (y=650), congregation below (y=1050). Keep heading and attendance bands separate; current final positions are (8.2%) and (17.2%). Temple copy uses container-relative units so previews and native capture share proportions. Standalone views fit the portrait into the viewport and preserve its aspect ratio.

Desktop admin uses a fixed (228px) sidebar and a bounded (1100px) two-column control grid: portrait preview on the left, operator panels on the right, with a (28px) gap. The preview caps at (470px). At (1600px) and above, the grid expands to (1190px) with a (38px) gap. Intermediate (1200px) and (1000px) breakpoints tighten navigation, padding and forms. At (760px) and below, navigation becomes a horizontal scrollable strip, the grid stacks and preview caps at (410px). Settings stack at (1000px); gift mappings collapse from six columns to three and then two.

Spacing is contextual, not a uniform mathematical scale. The frontmatter lists reused steps; retain actual component padding rather than normalizing it. Operator panels use (23px) desktop padding with existing breakpoint overrides.

## Elevation & Depth

Operator panels use ivory tonal layering and fine borders, without resting shadows. The portrait preview has the structural shadow (`0 15px 40px #33270d20`); selected camera segments use a small lift (`0 1px 4px #20392712`). Toasts use (`0 8px 30px #162f2930`). The temple itself gains depth from painted layers, warm light, vignette and translucent reading panels. The declared root shadow variable is currently unused; do not apply it to every panel.

## Shapes

Gently rounded controls sit inside broader rounded sheets. The frontmatter records the observed tag, field, control, action, navigation, panel and preview radii; mobile navigation joins the page using top-only corners. Fine solid borders define forms and sheets; the OBS link uses a dashed border. Circular dots and visitor initials remain compact status/identity details.

## Components

- **Buttons:** jade primary and ivory secondary, shared minimum height (38px). Enabled hover lifts (1px) and changes fill over (0.15s). Disabled buttons use (0.5) opacity and a not-allowed cursor. Keyboard focus uses the bronze (3px) outline with (4px) offset.
- **Fields:** pale fill, quiet border, compact padding and (36px) minimum height. Focus shifts border to `#65856c` and adds a (2px) `#dee8d6` outline. Textareas resize vertically. Placeholder copy uses Secondary Ink after the contrast correction.
- **Navigation:** full-width desktop rows; ivory active state, jade hover, (600) active weight. Preserve scrollable mobile behavior and Vietnamese labels.
- **Tags:** small neutral badges such as “Cục bộ”; final text is Tag Ink. Connection badges use explicit words for mock/live/connecting/error states, rather than color alone.
- **Panels:** bordered paper containers with Lora section headings and restrained sans-serif descriptions. The simulator action tiles retain their bow/incense/lotus icon colors.
- **Temple progress:** translucent brown panel, gold tabular count and a slim (3px) track. Fill changes over (0.5s); preserve the accessible progressbar semantics. Approved prayers and ceremony notices use related translucent reading surfaces.

CSS transitions are removed under `prefers-reduced-motion`. The admin preview is silent. `/game` and `/overlay` share noninteractive TikTok command/gift instructions and a compact gold-on-brown gratitude board; only `/game` exposes local audio activation. Interaction simulation belongs in admin.

## Viewer engagement extension

The original painted altar and portrait composition remain the authority. Attendance stays at 17.2%; a separate simultaneous-audience band sits at 18.6%, with truthful simulation/source and unknown-count labels. Audience celebrations use the existing particle pool, communal visitor bow and temporary warm light; the 1,000-viewer tier is richer without increasing the 180-effect/40-visitor budgets. Reduced-motion mode cuts audience particles and omits light pulsing.

The lower gratitude board rotates between gift contribution points and free participation, with five ranked rows, clipped long names and visible source labels. A single transient acknowledgment panel avoids stacking duplicate spoken and visual thanks. Approved prayers, noninteractive command instructions and shared contribution progress remain separate. Admin uses the incumbent paper/jade panels for both boards, an inline-confirmed session reset, mock audience/share controls and independent narrator controls. No new artwork, fonts or design token migration was needed. Updated wide/close and desktop/mobile baselines are in `tests/e2e/operator.spec.ts-snapshots/`; the active audience celebration is captured in `docs/qa/audience-1000.png`.

## Do's and Don'ts

### Do:
- **Do** preserve the approved painted altar, warm lanterns, red carpets and congregation.
- **Do** use Lora for temple/section titles and Be Vietnam Pro for Vietnamese controls.
- **Do** keep connection state truthful and distinguish simulated interactions in visible copy.
- **Do** retain visible keyboard focus, final contrast corrections and portrait proportions.
- **Do** inspect generated art at native scale and inside the engine before accepting it.

### Don't:
- **Don't** substitute pixel art or enable pixel-art filtering.
- **Don't** bake labels, counters or controls into generated artwork.
- **Don't** present concept statistics or mock events as real account data.
- **Don't** turn the quiet operator panels into ornate temple artwork.
- **Don't** exceed the established 40 visible visitors, 180 effect sprites or 32 MB decoded core-art budget.

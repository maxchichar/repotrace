# RepoTrace interface

## Direction: familiar, light, precise

The user requested a GitHub feel with a light appearance. Adopt familiar developer-tool patterns while retaining RepoTrace navigation and evidence-led content: system typography, pale gray navigation, white working surfaces, compact bordered cards, blue repository/evidence links, green primary actions, and coral active navigation/tab indicators. This direction is based on the user's reference and inspected application, not external usability research or copied GitHub assets.

## Palette and hierarchy

- Default surface: `#ffffff`; subtle surface: `#f6f8fa`.
- Text: `#1f2328`; secondary text: `#59636e`.
- Borders: `#d1d9e0`; subtle separators: `#eaeef2`.
- Links, focus and chart accent: `#0969da`.
- Primary action: `#1f883d`; hover: `#1a7f37`.
- Active navigation/tab indicator: `#fd8c73`, accompanied by weight/background changes.
- System sans typography; monospace for repository URLs, paths and SHAs. Heading weight 600; six-pixel control/card corners. Preserve distinct amber partial-data warnings and red errors.

## Behavior and verification

Preserve repository input, date scopes, comparison metrics, bot filtering, evidence links, profiles, avatars, report sharing and PDF/CSV/JSON downloads. Styling does not alter API or attribution contracts. Mobile navigation becomes a top row; decorative form icons are hidden on small screens; period buttons stay on one line. Maintain keyboard focus, reduced-motion behavior, accessible tables and narrow-screen overflow protection.

Verify using the existing Playwright flow, axe checks and 320/390/768/1440-pixel layouts, plus visual inspection of the landing form, methodology and a real retained report. Do not claim manual screen-reader, cross-browser, field performance or full WCAG certification from these checks. Reverting the UI commit restores the earlier presentation without database changes.

## Light and dark modes

The header sun/moon button selects an explicit light or dark appearance. With no saved choice, the application follows `prefers-color-scheme` and updates when the system preference changes. Explicit choices persist in localStorage under `repotrace-theme` and synchronize across tabs. Blocked browser storage falls back to an in-memory choice for the current page session. A static head bootstrap applies the selected palette before the body paints; the HTML theme attribute is intentionally excluded from React's hydration attribute comparison.

All interface surfaces, typography colors, outlines, status messages, inputs, menus, shared controls and chart/tooltip colors use semantic CSS variables. Dark surfaces are `#0d1117`, `#161b22` and `#21262d`, with `#f0f6fc` foreground, `#9da7b3` secondary text, and `#58a6ff` links. Amber/red warnings and success badges retain separate readable foreground tokens. Buttons do not animate foreground/background colors across theme changes, preventing a temporary contrast dip. PDF documents retain their printable document format.

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

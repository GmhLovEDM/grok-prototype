# Seaside Cafe Visual Refresh Implementation Plan

**Goal:** Give every playable screen a coherent, editorial seaside identity while preserving story progression and save compatibility.

**Architecture:** Keep the existing DOM renderer and game engine. Replace the development app's dependency on mock UI styles with local design tokens and component styles. Add presentational title markup without changing event handlers.

**Tech Stack:** TypeScript, vanilla DOM, CSS, Vite, Vitest; existing licensed XiwanUI font and scene artwork.

## Tasks

- [x] Establish baseline with `npm test`; preserve the existing package-lock.json change and work on `codex/seaside-cafe-visual-refresh`.
- [x] Create `src/ui/tokens.css`: cream paper, deep teal, muted terracotta, serif display stack, accessible focus colors, spacing and fluid text sizes.
- [x] Replace `src/style.css`: editorial title composition; unified buttons; floating HUD; readable dialogue; choices; paper panels; save thumbnails; settings; map; menus; log; confirmation layers. Include 700px mobile and short landscape layouts, safe areas, scrollable content, and reduced-motion support.
- [x] Update `src/ui/app.ts` with title eyebrow, two-line heading, introductory text, numbered menu decoration and decorative stamp. Keep existing labels and handlers. Replace the settings implementation note with player-facing guidance.
- [x] Verify `npm test` and `npm run build`; review desktop and narrow/short mobile layouts through the Chrome extension. Exercise settings, save/load, new-game flow, dialogue, choices, menu and log. Check for console errors and overflow.
- [x] Review the final diff and report the branch and preview. Do not commit unless requested.

## Acceptance criteria

- All existing story and storage tests pass and the production build completes.
- No dependency on `mock/ui.css` or `mock/tokens.css`; font licensing is retained.
- Visible focus indicators, readable disabled states, 44px touch targets, and reduced-motion behavior.
- Panels and dialogue remain inside the viewport on desktop, portrait mobile and short landscape screens; longer content scrolls.
- Original art, story, save schema and engine remain unchanged.

## Verification results

- `npm test`: 7 files / 39 tests passed, including 400 randomized playthroughs.
- `npm run build`: story generation, TypeScript and Vite passed; one WOFF2 and OFL included.
- Chrome extension: checked 1440x900 desktop, 390x844 mobile, 320x568 compact mobile and 844x390 landscape.
- Exercised title, day/gender/name modals, narration, portraits, minigame placeholder, ordinary choices, save/load slot 1, quick menu, log, leave confirmation and day 6 map selection.
- Browser smoke testing used localhost rather than the user's 127.0.0.1 origin to isolate its saves.
- Independent review found no functional blockers. Its touch-target observation was resolved by setting shared HUD/tab minimum heights to 44px.
- Preserved the pre-existing lockfile change. No commit made.

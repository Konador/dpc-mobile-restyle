# Agent instructions

## Project and workflow
Unofficial mobile-first DPChallenge userscript, primarily tested in Firefox on Android with Tampermonkey. Keep one standalone `dpc-mobile.user.js`; increment its version for script changes. Use British English in UI copy. Never commit credentials, personal account data or photographs. After script updates, provide a copyable raw GitHub URL pinned to the actual commit SHA (not a query-string cache buster). Keep README aligned with implemented features.

## Design system
- Premium editorial photography magazine, not a dashboard.
- Aperture logo, Georgia wordmark, Bodoni Moda editorial titles with selective italics.
- Dark background #111115, light #f5f6f8; accents #8da5df and #526eaf. Persist theme in dpc-theme.
- Photograph surrounds: #242424 for voting, #151515 for homepage results; retain neutral surrounds in both themes.
- Light titles use optical size 6 and .35px stroke; dark 36 and .175px stroke. Fit titles without overlap or arbitrary shrinking.
- Use restrained blue accents, muted secondary metadata and consistent spacing; avoid excessive white or blue text.

## Homepage (implemented)
Order: Recent results, Voting now, Open for entries, Community talk.
- Shared header, theme toggle and navigation menu; welcome message belongs in the menu, not the content feed.
- Section headings: editorial serif, italic final word, thin square-ended accent line and divider.
- Recent results: challenge title, swipeable five-photo feature, thumbnail selection, clickable photograph, photographer credit with aperture ribbon for top three, and subtle View full results footer. Keep a stable gallery height based on the tallest photo, capped at square and 60% viewport height. No thumbnail ribbons. Preload full images; cache URL/ratio metadata for up to 30 days, maximum 200 records.
- Voting cards: show all challenges, blue titles, left-aligned descriptions, aligned editing rules and deadlines, muted vote counts, native continue/review links. Use a photograph behind a strong readable gradient; choose randomly from the top ten rated images available on the fetched page, or random available image if none rated. This is not yet a challenge-wide paginated ranking.
- Open entries: show all in a two-column grid, whole cards clickable, no redundant action button. Preserve descriptions, editing rules, deadlines and singular/plural entry counts; use “No description provided.” for missing descriptions.
- Community talk: native forum links and metadata; preserve navigation and native destinations. Further polish may be needed.
- Parse actual native DOM and URLs; never hardcode screenshot content. Preserve native fallback when parsing fails.

## Voting and commenting
- Challenge name top left, entry counter top right, photograph title below; no editing category.
- Preserve swipe carousel, adjacent preloading, pinch zoom, voting/comment tabs, favourites, reporting and native submission semantics.
- Keyboard-aware comment layout: keep the current photograph visible, shrink it without cropping, temporarily hide title, tabs, header, navigation and statistics. Restore normal layout on keyboard dismissal. Do not refit titles just because keyboard height changes.
- Submit comment button in both layouts, disabled until edited and while busy; uses native navigation-based save, advances to next photo (previous if no next). Swipe/Next still saves. Do not claim standalone in-place saving.
- Never automatically retry an uncertain submission. Handle final-entry redirects and verify saves where possible.

## Contact sheet and loading
- Group ratings, no redundant badges, client-side filters, incremental rendering and lazy images. Preserve return scroll/filter state and pagination.
- Suppress original-site flashes at document-start; retain timeout fail-safe and View original website escape route. Handle missing document root. Do not reintroduce favicon injection: Firefox shortcut experiment failed and coincided with a loading flash.
- Firefox home-screen icon is browser/launcher-controlled; custom shortcut icon is an optional external workaround, not a script feature.

## Regression checks
Test authenticated homepage parsing, results carousel and image links, vote/entry metadata, first-load flash and native fallback, short/long titles, final vote, comment submit/swipe and uncertain saves, keyboard open/close on Firefox Android, narrow widths, filters, pagination, theme persistence and return state. V4.32 flash hardening and V4.34 explicit comment submission require device/live-site verification; do not present them as verified fixes.

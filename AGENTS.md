# Agent instructions

## Project
Unofficial mobile-first DPChallenge userscript. Maintain one standalone .user.js file, increment its version on changes, and preserve native site functionality. Use British English in UI copy. Never include credentials, personal account data or photographs in the repository.

## Design
- Premium editorial photography magazine aesthetic, not a dashboard.
- Aperture logo and Georgia wordmark; Bodoni Moda editorial titles with selective italics.
- Dark background #111115, light #f5f6f8; accents #8da5df and #526eaf respectively. Persist theme in dpc-theme. Keep photograph surround #242424 in both themes.
- Light titles use optical size 6 and .35px stroke; dark 36 and .175px stroke.
- Voting: challenge name top left, entry counter top right, photograph title below. No editing category. Fit titles within available space without overlap or random shrinking.
- Preserve swipe carousel, adjacent preloading, pinch zoom, voting and comment tabs, favourites, reporting and native submission semantics.
- Never automatically retry an uncertain vote. Handle final-entry redirects and verify saves where possible.
- Contact sheet: grouped ratings, no redundant rating badges, client-side filters without page reloads, incremental rendering and lazy images. Preserve return scroll/filter state.
- Avoid original-site flashes, but always provide a fail-safe and View original website escape route.

## Approved homepage direction (planned V4.0)
1. Shared header, theme toggle, hamburger navigation, private message indicator.
2. Voting now: unfinished challenges first, deadlines, progress bars, continue/review links.
3. Open for entries: descriptions, editing rules, deadlines, entry counts and native entry links.
4. Recent winners: first place large, remaining four underneath, native ribbon colours, original photo/author/results links.
5. Community activity: readable feed, initially around eight threads with load more.
6. Preserve site news, private messages, image search and existing navigation in menu.

Use actual native DOM and URLs; do not hardcode screenshot content. Homepage HTML selectors still need verification against authenticated markup. Test first-load metadata, short and long titles, final vote, comments, filtering, pagination, theme persistence and narrow mobile widths. Keep README accurate about implemented versus planned features.

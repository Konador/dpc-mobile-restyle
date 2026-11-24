
// ==UserScript==
// @name DPChallenge Mobile — Editorial Gallery
// @namespace dpc-mobile
// @version 4.24
// @updateURL https://raw.githubusercontent.com/Konador/dpc-mobile-restyle/main/dpc-mobile.user.js
// @downloadURL https://raw.githubusercontent.com/Konador/dpc-mobile-restyle/main/dpc-mobile.user.js
// @match *://*.dpchallenge.com/challenge_vote_image.php*
// @match *://*.dpchallenge.com/challenge_vote_list.php*
// @match *://*.dpchallenge.com/
// @match *://*.dpchallenge.com/index.php*
// @grant none
// @run-at document-start
// @noframes
// ==/UserScript==

(() => {
'use strict';

if (top !== self) return;

if (sessionStorage.getItem('dpc-original-once')) {
    sessionStorage.removeItem('dpc-original-once');
    return;
}


/* V2.9 — Prevent original website flashing */
const bootRoot = document.documentElement;
const bootStyle = document.createElement('style');
let bootLight = false;

try {
    bootLight = localStorage.getItem('dpc-theme') === 'light';
} catch {}

bootStyle.textContent =
    'html,body{background:' +
    (bootLight ? '#f5f6f8' : '#111115') +
    '!important;color-scheme:' +
    (bootLight ? 'light' : 'dark') +
    ';} body{visibility:hidden!important;}';

bootRoot.append(bootStyle);

function revealPage() {
    bootStyle.remove();
}

// Fail-safe: never leave the website permanently hidden.
const bootTimeout = setTimeout(revealPage, 8000);

function boot() {
    try {
        start();
    } finally {
        clearTimeout(bootTimeout);
        revealPage();
    }
}

const root = document.documentElement;
const isHome = location.pathname === '/' || location.pathname === '/index.php';
const isList = location.pathname.includes('challenge_vote_list.php');

function viewport() {
    if (!document.head) return;
    const metas = [...document.querySelectorAll('meta[name="viewport"]')];
    const meta = metas.shift() || document.createElement('meta');
    meta.name = 'viewport';
    const content = 'width=device-width, initial-scale=1';
    if (meta.content !== content) meta.content = content;
    if (!meta.parentNode) document.head.append(meta);
    metas.forEach(m => m.remove());
}

viewport();

const observer = new MutationObserver(viewport);
observer.observe(document, {
    childList: true,
    subtree: true
});

function start() {
    viewport();
    observer.disconnect();

    const style = document.createElement('style');
    style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,500;1,6..96,500&display=swap');

html.dpc-mobile,
html.dpc-mobile body {
    margin:0!important;
    padding:0!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    overflow-x:clip!important;
    background:#111115!important;
    color-scheme:dark;
    overscroll-behavior-x:none;
    -webkit-text-size-adjust:100%;
    text-size-adjust:100%;
}

html.dpc-mobile body>:not(#dpc-app):not(#dpc-engine):not(#dpc-viewer) {
    display:none!important;
}

html.dpc-viewing,
html.dpc-viewing body {
    overflow:hidden!important;
}

#dpc-engine {
    position:fixed!important;
    left:0!important;
    top:0!important;
    width:1px!important;
    height:1px!important;
    contain:strict;
    overflow:hidden;
    opacity:0;
    pointer-events:none;
}

#dpc-engine iframe {
    width:1000px;
    height:800px;
    border:0;
}

#dpc-app,#dpc-viewer {
    --accent:#8da5df;
    --muted:#92909a;
    --line:#ffffff15;
    --serif:'Bodoni Moda',Georgia,serif;
    color:#f0edf0;
    font:14px/1.4 system-ui,sans-serif;
    text-align:left;
}

#dpc-app *,#dpc-viewer * {
    box-sizing:border-box;
}

#dpc-app [hidden],#dpc-viewer[hidden] {
    display:none!important;
}

#dpc-app {
    display:block!important;
    width:100%!important;
    max-width:100%!important;
    margin:0!important;
    padding:0 0 28px!important;
    background:#111115;
}

#dpc-app button,#dpc-viewer button {
    appearance:none;
    font:inherit;
    cursor:pointer;
    -webkit-tap-highlight-color:transparent;
}

#dpc-app button:disabled {
    opacity:.35;
}

#dpc-app a {
    color:var(--accent);
    text-decoration:none!important;
}

.dpc-header {
    height:54px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0 18px;
    border-bottom:1px solid var(--line);
}

#dpc-app .dpc-brand {
    font:24px/1 Georgia,serif!important;
    letter-spacing:-1.4px;
    color:#f0edf0;
}

.dpc-brand span {
    color:var(--accent);
    margin-right:7px;
}

.dpc-eyebrow {
    font-size:9px;
    letter-spacing:2px;
    color:var(--muted);
}

.dpc-stage {
    position:relative;
    width:100%;
    height:clamp(155px,calc(100svh - 390px),620px);
    background:#242424;
    overflow:hidden;
    touch-action:pan-y;
    user-select:none;
}

.dpc-track-gallery {
    display:flex;
    position:absolute;
    inset:0 auto 0 0;
    width:300%;
    height:100%;
    will-change:transform;
}

.dpc-slide {
    flex:0 0 33.333333%;
    height:100%;
    padding:12px;
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    position:relative;
}

#dpc-app .dpc-slide img {
    display:block!important;
    width:auto!important;
    height:auto!important;
    max-width:100%!important;
    max-height:100%!important;
    object-fit:contain;
    outline:1px solid #ffffff30;
    border:0!important;
    margin:0!important;
    padding:0!important;
    pointer-events:none;
}

.dpc-slide img:not([src]) {
    visibility:hidden;
}

.dpc-slide-status {
    position:absolute;
    color:#aaa;
    font-size:11px;
}

#dpc-app .dpc-stage-button {
    position:absolute;
    bottom:12px;
    width:36px;
    height:36px;
    display:grid;
    place-items:center;
    background:#141414d9;
    color:#eee;
    border:1px solid #ffffff24;
    border-radius:5px;
    padding:8px;
}

.dpc-stage-button svg {
    width:18px;
    height:18px;
}

.dpc-expand {
    right:12px;
}

.dpc-overview {
    left:12px;
}

.dpc-gallery-status {
    position:absolute;
    bottom:14px;
    left:50%;
    transform:translateX(-50%);
    background:#141414e8;
    color:#eee;
    border:1px solid #ffffff24;
    border-radius:5px;
    padding:6px 9px;
    font-size:10px;
    pointer-events:none;
    max-width:70%;
    text-align:center;
}

.dpc-info {
    height:144px;
    padding:12px 20px 10px;
    display:flex;
    flex-direction:column;
    justify-content:space-between;
    max-width:560px;
    margin:auto;
    overflow:hidden;
}

.dpc-kicker {
    display:flex;
    justify-content:space-between;
    align-items:center;
    font-size:9px;
    letter-spacing:1.7px;
    text-transform:uppercase;
    color:var(--muted);
}

.dpc-edition {
    color:var(--accent);
}

#dpc-app .dpc-title {
    font-family:var(--serif)!important;
    font-weight:500!important;
    line-height:.99!important;
    letter-spacing:-.045em;
    color:#f0edf0;
    margin:0!important;
    overflow-wrap:anywhere;
    min-height:0;
    flex:1;
    display:flex;
    flex-direction:column;
    justify-content:center;
    align-items:flex-start;
}

.dpc-title .dpc-title-line {
    display:block;
    max-width:100%;
}

.dpc-title .dpc-title-part {
    display:inline-block;
}

.dpc-title em {
    font-style:italic;
}

.dpc-title.single {
    align-items:center!important;
    text-align:center;
}

.dpc-title .indent {
    padding-left:7%;
}

#dpc-app .dpc-challenge {
    font:9px/1.3 system-ui!important;
    letter-spacing:1.5px;
    text-transform:uppercase;
    color:var(--muted);
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
}

.dpc-controls {
    max-width:520px;
    margin:auto;
    padding:0 18px;
}

.dpc-tabs {
    display:flex;
    margin-bottom:12px;
    border-bottom:1px solid var(--line);
}

#dpc-app .dpc-tab {
    flex:1;
    background:none;
    border:0;
    border-bottom:2px solid transparent;
    color:var(--muted);
    height:38px;
    font-size:12px;
    letter-spacing:.5px;
}

#dpc-app .dpc-tab.active {
    color:var(--accent);
    border-bottom-color:var(--accent);
}

.dpc-panel {
    height:138px;
}

.dpc-rating-label {
    display:flex;
    justify-content:space-between;
    margin-bottom:9px;
    font-size:9px;
    letter-spacing:1.5px;
    color:var(--muted);
}

.dpc-current-score,.dpc-comment-score {
    color:var(--accent);
    letter-spacing:.4px;
}

.dpc-grid {
    display:grid;
    grid-template-columns:repeat(5,minmax(0,1fr));
    gap:5px;
}

#dpc-app .dpc-score {
    position:relative;
    height:43px;
    width:100%;
    padding:0;
    background:linear-gradient(155deg,#222229,#19191e);
    border:1px solid #ffffff14;
    border-radius:6px;
    color:#d9d6df;
    font:21px/1 Georgia,serif!important;
    transition:background .18s,color .18s,transform .18s;
}

#dpc-app .dpc-score.selected,
#dpc-app .dpc-score.pressed {
    background:linear-gradient(145deg,#bacbf0,#728bc9);
    color:#102537;
    border-color:#d0dbf6;
}

#dpc-app .dpc-score.pressed {
    opacity:1;
    z-index:2;
    animation:dpc-vote-press .32s ease-out both;
}

@keyframes dpc-vote-press {
    0% {transform:scale(.88)}
    45% {
        transform:scale(1.13);
        box-shadow:0 0 22px #8da5df66;
    }
    100% {
        transform:scale(1);
        box-shadow:0 0 0 transparent;
    }
}

.dpc-rating-scale {
    display:flex;
    justify-content:space-between;
    margin-top:7px;
    color:var(--muted);
    font-size:8px;
    letter-spacing:1px;
    text-transform:uppercase;
}

#dpc-app textarea {
    display:block;
    width:100%;
    height:88px;
    resize:none;
    padding:10px;
    background:#1b1b21;
    border:1px solid var(--line);
    border-radius:6px;
    color:#f0edf0;
    font:16px/1.35 system-ui!important;
    margin:0;
}

.dpc-comment-hint {
    font-size:10px;
    color:var(--muted);
    margin-top:5px;
}

.dpc-navigation {
    display:flex;
    justify-content:space-between;
    align-items:center;
    border-block:1px solid var(--line);
    margin-top:6px;
}

#dpc-app .dpc-nav-button {
    height:45px;
    background:none;
    border:0;
    color:#f0edf0;
    padding:0;
    font-size:12px;
}

.dpc-nav-button span {
    color:var(--accent);
}

.dpc-nav-hint {
    font-size:9px;
    color:var(--muted);
}

.dpc-progress {
    padding:18px 0;
    border-bottom:1px solid var(--line);
}

.dpc-progress-label {
    display:flex;
    justify-content:space-between;
    margin-bottom:12px;
}

.dpc-stat {
    display:flex;
    flex-direction:column;
    gap:4px;
}

.dpc-stat:last-child {
    text-align:right;
}

.dpc-stat-label {
    font-size:8px;
    letter-spacing:1.5px;
    color:var(--muted);
}

.dpc-stat-value {
    font:22px/1 Georgia,serif;
}

.dpc-progress-track {
    height:2px;
    background:var(--line);
}

.dpc-fill {
    height:100%;
    background:var(--accent);
    transition:width .4s ease;
}

.dpc-actions {
    display:flex;
    justify-content:space-between;
    padding:10px 0;
}

#dpc-app .dpc-text-button {
    background:none;
    border:0;
    color:var(--muted);
    font-size:11px;
    padding:8px 0;
}

#dpc-app .dpc-text-button.active {
    color:var(--accent);
}

.dpc-footer {
    text-align:center;
    color:#73717a;
    font-size:9px;
    margin-top:20px;
}

.dpc-footer-mark {
    font:italic 17px Georgia,serif;
    margin-bottom:8px;
}

/* Full-screen photograph */

#dpc-viewer {
    position:fixed!important;
    inset:0!important;
    z-index:2147483647;
    background:#171717;
    overflow:hidden;
    touch-action:none;
}

.dpc-viewer-stage {
    position:absolute;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    touch-action:none;
}

#dpc-viewer img {
    width:auto!important;
    height:auto!important;
    max-width:100%!important;
    max-height:100%!important;
    pointer-events:none;
    outline:1px solid #ffffff20;
    will-change:transform;
}

.dpc-viewer-bar {
    position:absolute;
    inset:0 0 auto;
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:16px;
    pointer-events:none;
}

.dpc-viewer-close {
    pointer-events:auto;
    border:1px solid #ffffff30;
    border-radius:50%;
    background:#202020bb;
    color:white;
    width:42px;
    height:42px;
}

.dpc-viewer-hint {
    position:absolute;
    bottom:24px;
    width:100%;
    text-align:center;
    font-size:10px;
    color:#ffffff88;
    pointer-events:none;
}

/* Challenge contact sheet */

.dpc-list-content {
    max-width:1000px;
    margin:auto;
    padding:22px 16px;
}

.dpc-list-edition {
    font-size:9px;
    letter-spacing:2px;
    text-transform:uppercase;
    color:var(--accent);
    margin-bottom:12px;
}

#dpc-app .dpc-list-title {
    font:500 clamp(34px,10vw,64px)/.99 var(--serif)!important;
    letter-spacing:-.045em;
    color:#f0edf0;
    margin:0 0 14px!important;
}

.dpc-list-title em {
    display:block;
    padding-left:5%;
}

.dpc-list-meta {
    color:var(--muted);
    font-size:11px;
    line-height:1.6;
}

.dpc-details {
    margin:18px 0 0;
    border:1px solid var(--line);
    border-radius:6px;
    background:#19191e;
}

.dpc-details summary {
    padding:12px;
    color:#d9d6df;
    font-size:12px;
    cursor:pointer;
}

.dpc-details-content {
    padding:0 12px 12px;
    font-size:12px;
    line-height:1.6;
    color:#c4c0ca;
}

.dpc-detail-label {
    display:block;
    margin-top:12px;
    font-size:9px;
    color:var(--accent);
    letter-spacing:1.2px;
    text-transform:uppercase;
}

.dpc-list-filters {
    display:flex;
    gap:4px;
    margin-top:20px;
    border-bottom:1px solid var(--line);
}

#dpc-app .dpc-filter {
    flex:1;
    padding:12px 4px;
    background:none;
    border:0;
    border-bottom:2px solid transparent;
    color:var(--muted);
    font-size:11px;
    text-align:center;
}

#dpc-app .dpc-filter.active {
    color:var(--accent);
    border-bottom-color:var(--accent);
}

.dpc-rating-filters {
    display:grid;
    grid-template-columns:repeat(10,minmax(0,1fr));
    gap:4px;
    margin:12px 0 22px;
}

#dpc-app .dpc-rating-filter {
    display:grid;
    place-items:center;
    height:32px;
    background:#1b1b21;
    border:1px solid var(--line);
    border-radius:4px;
    color:#c4c0ca;
    font:15px Georgia,serif;
}

#dpc-app .dpc-rating-filter.active {
    background:var(--accent);
    color:#102537;
}

.dpc-list-group {
    margin-bottom:24px;
}

.dpc-group-heading {
    display:flex;
    align-items:baseline;
    gap:10px;
    border-bottom:1px solid var(--line);
    padding-bottom:9px;
    margin-bottom:12px;
}

.dpc-group-name {
    font:500 26px/1 var(--serif);
    color:#f0edf0;
}

.dpc-group-name em {
    color:var(--accent);
}

.dpc-group-count {
    margin-left:auto;
    font-size:9px;
    color:var(--muted);
    letter-spacing:1px;
    text-transform:uppercase;
}

.dpc-contact-sheet {
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:16px 8px;
}

#dpc-app .dpc-thumb-card {
    display:block;
    min-width:0;
    color:#d9d6df;
}

.dpc-thumb-stage {
    position:relative;
    aspect-ratio:1;
    background:#242424;
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    padding:6px;
    border:1px solid #ffffff0d;
}

#dpc-app .dpc-thumb-stage img {
    display:block!important;
    width:auto!important;
    height:auto!important;
    max-width:100%!important;
    max-height:100%!important;
    object-fit:contain;
    border:0!important;
    margin:0!important;
    outline:1px solid #ffffff20;
}





.dpc-thumb-comment {
    position:absolute;
    top:5px;
    right:5px;
    background:#181818dc;
    border-radius:4px;
    padding:4px;
    color:var(--accent);
    line-height:0;
}

.dpc-thumb-comment svg {
    width:12px;
    height:12px;
}

.dpc-thumb-title {
    font:14px/1.25 Georgia,serif;
    margin-top:7px;
    overflow-wrap:anywhere;
}

.dpc-empty {
    padding:30px 10px;
    color:var(--muted);
    text-align:center;
}

.dpc-pagination {
    display:flex;
    justify-content:center;
    align-items:center;
    flex-wrap:wrap;
    gap:8px;
    margin:20px 0;
}

#dpc-app .dpc-page-link {
    padding:9px 12px;
    border:1px solid var(--line);
    border-radius:4px;
    font-size:12px;
}

@media(min-width:650px) {
    .dpc-contact-sheet {
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:20px 12px;
    }
}

@media(prefers-reduced-motion:reduce) {
    #dpc-app * {
        animation-duration:.01ms!important;
        transition-duration:.01ms!important;
    }
}
`;

    style.textContent += `
/* V2.4 — Ribbon blue editorial sections */

.dpc-list-group {
    margin-bottom:32px;
}

.dpc-group-heading {
    position:relative;
    border-bottom:0;
    padding-bottom:13px;
    margin-bottom:14px;
}

.dpc-group-heading::after {
    content:'';
    position:absolute;
    bottom:0;
    left:0;
    right:0;
    height:1px;
    background:linear-gradient(
        90deg,
        #8da5dfbb 0%,
        #8da5df44 32%,
        #ffffff12 78%,
        transparent 100%
    );
}

.dpc-group-name em {
    color:var(--accent);
}

.dpc-thumb-rating {
    display:none!important;
}

#dpc-app .dpc-rating-filter.active {
    border-color:var(--accent);
    color:#102537;
}

.dpc-thumb-comment {
    color:var(--accent);
}
`;

    style.textContent += "\n/* V2.5 — Aperture branding and themes */\n#dpc-app .dpc-brand {\n    display:flex;\n    align-items:center;\n    gap:7px;\n    white-space:nowrap;\n}\n#dpc-app .dpc-brand svg {\n    width:26px;\n    height:26px;\n    flex-shrink:0;\n    color:var(--accent);\n}\n.dpc-header-right {\n    display:flex;\n    align-items:center;\n    gap:10px;\n}\n#dpc-app .dpc-theme-toggle {\n    display:grid;\n    place-items:center;\n    width:36px;\n    height:36px;\n    padding:8px;\n    background:transparent;\n    border:0;\n    border-radius:50%;\n    color:var(--accent);\n}\n.dpc-theme-toggle svg {\n    width:20px;\n    height:20px;\n}\n#dpc-app .dpc-theme-toggle:focus-visible {\n    outline:2px solid var(--accent);\n}\n@media(max-width:360px) {\n    #dpc-app .dpc-brand {font-size:21px!important;}\n    .dpc-header .dpc-eyebrow {display:none;}\n}\nhtml.dpc-mobile.dpc-light,\nhtml.dpc-mobile.dpc-light body {\n    background:#f5f6f8!important;\n    color-scheme:light;\n}\nhtml.dpc-light #dpc-app {\n    --accent:#526eaf;\n    --muted:#657182;\n    --line:#18334e20;\n    --ink:#182333;\n    --surface:#e5ebf3;\n    --border:#cbd5e2;\n    background:#f5f6f8!important;\n    color:var(--ink);\n}\nhtml.dpc-light #dpc-app .dpc-header {\n    background:#f5f6f8;\n    border-bottom:1px solid #526eaf66;\n}\nhtml.dpc-light #dpc-app .dpc-brand,\nhtml.dpc-light #dpc-app .dpc-title,\nhtml.dpc-light #dpc-app .dpc-list-title,\nhtml.dpc-light #dpc-app .dpc-group-name,\nhtml.dpc-light #dpc-app .dpc-nav-button,\nhtml.dpc-light #dpc-app .dpc-thumb-card,\nhtml.dpc-light #dpc-app .dpc-details summary {\n    color:var(--ink);\n}\nhtml.dpc-light #dpc-app .dpc-details {\n    background:var(--surface);\n    border-color:var(--border);\n}\nhtml.dpc-light #dpc-app .dpc-details-content {\n    color:#40536a;\n}\nhtml.dpc-light #dpc-app .dpc-score {\n    background:linear-gradient(155deg,#fff,#e5ebf3);\n    color:var(--ink);\n    border-color:var(--border);\n}\nhtml.dpc-light #dpc-app .dpc-score.selected,\nhtml.dpc-light #dpc-app .dpc-score.pressed {\n    background:linear-gradient(145deg,#607fbd,#425d9a);\n    color:white;\n    border-color:#425d9a;\n}\nhtml.dpc-light #dpc-app .dpc-rating-filter {\n    background:#edf1f6;\n    color:var(--ink);\n    border-color:var(--border);\n}\nhtml.dpc-light #dpc-app .dpc-rating-filter.active {\n    background:var(--accent);\n    color:white;\n    border-color:var(--accent);\n}\nhtml.dpc-light #dpc-app textarea {\n    background:white;\n    color:var(--ink);\n    border-color:var(--border);\n}\nhtml.dpc-light #dpc-app textarea::placeholder {\n    color:#657182;\n}\nhtml.dpc-light #dpc-app textarea:focus {\n    outline:1px solid var(--accent);\n}\nhtml.dpc-light #dpc-app .dpc-page-link {\n    background:#edf1f6;\n    border-color:var(--border);\n}\nhtml.dpc-light #dpc-app .dpc-group-heading::after {\n    background:linear-gradient(90deg,#526eafbb,#526eaf44 32%,#18334e18 78%,transparent);\n}\nhtml.dpc-light #dpc-app .dpc-footer {\n    color:var(--muted);\n}\nhtml.dpc-light #dpc-app .dpc-thumb-comment {\n    color:#8da5df;\n}\nhtml.dpc-light #dpc-viewer {\n    color-scheme:dark;\n}\n";


    style.textContent += `
        html.dpc-light #dpc-app .dpc-title,
        html.dpc-light #dpc-app .dpc-list-title {
            font-optical-sizing: none;
            font-variation-settings: "opsz" 18;
        }
    `;

    style.textContent += "\n/* V2.7 — Improved light-mode typography */\nhtml.dpc-light #dpc-app .dpc-title,\nhtml.dpc-light #dpc-app .dpc-list-title,\nhtml.dpc-light #dpc-app .dpc-group-name {\n    font-optical-sizing: none !important;\n    font-variation-settings: \"opsz\" 6 !important;\n    -webkit-text-stroke: 0.35px currentColor;\n}\n";
    style.textContent += "\n/* V2.8 — Balanced dark-mode typography */\nhtml.dpc-mobile:not(.dpc-light) #dpc-app .dpc-title,\nhtml.dpc-mobile:not(.dpc-light) #dpc-app .dpc-list-title,\nhtml.dpc-mobile:not(.dpc-light) #dpc-app .dpc-group-name {\n    font-optical-sizing: none !important;\n    font-variation-settings: \"opsz\" 36 !important;\n    -webkit-text-stroke: 0.175px currentColor;\n}\n";
    style.textContent += "\n/* V3.0 — Infinite contact sheet */\n.dpc-infinite-sentinel {\n    padding:24px 8px;\n    text-align:center;\n    font-size:10px;\n    letter-spacing:1px;\n    color:var(--muted);\n}\n.dpc-infinite-sentinel[hidden] {\n    display:none!important;\n}\n#dpc-app .dpc-rating-filter {\n    width:100%;\n    padding:0;\n    cursor:pointer;\n}\n";
    style.textContent += "\n/* V3.2 — Stable title layout */\n#dpc-app .dpc-title {\n    width:100%;\n    min-width:0;\n    align-self:stretch;\n}\n#dpc-app .dpc-title-line {\n    flex-shrink:0;\n    max-width:100%;\n    overflow-wrap:anywhere;\n}\n#dpc-app .dpc-title-part {\n    max-width:100%;\n    overflow-wrap:anywhere;\n}\n";
    style.textContent += "\n/* V3.3 — Reserve space around editorial titles */\n#dpc-app .dpc-kicker,\n#dpc-app .dpc-challenge {\n    flex-shrink:0;\n}\n#dpc-app .dpc-challenge {\n    min-height:12px;\n}\n#dpc-app .dpc-title {\n    margin-block:5px!important;\n    line-height:1.02!important;\n}\n";
    style.textContent += "\n/* V3.4 — Simplified challenge typography */\n#dpc-app .dpc-info {\n    height:132px;\n}\n#dpc-app .dpc-kicker {\n    gap:12px;\n    flex-shrink:0;\n}\n#dpc-app .dpc-edition {\n    min-width:0;\n    overflow:hidden;\n    text-overflow:ellipsis;\n    white-space:nowrap;\n}\n#dpc-app .dpc-number {\n    flex-shrink:0;\n}\n#dpc-app .dpc-challenge,\n#dpc-app .dpc-list-edition {\n    display:none!important;\n}\n#dpc-app .dpc-title {\n    margin-block:6px!important;\n}\n";
    style.textContent += "\n.dpc-home{max-width:900px;margin:auto;padding:20px 18px}\n.dpc-home-welcome{color:var(--muted);font-size:12px;margin-bottom:22px}\n.dpc-home section{margin-bottom:34px}\n#dpc-app .dpc-home h2{font:500 32px/1.1 var(--serif);letter-spacing:-.04em;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid var(--accent);color:inherit}\n.dpc-home h2 em{color:var(--accent)}\n.dpc-home-card{padding:15px 0;border-bottom:1px solid var(--line)}\n#dpc-app .dpc-home-card h3{font:500 24px/1.15 var(--serif);margin:0 0 8px;color:inherit}\n.dpc-home-meta{font-size:11px;color:var(--muted);line-height:1.6;white-space:pre-line}\n.dpc-home-progress{height:3px;background:var(--line);margin:12px 0}\n.dpc-home-progress i{display:block;height:100%;background:var(--accent)}\n#dpc-app .dpc-home-action{display:inline-block;padding:9px 14px;border:1px solid var(--accent);border-radius:5px;margin-top:10px;font-size:12px;color:var(--accent)}\n#dpc-app .dpc-home-more,#dpc-app .dpc-home-menu-button{background:none;color:var(--accent);border:1px solid var(--line);border-radius:5px;padding:9px 12px}\n.dpc-home-more{margin-top:14px}\n.dpc-home-menu{padding:16px 18px;border-bottom:1px solid var(--line)}\n.dpc-home-menu a{display:block;padding:10px 0;border-bottom:1px solid var(--line)}\n.dpc-home-menu form{margin:12px 0}\n.dpc-home-winners{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}\n.dpc-home-winners a{min-width:0;font-size:10px;overflow-wrap:anywhere}\n.dpc-home-winners a:first-child{grid-column:1/-1;font-size:14px}\n.dpc-home-winners img{display:block;width:100%;height:auto;aspect-ratio:1;object-fit:contain;background:#242424;padding:5px;border:0}\n.dpc-home-winners a:first-child img{aspect-ratio:4/3}\n.dpc-home-winners a:nth-child(1) img{border-bottom:3px solid #668cda}\n.dpc-home-winners a:nth-child(2) img{border-bottom:3px solid #d45a65}\n.dpc-home-winners a:nth-child(3) img{border-bottom:3px solid #e4c45c}\n.dpc-home-thread{display:block;padding:12px 0;border-bottom:1px solid var(--line)}\n.dpc-home-thread small{display:block;color:var(--muted);margin-top:5px}\n";
    style.textContent += "\n#dpc-app .dpc-home h2{font:500 25px/1.2 var(--serif);letter-spacing:-.02em;border-bottom:1px solid var(--line)}\n#dpc-app .dpc-home h2 em{color:inherit;font-style:normal}\nhtml.dpc-light #dpc-app .dpc-home :is(h2,h3){font-optical-sizing:none;font-variation-settings:\"opsz\" 6;-webkit-text-stroke:.35px currentColor}\nhtml.dpc-mobile:not(.dpc-light) #dpc-app .dpc-home :is(h2,h3){font-optical-sizing:none;font-variation-settings:\"opsz\" 36;-webkit-text-stroke:.175px currentColor}\n#dpc-app .dpc-home-winners .dpc-winning-photo{border:0}\n#dpc-app .dpc-home-winners .dpc-ribbon{display:inline-block;width:14px;height:18px;vertical-align:middle;margin-right:5px;padding:0;background:none;aspect-ratio:auto;object-fit:contain;border:0}\n.dpc-home-winners svg{vertical-align:middle;margin-right:5px}\n";
    style.textContent += "\n.dpc-home-winners .dpc-winner-tile{min-width:0}\n.dpc-home-winners .dpc-winner-tile:first-child{grid-column:1/-1}\n#dpc-app .dpc-home-winners .dpc-winner-tile>a{display:block;grid-column:auto;font-size:10px}\n#dpc-app .dpc-home-winners .dpc-winner-tile:first-child>a{font-size:14px}\n#dpc-app .dpc-home-winners .dpc-winner-tile:not(:first-child) .dpc-winning-photo{aspect-ratio:1}\n#dpc-app .dpc-home-winners .dpc-winner-tile .dpc-winner-author{color:var(--muted);font-weight:400;margin-top:4px;font-size:11px;overflow-wrap:anywhere}\n#dpc-app .dpc-home-winners .dpc-winner-tile:first-child .dpc-winner-author{font-size:13px}\n";
    style.textContent += "\n#dpc-app .dpc-home .dpc-results-feature{padding:20px 0 30px;margin-bottom:16px}\n#dpc-app .dpc-home .dpc-results-feature h3{font-size:30px;color:inherit;margin:5px 0 16px}\n.dpc-results-kicker{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}\n#dpc-app .dpc-home-winners .dpc-winner-tile:first-child .dpc-winning-photo{aspect-ratio:auto;max-height:60vh;object-fit:contain;padding:0}\n#dpc-app .dpc-home-winners .dpc-winner-tile:first-child>a{font:500 26px/1.2 var(--serif);color:inherit}\n#dpc-app .dpc-home-winners .dpc-winner-tile:first-child>a>div{margin-top:12px}\n#dpc-app .dpc-home-winners .dpc-winner-tile:first-child .dpc-winner-author{margin-bottom:12px}\n#dpc-app .dpc-home-winners .dpc-winner-tile:not(:first-child) .dpc-winning-photo{padding:0;object-fit:contain}\n.dpc-home-vote-card{position:relative;isolation:isolate;overflow:hidden;padding:18px!important;margin:10px 0;border:1px solid var(--line);border-radius:8px}\n.dpc-home-vote-card:before{content:\"\";position:absolute;inset:0;z-index:-1;background-image:linear-gradient(90deg,#111115 5%,#111115e8 40%,#11111570),var(--vote-image,none);background-size:cover;background-position:center,right center;opacity:.85}\nhtml.dpc-light .dpc-home-vote-card:before{background-image:linear-gradient(90deg,#f5f6f8 5%,#f5f6f8ed 40%,#f5f6f880),var(--vote-image,none)}\n";
    style.textContent += "\n#dpc-app .dpc-home-gallery{display:grid;gap:14px}\n#dpc-app .dpc-home-hero{position:relative;display:block;background:#242424}\n#dpc-app .dpc-home-hero img{display:block;width:100%;height:auto;max-height:60vh;object-fit:contain}\n#dpc-app .dpc-home-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}\n#dpc-app .dpc-home-strip button{position:relative;min-width:0;padding:2px;border:1px solid transparent;background:transparent;border-radius:3px;cursor:pointer}\n#dpc-app .dpc-home-strip button[aria-pressed=\"true\"]{border-color:var(--accent)}\n#dpc-app .dpc-home-strip img{display:block;width:100%;aspect-ratio:1;object-fit:contain;background:#242424}\n#dpc-app .dpc-overlay-ribbon{position:absolute;top:8px;left:8px;width:32px;height:38px;filter:drop-shadow(0 2px 3px #0009);pointer-events:none}\n#dpc-app .dpc-home-strip .dpc-overlay-ribbon{width:17px;height:21px;top:4px;left:4px}\n#dpc-app .dpc-home-feature-title{font:500 26px/1.15 var(--serif);color:inherit;display:block}\n#dpc-app .dpc-home-feature-author{display:block;color:var(--muted);font-size:13px;margin-top:5px}\n#dpc-app .dpc-home-vote-card .dpc-home-meta{font-size:13px;line-height:1.45;color:inherit}\n.dpc-home-detail{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:11px;color:var(--muted);margin:10px 0}\n.dpc-home-vote-status{font-size:12px;font-weight:600;color:var(--accent);margin-top:12px}\n.dpc-home-vote-card:before{background-image:linear-gradient(90deg,#111115f5 0%,#111115e8 48%,#111115a8 100%),var(--vote-image,none)}\nhtml.dpc-light .dpc-home-vote-card:before{background-image:linear-gradient(90deg,#f5f6f8fa 0%,#f5f6f8ed 48%,#f5f6f8b8 100%),var(--vote-image,none)}\n";
    style.textContent += "\n#dpc-app .dpc-home-hero{height:var(--hero-height, min(100vw,60vh));overflow:hidden;touch-action:pan-y}\n#dpc-app .dpc-home-hero img{width:100%;height:100%;max-height:none;object-fit:contain;user-select:none;-webkit-user-drag:none}\n#dpc-app .dpc-home-feature-title.dpc-title{height:88px;min-height:88px;display:flex;flex-direction:column;justify-content:center;margin:0!important;overflow:hidden}\n#dpc-app .dpc-home-feature-author{font:italic 500 20px/1.25 var(--serif);color:var(--accent);letter-spacing:.01em;margin:0;min-height:25px}\n#dpc-app .dpc-home-gallery{gap:10px}\n";
    style.textContent += '#dpc-app .dpc-overlay-ribbon{height:32px} #dpc-app .dpc-home-strip .dpc-overlay-ribbon{height:17px}';
    style.textContent += "\n#dpc-app .dpc-home{padding-top:12px}\n#dpc-app .dpc-home section>h2{margin-bottom:12px;padding-bottom:8px}\n#dpc-app .dpc-home .dpc-results-feature{padding:16px 12px 18px;margin:0 -6px 20px;background:#19191e;border:1px solid #ffffff0c;border-radius:6px}\nhtml.dpc-light #dpc-app .dpc-home .dpc-results-feature{background:#fff;border-color:#0000000d}\n#dpc-app .dpc-home .dpc-results-feature h3{margin:0 0 12px;font-size:27px}\n#dpc-app .dpc-home-gallery{gap:8px}\n#dpc-app .dpc-home-feature-title.dpc-title{height:78px;min-height:78px}\n#dpc-app .dpc-results-rail{display:flex;width:100%;height:100%;transform:translate3d(calc(-100% - 12px),0,0);will-change:transform}\n#dpc-app .dpc-results-slide{position:relative;flex:0 0 100%;height:100%;min-width:0;background:#242424}\n#dpc-app .dpc-results-slide img{width:100%;height:100%;object-fit:contain}\n#dpc-app .dpc-home-hero{touch-action:pan-y;user-select:none}\n";
    style.textContent += "#dpc-app .dpc-results-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--line);margin-top:14px;padding:14px 2px 0;min-height:44px;box-sizing:border-box;color:var(--accent);font-size:13px;font-weight:600;text-decoration:none}#dpc-app .dpc-results-footer span{font-size:20px;font-weight:400}";
    style.textContent += "\n#dpc-app .dpc-home .dpc-results-feature{background:#25262e;border-color:#ffffff20;margin-bottom:24px}\nhtml.dpc-light #dpc-app .dpc-home .dpc-results-feature{background:#fff;border-color:#cdd3df}\n#dpc-app .dpc-results-footer{border-top-color:#ffffff26;background:#ffffff06;padding:12px 10px;margin-top:14px;border-radius:0 0 4px 4px}\nhtml.dpc-light #dpc-app .dpc-results-footer{border-top-color:#cdd3df;background:#526eaf09}\n#dpc-app .dpc-results-rail{gap:12px}\n#dpc-app .dpc-results-slide{background:#242424}\n";
    style.textContent += "#dpc-app .dpc-editorial-credit{position:relative;min-height:103px}#dpc-app .dpc-editorial-credit .dpc-home-feature-author{width:max-content;max-width:100%;white-space:nowrap;font-size:18px}#dpc-app .dpc-editorial-credit.tucked .dpc-home-feature-author{position:absolute;margin:0}#dpc-app .dpc-editorial-credit .dpc-title-line{width:max-content;max-width:100%}";
    style.textContent += "#dpc-app .dpc-home-feature-title.dpc-title{height:78px;min-height:78px;overflow:visible}#dpc-app .dpc-editorial-credit{min-height:103px}#dpc-app .dpc-editorial-credit .dpc-title-line{overflow:visible}#dpc-app .dpc-editorial-credit .dpc-title-part{overflow:visible}";
    style.textContent += "#dpc-app .dpc-home-hero,#dpc-app .dpc-results-slide{background:#151515}";
    style.textContent += "#dpc-app .dpc-editorial-credit .dpc-home-feature-author{display:flex;align-items:center;gap:7px}#dpc-app .dpc-caption-ribbon{position:static;flex:none;width:19px;height:26px;filter:none}#dpc-app .dpc-home-strip .dpc-overlay-ribbon{width:19px;height:26px;top:4px;left:4px}";
    style.textContent += "#dpc-app .dpc-entry-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}#dpc-app .dpc-entry-grid .dpc-home-card{min-width:0;display:flex;flex-direction:column;padding:10px;margin:0;border:1px solid var(--line);border-radius:6px;background:rgba(128,128,128,.06)}#dpc-app .dpc-entry-grid .dpc-home-card[hidden]{display:none!important}#dpc-app .dpc-entry-grid h3{font-size:19px;line-height:1.12;margin:0 0 6px;overflow-wrap:anywhere}#dpc-app .dpc-entry-grid .dpc-home-meta{font-size:12px;line-height:1.35;margin:0 0 6px}#dpc-app .dpc-entry-grid .dpc-home-detail{font-size:10px;line-height:1.3;gap:3px 8px;margin:0 0 8px}#dpc-app .dpc-entry-grid .dpc-home-action{font-size:11px;padding:7px 8px;margin-top:auto;align-self:flex-start}#dpc-app .dpc-home-vote-card:before{opacity:1;background-image:linear-gradient(90deg,#111115f5 0%,#111115eb 48%,#111115c4 100%),var(--vote-image,none)}html.dpc-light #dpc-app .dpc-home-vote-card:before{background-image:linear-gradient(90deg,#f5f6f8fa 0%,#f5f6f8ef 48%,#f5f6f8d0 100%),var(--vote-image,none)}@media(max-width:320px){#dpc-app .dpc-entry-grid{grid-template-columns:1fr}}";
    style.textContent += "#dpc-app .dpc-entry-grid{gap:10px}#dpc-app .dpc-entry-grid .dpc-home-card{position:relative;padding:13px 12px;min-height:142px;background:rgba(128,128,128,.095);color:inherit;text-decoration:none;gap:0}#dpc-app .dpc-entry-grid h3{font-size:23px;line-height:1.08;color:var(--accent);margin:0 0 8px;overflow-wrap:break-word}#dpc-app .dpc-entry-grid .dpc-home-meta{font-size:13px;line-height:1.4;color:inherit;opacity:.86;margin:0 0 12px}#dpc-app .dpc-entry-grid .dpc-home-detail{display:grid;grid-template-columns:1fr auto;gap:5px 6px;align-items:center;margin:auto 0 0;padding-top:9px;border-top:1px solid var(--line);font-size:11px;line-height:1.3}#dpc-app .dpc-entry-grid .dpc-entry-rules{grid-column:1/-1;text-transform:uppercase;letter-spacing:.055em;font-size:9px}#dpc-app .dpc-entry-grid .dpc-entry-deadline{grid-column:1/-1;color:var(--accent);font-size:12px;font-weight:600}#dpc-app .dpc-entry-grid .dpc-entry-count{grid-column:1/-1;font-size:11px}#dpc-app .dpc-entry-grid a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}#dpc-app .dpc-entry-grid a:active{background:rgba(128,128,128,.17)}";
    style.textContent += "#dpc-app .dpc-entry-grid .dpc-home-meta{font-weight:400;line-height:1.45}#dpc-app .dpc-entry-grid .dpc-home-detail{display:flex;flex-direction:column;align-items:flex-start;gap:5px;margin-top:auto}#dpc-app .dpc-entry-grid .dpc-entry-rules{font-weight:500}#dpc-app .dpc-entry-grid .dpc-entry-deadline{font-weight:500}#dpc-app .dpc-entry-grid .dpc-entry-count{font-weight:400}";
    style.textContent += "#dpc-app .dpc-results-footer{background:transparent;border-top-color:var(--line);padding:8px 2px 0;margin-top:10px;min-height:36px;font-size:12px;font-weight:400}html.dpc-light #dpc-app .dpc-results-footer{background:transparent;border-top-color:var(--line)}#dpc-app .dpc-results-footer span{font-size:16px}";
    document.head.append(style);

    const header = `
<header class="dpc-header">
    <a class="dpc-brand" href="/">
        <svg viewBox="0 0 40 40" aria-hidden="true"><mask id="dpc-shutter-mask"><circle cx="20" cy="20" r="18.5" fill="white"/><path d="M20 12 L26.928 16 L26.928 24 L20 28 L13.072 24 L13.072 16 Z" fill="black"/><path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate(0 20 20)"/><path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate(60 20 20)"/><path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate(120 20 20)"/><path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate(180 20 20)"/><path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate(240 20 20)"/><path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate(300 20 20)"/></mask><circle cx="20" cy="20" r="18.5" fill="currentColor" mask="url(#dpc-shutter-mask)"/></svg>DPChallenge
    </a>
    <div class="dpc-header-right"><span class="dpc-eyebrow">● VOTING</span><button type="button" class="dpc-theme-toggle" aria-label="Switch theme"></button></div>
</header>`;

    const footer = `
<footer class="dpc-footer">
    <div class="dpc-footer-mark">DPChallenge</div>
    Photographs © their respective photographers
    <br>
    <button class="dpc-text-button" id="dpc-original">
        View original website
    </button>
</footer>`;

    const progressMarkup = `
<div class="dpc-progress">
    <div class="dpc-progress-label">
        <div class="dpc-stat">
            <span class="dpc-stat-label">CHALLENGE PROGRESS</span>
            <span class="dpc-stat-value" id="dpc-progress-text"></span>
        </div>
        <div class="dpc-stat" id="dpc-average-stat">
            <span class="dpc-stat-label">AVERAGE SCORE</span>
            <span class="dpc-stat-value" id="dpc-average"></span>
        </div>
    </div>
    <div class="dpc-progress-track">
        <div class="dpc-fill"></div>
    </div>
</div>`;

    const gridIcon = `
<svg viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.5">
    ${Array.from({length:9},(_,i)=>
        `<rect x="${2+(i%3)*7}" y="${2+Math.floor(i/3)*7}"
         width="6" height="6" rx=".5"/>`
    ).join('')}
</svg>`;

    const expandIcon = `
<svg viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.5"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 3H3v6M15 3h6v6M21 15v6h-6M3 15v6h6"/>
</svg>`;

    const commentIcon = `
<svg viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.8">
    <path d="M21 11a8 8 0 0 1-8 8H5l2-4a8 8 0 1 1 14-4Z"/>
</svg>`;

    const app = document.createElement('main');
    app.id = 'dpc-app';

    const $ = s => app.querySelector(s);
    const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
    const sleep = ms => new Promise(r => setTimeout(r,ms));
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

    const imageURL = id => new URL(
        '/challenge_vote_image.php?IMAGE_ID='+encodeURIComponent(id),
        location.origin
    ).href;

    const listURL = id => new URL(
        '/challenge_vote_list.php?CHALLENGE_ID='+encodeURIComponent(id),
        location.origin
    ).href;

    function stats(text) {
        return {
            progress:text.match(/You have rated\s+(\d+)\s+of\s+(\d+)\s+images/i),
            average:text.match(/average score of\s+(\d+(?:\.\d+)?)/i)
        };
    }

    function showStats(data) {
        $('.dpc-progress').hidden = !data.progress;

        if (data.progress) {
            const [,r,t] = data.progress;
            $('#dpc-progress-text').textContent = r+' / '+t;
            $('.dpc-fill').style.width =
                (+t ? Math.min(100,+r/+t*100) : 0)+'%';
        }

        $('#dpc-average-stat').hidden = !data.average;

        if (data.average) {
            $('#dpc-average').textContent =
                Number(data.average[1]).toFixed(2);
        }
    }

    function mount() {
        document.body.append(app);
        root.classList.add('dpc-mobile');

        const toggle = app.querySelector('.dpc-theme-toggle');
        let light = false;
        try {
            light = localStorage.getItem('dpc-theme') === 'light';
        } catch {}
        function applyTheme() {
            root.classList.toggle('dpc-light',light);
            toggle.innerHTML = light ? "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20.8 14.2A9 9 0 0 1 9.8 3.2 9 9 0 1 0 20.8 14.2Z\"/></svg>" : "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"/></svg>";
            const label = light ? 'Switch to dark mode' : 'Switch to light mode';
            toggle.title = label;
            toggle.setAttribute('aria-label',label);
        }
        applyTheme();
        toggle.onclick = () => {
            light = !light;
            try {
                localStorage.setItem('dpc-theme',light?'light':'dark');
            } catch {}
            applyTheme();
        };

    }

    function original(url = location.href) {
        sessionStorage.setItem('dpc-original-once','1');
        location.href = url;
    }

    /* ==========================================
       CHALLENGE OVERVIEW
       ========================================== */


    function editorialTypeset(el,title,direction=0,animate=true) {

        const words=title.trim().split(/\s+/);
        const text=words.join(' ');

        el.replaceChildren();
        el.classList.add('dpc-title');
        el.classList.toggle('single',words.length===1);

        el.setAttribute('aria-label',text);

        function line(parts,indent=false) {
            const row=document.createElement('span');
            row.className='dpc-title-line'+
                (indent?' indent':'');

            parts.forEach((part,i)=>{
                if (i) row.append(' ');

                const span=document.createElement(
                    part.italic?'em':'span'
                );

                span.className='dpc-title-part';
                span.textContent=part.text;
                row.append(span);
            });

            el.append(row);
        }

        if (words.length===1) {
            line([{text}]);
        } else if (text.length<=19) {
            line([
                {text:words.slice(0,-1).join(' ')},
                {text:words.at(-1),italic:true}
            ]);
        } else if (text.length<=65) {
            let split=1,best=Infinity;

            for (let i=1;i<words.length;i++) {
                const a=words.slice(0,i).join(' ');
                const b=words.slice(i).join(' ');

                const cost=Math.abs(a.length-b.length)+
                    (/^(the|a|an|of|to|in|and)$/i.test(words[i-1])
                        ?12:0);

                if (cost<best) {
                    best=cost;
                    split=i;
                }
            }

            line([{text:words.slice(0,split).join(' ')}]);

            line([
                {text:words.slice(split).join(' '),italic:true}
            ],true);
        } else {
            const split=Math.ceil(words.length/2);

            line([{text:words.slice(0,split).join(' ')}]);
            line([
                {text:words.slice(split).join(' '),italic:true}
            ],true);
        }

        /* V3.2 — Measure actual text, not the flex container */
        el.style.removeProperty('font-size');

        const availableWidth=el.clientWidth;
        const availableHeight=Math.max(0,el.clientHeight-8);

        let size=words.length===1?66:
            text.length<=19?56:
            text.length<=65?40:27;

        const rows=[...el.children];

        if (availableWidth>0 && availableHeight>0) {
            for (;size>=22;size--) {
                el.style.fontSize=size+'px';

                const textHeight=rows.reduce(
                    (sum,row)=>sum+row.getBoundingClientRect().height,0
                );

                const tooWide=rows.some(row=>
                    row.scrollWidth>availableWidth+1
                );

                if (!tooWide && textHeight<=availableHeight+1) break;
            }
        }

        el.style.fontSize=Math.max(22,size)+'px';

        if (!animate || reducedMotion.matches) return;

        const parts=[...el.querySelectorAll('.dpc-title-part')];

        parts.forEach((part,i)=>{
            const italic=part.tagName==='EM';
            const distance=italic?38:24;

            const transform=direction
                ? `translateX(${direction*distance}px)`
                : `translateY(${italic?14:8}px)`;

            part.animate([
                {opacity:0,transform},
                {opacity:1,transform:'translate(0,0)'}
            ],{
                duration:italic?520:420,
                delay:i*105,
                easing:'cubic-bezier(.16,1,.3,1)',
                fill:'both'
            });
        });
    }


    function buildHome() {
        const photoCacheKey='dpc-home-full-images-v1';
        let photoCache={};
        try{photoCache=JSON.parse(localStorage.getItem(photoCacheKey)||'{}')||{};}catch{}
        function cachedPhoto(rec){
            const hit=photoCache[safe(rec.a)];
            if(hit&&hit.thumb===rec.src&&Date.now()-hit.time<30*86400000&&/^https?:\/\//i.test(hit.full)){
                rec.full=hit.full;rec.ratio=hit.ratio;rec.area=hit.area;
            }
        }
        function savePhoto(rec){
            if(!rec.full)return;
            photoCache[safe(rec.a)]={thumb:rec.src,full:rec.full,ratio:rec.ratio,area:rec.area,time:Date.now()};
            photoCache=Object.fromEntries(Object.entries(photoCache).sort((a,b)=>b[1].time-a[1].time).slice(0,200));
            try{localStorage.setItem(photoCacheKey,JSON.stringify(photoCache));}catch{}
        }

        const clean = n => (n?.textContent || '').replace(/\s+/g,' ').trim();
        const originalLinks = [...document.querySelectorAll('a[href]')];
        const safe = a => {try {const u=new URL(a.getAttribute('href'),location.href);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
        const heading = re => [...document.querySelectorAll('body *')].find(n=>re.test(clean(n)) && ![...n.children].some(c=>re.test(clean(c))));
        const voteHead=heading(/Challenges Needing Your Votes/i);
        const entryHead=heading(/Challenges Open for Submissions?/i);
        const forumHead=heading(/Recent Forum Activity/i);
        const newsHead=heading(/^Site News\s*:?$/i);
        const region = (h,predicate) => {
            if(!h)return null;
            for(let p=h;p&&p!==document.body;p=p.parentElement){
                if([...p.querySelectorAll('a[href]')].some(predicate))return p;
            }
            return null;
        };
        const challengeLink=a=>/challenge[^/?]*\.php/i.test(safe(a))&&/challenge_id=/i.test(safe(a));
        const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n;};
        const link=(a,cls,txt)=>{const n=make('a',cls,txt||clean(a));n.href=safe(a);return n;};
        function challenges(h,voting){
            const area=region(h,challengeLink);if(!area)return [];
            const items=new Map();
            for(const a of area.querySelectorAll('a[href]')){
                if(!challengeLink(a))continue;
                const u=new URL(safe(a)),id=u.searchParams.get('CHALLENGE_ID')||u.searchParams.get('challenge_id');
                const name=clean(a);
                if(!id||!name||/^(vote|enter|submit|results|more|view|details|review|\[more\])$/i.test(name))continue;
                if(items.has(id))continue;
                let block=a.closest('tr')||a.parentElement;
                for(let p=block;p&&p!==area;p=p.parentElement){
                    const t=clean(p);
                    if(t.length>1200)break;
                    block=p;
                    if(/(?:rated|entries|left|remaining|deadline)/i.test(t))break;
                }
                const raw=clean(block);
                const progress=raw.match(/(\d+)\s*(?:\/|of)\s*(\d+)\s*(?:images\s*)?rated/i)||raw.match(/rated\s+(\d+)\s*(?:\/|of)\s*(\d+)/i);
                const action=[...block.querySelectorAll('a[href]')].find(x=>voting?/challenge_vote_(?:list|image)\.php/i.test(safe(x)):/challenge_submit\.php/i.test(safe(x)))||a;
                items.set(id,{name,raw,progress,action,a});
            }
            return [...items.values()].sort((a,b)=>voting?Number(!!a.progress&&+a.progress[1]>=+a.progress[2])-Number(!!b.progress&&+b.progress[1]>=+b.progress[2]):0);
        }
        const votes=challenges(voteHead,true),entries=challenges(entryHead,false);
        if(!votes.length&&!entries.length)console.warn('DPC homepage: challenge markup not recognised');
        app.innerHTML=header.replace('● VOTING','').replace('</header>','</header>')+'<nav class="dpc-home-menu" hidden></nav><div class="dpc-home"></div>'+footer;
        const menu=$('.dpc-home-menu'),body=$('.dpc-home');
        const menuButton=make('button','dpc-home-menu-button','☰');
        menuButton.type='button';menuButton.setAttribute('aria-label','Navigation');menuButton.setAttribute('aria-expanded','false');
        $('.dpc-header-right').append(menuButton);
        menuButton.onclick=()=>{menu.hidden=!menu.hidden;menuButton.setAttribute('aria-expanded',String(!menu.hidden));};
        const seen=new Set();
        function menuLink(a){const url=safe(a),name=clean(a);if(!url||!name||seen.has(url))return;seen.add(url);menu.append(link(a));}
        originalLinks.filter(a=>/^(My Home|Challenges|Community|League|Photos|Equipment|Learn|Help|Inbox|Log out|Log in|Register|Private Messaging|Image Search)$/i.test(clean(a))).forEach(menuLink);
        const news=region(newsHead,a=>!!clean(a)&&!!safe(a));if(news) [...news.querySelectorAll('a[href]')].forEach(menuLink);
        const inbox=originalLinks.find(a=>/inbox|private messag/i.test(clean(a)));if(inbox)menuLink(inbox);
        const searchForm=[...document.forms].find(f=>/image.search/i.test(f.action)||/image search/i.test(clean(f)));
        if(searchForm)menu.append(searchForm.cloneNode(true));
        const welcome=(document.body.textContent||'').match(/Welcome back[^\r\n]{0,80}/i);
        if(welcome)body.append(make('div','dpc-home-welcome',welcome[0].split(/\(\s*log out/i)[0].trim()));
        function section(first,last){const sec=make('section');const h=make('h2','',first+' ');h.append(make('em','',last));sec.append(h);body.append(sec);return sec;}
        function cards(items,sec,voting,limit){
            const hidden=[];
            const grid=voting?sec:make('div','dpc-entry-grid');if(!voting)sec.append(grid);
            items.forEach((item,i)=>{
                const card=make(voting?'article':'a','dpc-home-card');
                if(!voting)card.href=safe(item.action)||safe(item.a);
                const title=make('h3');if(voting)title.append(link(item.a,'',item.name));else title.textContent=item.name;card.append(title);
                const meta=item.raw.replace(item.name,'').replace(/\s*\.\.\s*\[more\]\s*/gi,' ').replace(/^\s*[·•]\s*/,'').trim();
                const rules=meta.match(/\b(?:Standard|Minimal|Extended|Advanced|Expert|Basic|No) Editing\b/i);
                const deadline=meta.match(/(?:\d+\s+(?:days?|hours?|minutes?)(?:\s+and\s+|\s+)?)+left/i);
                const count=meta.match(/\b(\d+)\s+(?:entry|entries)\b(?:\s+received\b)?/i);
                let description=meta.replace(/you rated.*$/i,'').replace(/Thank you for voting!?/gi,'');
                if(rules)description=description.replace(rules[0],'');
                if(deadline)description=description.replace(deadline[0],'');
                if(!voting&&count)description=description.replace(count[0],'');
                description=description.replace(/^[\s·•]+|[\s·•]+$/g,'');
                if(!voting)description=description.replace(/\bEnter this challenge\b/gi,'').replace(/(?:^|[·•])\s*received\b/gi,'').replace(/^[\s·•]+|[\s·•]+$/g,'').trim();
                if(!voting&&(!description||/^N\s*\/\s*A\.?$/i.test(description)))description='No description provided.';
                if(description&&!/^N\s*\/\s*A\.?$/i.test(description))card.append(make('div','dpc-home-meta',description));
                const details=make('div','dpc-home-detail');
                if(rules)details.append(make('span','dpc-entry-rules',rules[0]));
                if(deadline)details.append(make('span','dpc-entry-deadline',deadline[0]));
                if(!voting&&count)details.append(make('span','dpc-entry-count',count[1]+' '+(+count[1]===1?'entry':'entries')));
                if(details.childNodes.length)card.append(details);
                if(item.progress)card.append(make('div','dpc-home-vote-status',item.progress[1]+' of '+item.progress[2]+' rated'));
                if(item.progress){const bar=make('div','dpc-home-progress'),fill=make('i');fill.style.width=Math.min(100,100*+item.progress[1]/Math.max(1,+item.progress[2]))+'%';bar.append(fill);card.append(bar);}
                if(voting){
                    card.classList.add('dpc-home-vote-card');
                    fetch(safe(item.action),{credentials:'same-origin'}).then(r=>r.ok?r.text():'').then(html=>{
                        const doc=new DOMParser().parseFromString(html,'text/html');
                        const images=[...doc.querySelectorAll('.dpc-vote-thumbnail-image img,.dpc-vote-primary-image')];
                        if(images.length){const image=images[Math.floor(Math.random()*images.length)];const entry=image.closest('a[href]')||image.closest('.dpc-vote-thumbnail-cell')?.querySelector('a[href*="challenge_vote_image.php"]');const set=src=>{const url=new URL(src,safe(item.action));if(/^https?:$/.test(url.protocol))card.style.setProperty('--vote-image','url('+JSON.stringify(url.href)+')');};if(image.matches('.dpc-vote-primary-image'))set(image.getAttribute('src'));else if(entry){const url=new URL(entry.getAttribute('href'),safe(item.action));fetch(url,{credentials:'same-origin'}).then(r=>r.ok?r.text():'').then(html=>{const photo=new DOMParser().parseFromString(html,'text/html').querySelector('.dpc-vote-primary-image');if(photo)set(new URL(photo.getAttribute('src'),url).href);}).catch(()=>{});}}
                    }).catch(()=>{});
                }
                if(voting)card.append(link(item.action,'dpc-home-action',item.progress&&+item.progress[1]>=+item.progress[2]?'Review votes':'Continue voting'));
                grid.append(card);if(i>=limit){card.hidden=true;hidden.push(card);}
            });
            if(hidden.length){const b=make('button','dpc-home-more','View all '+items.length);b.onclick=()=>{hidden.forEach(c=>c.hidden=false);b.remove();};sec.append(b);}
        }
        if(votes.length)cards(votes,section('Voting','now'),true,Infinity);
        else if(voteHead){const sec=section('Voting','now');const area=region(voteHead,a=>!!safe(a));if(area){const copy=area.cloneNode(true);sec.append(copy);}}
        if(entries.length)cards(entries,section('Open for','entries'),false,Infinity);
        else if(entryHead){const sec=section('Open for','entries');const area=region(entryHead,a=>!!safe(a));if(area)sec.append(area.cloneNode(true));}
        const winnerLinks=originalLinks.filter(a=>/\/image\.php\?/i.test(safe(a))&&a.querySelector('img'));
        const groups=new Map();
        for(const a of winnerLinks){
            let p=a.parentElement;
            while(p&&p!==document.body){
                const count=[...p.querySelectorAll('a[href]')].filter(x=>winnerLinks.includes(x)).length;
                if(count>=5){if(count===5){if(!groups.has(p))groups.set(p,[...p.querySelectorAll('a[href]')].filter(x=>winnerLinks.includes(x)));}break;}
                p=p.parentElement;
            }
        }
        if(groups.size){
            const sec=section('Recent','results');body.prepend(sec);
            for(const [group,photos] of groups){
                const card=make('article','dpc-home-card dpc-results-feature');
                const titleLink=[...group.querySelectorAll('a[href]')].find(challengeLink)||[...group.parentElement.querySelectorAll('a[href]')].find(challengeLink);
                let label=null;
                for(let p=group;p&&p!==document.body;p=p.parentElement){
                    const nodes=[...p.querySelectorAll('td,th,div,b,strong,span')];
                    label=nodes.find(x=>/Winning Entries/i.test(clean(x))&&clean(x).length<220&&! [...x.children].some(c=>/Winning Entries/i.test(clean(c))));
                    if(label)break;
                    let prev=p.previousElementSibling;
                    if(prev&&/Winning Entries/i.test(clean(prev))&&clean(prev).length<220){label=prev;break;}
                }
                
                const h=make('h3');
                const name=label?clean(label).split(/\s+-\s+(?:Member|Open|Invitational|Speed|Winning)/i)[0]:titleLink?clean(titleLink):'';
                if(titleLink&&name)h.append(link(titleLink,'',name));else h.textContent=name;
                if(name)card.append(h);
                const grid=make('div','dpc-home-gallery');
                const hero=make('a','dpc-home-hero'),heroImg=make('img');const rail=make('div','dpc-results-rail');const before=make('div','dpc-results-slide'),centre=make('div','dpc-results-slide'),after=make('div','dpc-results-slide');centre.append(heroImg);rail.append(before,centre,after);hero.append(rail);
                const credits=make('div','dpc-editorial-credit'),featureTitle=make('a','dpc-home-feature-title'),featureAuthor=make('a','dpc-home-feature-author');credits.append(featureTitle,featureAuthor);
                const strip=make('div','dpc-home-strip');grid.append(hero,credits,strip);
                const records=photos.map((a,i)=>{
                    const img=a.querySelector('img');let author=null;
                    for(let p=a.parentElement;p&&p!==group;p=p.parentElement){
                        if([...p.querySelectorAll('a[href]')].filter(x=>winnerLinks.includes(x)).length>1)break;
                        author=[...p.querySelectorAll('a[href]')].find(x=>/profile\.php|user\.php|USER_ID=/i.test(safe(x))&&clean(x));if(author)break;
                    }
                    return {a,img,author,title:clean(a)||img.alt||'',src:img.currentSrc||img.src,i};
                });
                records.forEach(cachedPhoto);
                let serial=0,selected=-1,selectionToken=0;
                const dimensions=()=>{const w=hero.clientWidth;if(!w)return;const ratios=records.map(rec=>rec.ratio||((rec.img.naturalWidth&&rec.img.naturalHeight)?rec.img.naturalHeight/rec.img.naturalWidth:1));hero.style.setProperty('--hero-height',Math.min(innerHeight*.6,w*Math.min(1,Math.max(...ratios)))+'px');};
                function ribbon(i){
                    if(i>2)return null;
                    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
                    icon.setAttribute('class','dpc-overlay-ribbon');icon.setAttribute('viewBox','0 0 40 54');icon.setAttribute('aria-label',['First place','Second place','Third place'][i]);
                    const id='dpc-ribbon-'+[...groups.keys()].indexOf(group)+'-'+(++serial);
                    icon.innerHTML='<defs><mask id="'+id+'"><circle cx="20" cy="20" r="18.5" fill="white"/><path d="M20 12 L26.928 16 L26.928 24 L20 28 L13.072 24 L13.072 16 Z" fill="black"/>'+Array.from({length:6},(_,j)=>'<path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate('+(j*60)+' 20 20)"/>').join('')+'</mask></defs><circle cx="20" cy="20" r="18.5" fill="currentColor" mask="url(#'+id+')"/>';
                    icon.innerHTML+='<path d="M8 34 A20.2 20.2 0 0 0 19 40.2 L13 52 L10 46 L3 48 Z M21 40.2 A20.2 20.2 0 0 0 32 34 L37 48 L30 46 L27 52 Z" fill="currentColor"/>';icon.style.color=['#668cda','#d45a65','#e4c45c'][i];return icon;
                }
                function preload(rec){
                    if(rec.promise)return rec.promise;
                    if(rec.full){
                        const probe=new Image();rec.probe=probe;
                        rec.promise=new Promise(resolve=>{
                            probe.onload=()=>resolve();
                            probe.onerror=()=>{delete photoCache[safe(rec.a)];try{localStorage.setItem(photoCacheKey,JSON.stringify(photoCache));}catch{}delete rec.full;delete rec.area;delete rec.promise;preload(rec).then(resolve);};
                            probe.src=rec.full;
                        });
                        return rec.promise;
                    }
                    rec.promise=fetch(safe(rec.a),{credentials:'same-origin'}).then(r=>r.ok?r.text():'').then(async html=>{
                        const doc=new DOMParser().parseFromString(html,'text/html');
                        const file=new URL(rec.src,location.href).pathname.split('/').pop();
                        const candidates=[...doc.images].filter(x=>{const src=x.getAttribute('src')||'';return src&&!/thumb|ribbon|logo|avatar|banner|spacer/i.test(src);});
                        const same=candidates.filter(x=>{try{return new URL(x.getAttribute('src'),safe(rec.a)).pathname.split('/').pop()===file;}catch{return false;}});
                        const preferred=doc.querySelector('.dpc-vote-primary-image, img#image, img#main_image');
                        const picks=preferred?[preferred]:same.length?same:candidates.filter(x=>/\/(?:image|images|photo|photos)\//i.test(x.getAttribute('src')||'')&&(+x.getAttribute('width')>=400||+x.getAttribute('height')>=400));
                        await Promise.all(picks.slice(0,4).map(candidate=>new Promise(resolve=>{
                            const url=new URL(candidate.getAttribute('src'),safe(rec.a)).href;const probe=new Image();
                            probe.onload=()=>{const area=probe.naturalWidth*probe.naturalHeight;if(area>Math.max(rec.area||0,40000)){rec.area=area;rec.full=url;rec.ratio=probe.naturalHeight/probe.naturalWidth;savePhoto(rec);}resolve();};probe.onerror=resolve;probe.src=url;
                        })));
                    }).catch(()=>{});
                    return rec.promise;
                }
                function composeCredit(){
                    featureAuthor.style.removeProperty('margin-top');featureAuthor.style.removeProperty('margin-left');featureAuthor.style.removeProperty('left');featureAuthor.style.removeProperty('top');
                    credits.classList.remove('tucked');
                    const rows=[...featureTitle.querySelectorAll('.dpc-title-line')];
                    rows.forEach(row=>{row.style.removeProperty('align-self');row.style.removeProperty('margin-left');});
                    if(featureAuthor.hidden||!rows.length||!credits.clientWidth)return;
                    const row=rows.at(-1),w=credits.clientWidth,aw=featureAuthor.getBoundingClientRect().width;
                    if(rows.length>1){const initial=parseFloat(featureTitle.style.fontSize);for(let size=initial+1;size<=60;size++){featureTitle.style.fontSize=size+'px';if(rows.some(r=>r.scrollWidth>w+1)||rows.reduce((h,r)=>h+r.offsetHeight,0)>featureTitle.clientHeight-8){featureTitle.style.fontSize=(size-1)+'px';break;}}}
                    if(!aw||aw>w*.8)return;
                    const base=credits.getBoundingClientRect();
                    const ctx=document.createElement('canvas').getContext('2d');
                    if(!ctx)return;
                    function measure(){
                        const rr=row.getBoundingClientRect(),blocked=[];
                        let baseline=rr.bottom;
                        for(const part of row.querySelectorAll('.dpc-title-part')){
                            const cs=getComputedStyle(part);
                            ctx.font=cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
                            const m=ctx.measureText('Hg');
                            baseline=rr.top+(rr.height-(m.fontBoundingBoxAscent||parseFloat(cs.fontSize)*.8)-(m.fontBoundingBoxDescent||parseFloat(cs.fontSize)*.2))/2+(m.fontBoundingBoxAscent||parseFloat(cs.fontSize)*.8);
                            const node=part.firstChild;if(!node||node.nodeType!==3)continue;
                            for(let j=0;j<node.length;j++){
                                const ch=node.textContent[j],metric=ctx.measureText(ch);
                                if(metric.actualBoundingBoxDescent<2&&!/[fgjpqy]/i.test(ch))continue;
                                const range=document.createRange();range.setStart(node,j);range.setEnd(node,j+1);
                                const box=range.getBoundingClientRect();const pad=/f/i.test(ch)?Math.max(18,parseFloat(cs.fontSize)*.38):9;
                                blocked.push([box.left-base.left-pad,box.right-base.left+pad]);
                            }
                        }
                        return {baseline:baseline-base.top,blocked};
                    }
                    // Leave the credit beneath the baseline, but let it share the descender band.
                    function choose(m){
                        const rr=row.getBoundingClientRect();
                        const center=(rr.left+rr.right)/2-base.left;
                        const target=Math.max(0,Math.min(w-aw,center-aw*.35));
                        const choices=[target,0,w-aw,...m.blocked.flatMap(([l,r])=>[l-aw-4,r+4])].filter(x=>x>=0&&x+aw<=w);
                        return choices.filter(x=>m.blocked.every(([l,r])=>x+aw+3<=l||x>=r+3)).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];
                    }
                    let m=measure(),x=choose(m);
                    if(x===undefined&&rows.length===1){
                        const original=parseFloat(featureTitle.style.fontSize);
                        for(let factor of [.96,.92,.88]){
                            featureTitle.style.fontSize=original*factor+'px';
                            for(const align of ['flex-end','flex-start']){
                                row.style.alignSelf=align;m=measure();x=choose(m);if(x!==undefined)break;
                            }
                            if(x!==undefined)break;
                        }
                        if(x===undefined){featureTitle.style.fontSize=original+'px';row.style.removeProperty('align-self');}
                    }
                    if(x===undefined){featureAuthor.style.marginTop=/f/i.test(row.textContent)?'6px':'';featureAuthor.style.marginLeft=Math.max(0,Math.min(w-aw,(row.getBoundingClientRect().left+row.getBoundingClientRect().right)/2-base.left-aw*.35))+'px';return;}
                    const top=Math.max(0,m.baseline+(/[f]/i.test(row.textContent)?10:6));
                    if(top+featureAuthor.offsetHeight>credits.clientHeight)return;
                    featureAuthor.style.left=x+'px';featureAuthor.style.top=top+'px';credits.classList.add('tucked');
                }
                async function select(i){
                    if(i<0||i>=records.length)return;
                    const token=++selectionToken,rec=records[i],direction=selected<0?0:Math.sign(i-selected);
                    if(selected>=0)await preload(rec);
                    if(token!==selectionToken)return;
                    selected=i;hero.href=safe(rec.a);heroImg.src=rec.full||rec.src;heroImg.alt=rec.title;heroImg.onerror=()=>{if(selected===i&&heroImg.src!==rec.src){heroImg.src=rec.src;preload(rec).then(()=>{if(selected===i&&rec.full)heroImg.src=rec.full;});}};
                    centre.querySelector('svg')?.remove();refreshAdjacent();
                    featureTitle.href=hero.href;editorialTypeset(featureTitle,rec.title,direction,false);
                    featureAuthor.hidden=!rec.author;if(rec.author){featureAuthor.href=safe(rec.author);featureAuthor.textContent='by '+clean(rec.author);const award=ribbon(i);if(award){award.classList.add('dpc-caption-ribbon');featureAuthor.prepend(award);}}
                    composeCredit();
                    if(!reducedMotion.matches)featureTitle.querySelectorAll('.dpc-title-part').forEach((part,j)=>part.animate([{opacity:0,transform:'translateX('+(direction*20)+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:420,delay:j*105,fill:'both',easing:'cubic-bezier(.16,1,.3,1)'}));
                    if(!reducedMotion.matches)featureAuthor.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,delay:140,fill:'both'});
                    [...strip.children].forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));
                    
                    if(!rec.full)preload(rec).then(()=>{if(selected===i&&rec.full)heroImg.src=rec.full;});
                }
                function refreshAdjacent(){
                    [[before,selected-1],[after,selected+1]].forEach(([slide,i])=>{
                        slide.replaceChildren();const rec=records[i];if(!rec)return;
                        const img=make('img');img.src=rec.full||rec.src;img.alt=rec.title;img.draggable=false;slide.append(img);
                        preload(rec).then(()=>{if(slide.contains(img)&&rec.full)img.src=rec.full;});
                    });
                }
                let touch=null,suppressClick=0,settling=false;
                function offset(x,animate=false){rail.style.transition=animate&&!reducedMotion.matches?'transform 220ms cubic-bezier(.2,.75,.25,1)':'none';rail.style.transform='translate3d(calc(-100% - 12px + '+x+'px),0,0)';}
                hero.addEventListener('pointerdown',e=>{if(e.isPrimary&&!settling&&e.button===0)touch={x:e.clientX,y:e.clientY,t:performance.now(),dx:0,drag:false,id:e.pointerId};});
                hero.addEventListener('pointermove',e=>{
                    if(!touch||e.pointerId!==touch.id)return;
                    const dx=e.clientX-touch.x,dy=e.clientY-touch.y;
                    if(!touch.drag){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){touch=null;return;}if(Math.abs(dx)<7)return;touch.drag=true;hero.setPointerCapture(e.pointerId);}
                    touch.dx=dx;offset((selected===0&&dx>0)||(selected===records.length-1&&dx<0)?dx*.25:dx);
                });
                async function finish(e,cancel=false){
                    if(!touch)return;const t=touch;touch=null;if(!t.drag)return;
                    suppressClick=Date.now()+600;
                    const w=hero.clientWidth,dir=t.dx<0?1:-1,next=selected+dir;
                    const commit=!cancel&&next>=0&&next<records.length&&(Math.abs(t.dx)>w*.22||(Math.abs(t.dx)>35&&performance.now()-t.t<300));
                    settling=true;offset(commit?-dir*(w+12):0,true);
                    await new Promise(resolve=>setTimeout(resolve,reducedMotion.matches?0:230));
                    if(commit)await select(next);
                    offset(0);settling=false;
                }
                hero.addEventListener('pointerup',e=>finish(e));
                hero.addEventListener('pointercancel',e=>finish(e,true));
                hero.addEventListener('click',e=>{if(Date.now()<suppressClick||settling)e.preventDefault();});
                heroImg.draggable=false;
                const init=()=>{dimensions();editorialTypeset(featureTitle,records[selected<0?0:selected].title,0,false);composeCredit();};
                const ro=new ResizeObserver(init);ro.observe(hero);
                document.fonts?.ready.then(init);
                records.forEach(rec=>{if(!rec.img.complete)rec.img.addEventListener('load',dimensions,{once:true});});
                const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){io.disconnect();Promise.all(records.map(preload)).then(()=>{dimensions();refreshAdjacent();});}},{rootMargin:'700px'});io.observe(card);
                records.forEach((rec,i)=>{const button=make('button');button.type='button';button.setAttribute('aria-label',rec.title+(rec.author?' by '+clean(rec.author):''));const img=make('img');img.src=rec.src;img.alt=rec.title;img.loading='lazy';button.append(img);button.onclick=()=>select(i);strip.append(button);});
                select(0);
                card.append(grid);
                const resultLink=[...(label?.querySelectorAll('a[href]')||[]),...(label?.closest('tr')?.querySelectorAll('a[href]')||[]),...group.querySelectorAll('a[href]')].find(a=>challengeLink(a)&&/results/i.test(safe(a)))||[...(label?.querySelectorAll('a[href]')||[]),...(label?.closest('tr')?.querySelectorAll('a[href]')||[])].find(challengeLink)||titleLink;
                if(resultLink){
                    const footerLink=link(resultLink,'dpc-results-footer','View full results');
                    const arrow=make('span','','→');arrow.setAttribute('aria-hidden','true');footerLink.append(arrow);card.append(footerLink);
                }
                sec.append(card);
            }
        }
        const forum=region(forumHead,a=>/forum.*(?:THREAD_ID|thread)/i.test(safe(a)));
        if(forum){
            const sec=section('Community','talk'),hidden=[],seenThreads=new Set();
            for(const a of forum.querySelectorAll('a[href]')){
                const url=safe(a);if(!/forum.*(?:THREAD_ID|thread)/i.test(url)||!clean(a)||seenThreads.has(url))continue;
                seenThreads.add(url);const n=link(a,'dpc-home-thread');const row=a.closest('tr');if(row)n.append(make('small','',clean(row).replace(clean(a),'').trim()));sec.append(n);
                if(seenThreads.size>8){n.hidden=true;hidden.push(n);}
            }
            if(hidden.length){const b=make('button','dpc-home-more','Load more');b.onclick=()=>{hidden.forEach(n=>n.hidden=false);b.remove();};sec.append(b);}
        }
        $('#dpc-original').onclick=()=>original();
        mount();
    }

    function buildList() {
        const cells = [...document.querySelectorAll(
            '.dpc-vote-thumbnail-cell'
        )];

        const challengeId = new URL(location.href)
            .searchParams.get('CHALLENGE_ID');

        if (!challengeId) return;

        const fields = {};

        for (const row of document.querySelectorAll('tr')) {
            if (row.cells.length !== 2) continue;

            const label = row.cells[0].textContent
                .trim().replace(/:$/,'');

            if ([
                'Challenge','Rules','Submissions',
                'Voting Deadline','Details',
                'Extra Rules','Stats','Filter'
            ].includes(label)) {
                fields[label] = row.cells[1];
            }
        }

        if (!fields.Challenge) return;

        const entries = cells.map(cell => {
            const link = cell.querySelector(
                'a[href*="challenge_vote_image.php?IMAGE_ID="]'
            );

            const photo = cell.querySelector(
                '.dpc-vote-thumbnail-image img'
            );

            if (!link || !photo) return null;

            const selected = cell.querySelector('a.vs');
            const comment = cell.querySelector(
                'img[src*="comment_"]'
            );

            const rating = Number(selected?.textContent.trim()) || 0;

            return {
                href:link.href,
                source:photo.currentSrc || photo.src,
                title:link.querySelector('b')?.textContent.trim()
                    || link.textContent.trim()
                    || 'Photograph',
                rating,
                commented:!!comment &&
                    !comment.src.includes('comment_none')
            };
        }).filter(Boolean);

        const data = stats(document.body.innerText);

        const title = fields.Challenge.querySelector('a')
            ?.textContent.trim() || 'Challenge';

        const edition = fields.Challenge.querySelector('img')
            ?.alt || 'Photography Challenge';

        const field = name =>
            fields[name]?.textContent.trim() || '';

        const filterLinks = [
            ...(fields.Filter?.querySelectorAll('a') || [])
        ];

        const withoutComments = filterLinks.find(a =>
            /without comments/i.test(a.textContent)
        )?.href;

        const nativePages = [
            ...document.querySelectorAll('a')
        ].filter(a => a.querySelector('img[src*="/images/page/"]'));

        const currentFilter = new URL(location.href)
            .searchParams.get('filter');

        app.innerHTML = header+`
<div class="dpc-list-content">
    <div class="dpc-list-edition"></div>
    <h1 class="dpc-list-title"></h1>
    <div class="dpc-list-meta"></div>

    <details class="dpc-details">
        <summary>Challenge details &amp; rules</summary>
        <div class="dpc-details-content"></div>
    </details>

    ${progressMarkup}

    <div class="dpc-list-filters">
        <button class="dpc-filter" data-filter="all">All</button>
        <button class="dpc-filter" data-filter="unrated">Unrated</button>
        <button class="dpc-filter" data-filter="comments">Without comments</button>
    </div>

    <div class="dpc-rating-filters"></div>
    <div class="dpc-list-groups"></div>
    <div class="dpc-pagination"></div>
    ${footer}
</div>`;

        $('.dpc-list-edition').textContent = edition;

        const words = title.split(/\s+/);
        const split = Math.ceil(words.length/2);

        const heading = $('.dpc-list-title');
        heading.append(words.slice(0,split).join(' '));

        if (words.length > 1) {
            const em = document.createElement('em');
            em.textContent = words.slice(split).join(' ');
            heading.append(em);
        }

        $('.dpc-list-meta').textContent = [
            field('Submissions') && field('Submissions')+' photographs',
            field('Voting Deadline') && 'Voting ends '+field('Voting Deadline')
        ].filter(Boolean).join(' · ');

        const details = $('.dpc-details-content');

        for (const name of ['Details','Rules','Extra Rules','Voting Deadline']) {
            if (!field(name)) continue;

            const label = document.createElement('span');
            label.className = 'dpc-detail-label';
            label.textContent = name;
            details.append(label);

            const nativeLink = fields[name]?.querySelector('a');

            if (nativeLink && name === 'Rules') {
                const link = document.createElement('a');
                link.href = nativeLink.href;
                link.textContent = nativeLink.textContent;
                details.append(link);
            } else {
                const value = document.createElement('div');
                value.textContent = field(name);
                details.append(value);
            }
        }

        showStats(data);


        /* V3.0 — Complete challenge index */
        const entryMap = new Map(entries.map(e=>[e.href,e]));
        const pageQueue = [listURL(challengeId)];
        const visitedPages = new Set();
        const BATCH = 24;
        let visibleLimit = BATCH;
        let activeRating = null;
        let indexing = true;
        let indexFailed = false;

        const stateKey = 'dpc-gallery-state-'+challengeId;

        function rememberGallery() {
            sessionStorage.setItem(stateKey,JSON.stringify({
                mode,activeRating,visibleLimit
            }));
        }

        function enqueuePages(doc,base) {
            for (const a of doc.querySelectorAll('a')) {
                if (!a.querySelector('img[src*="/images/page/"]')) continue;
                try {
                    const u = new URL(a.getAttribute('href'),base);
                    if (u.origin!==location.origin ||
                        u.pathname!=='/challenge_vote_list.php' ||
                        u.searchParams.get('CHALLENGE_ID')!==String(challengeId)) continue;
                    u.searchParams.delete('filter');
                    u.hash='';
                    if (!visitedPages.has(u.href) &&
                        !pageQueue.includes(u.href)) pageQueue.push(u.href);
                } catch {}
            }
        }

        async function buildIndex() {
            try {
                while (pageQueue.length) {
                    const url = pageQueue.shift();
                    if (visitedPages.has(url)) continue;
                    visitedPages.add(url);

                    const response = await fetch(url,{
                        credentials:'same-origin'
                    });
                    if (!response.ok) throw new Error('Page unavailable');

                    const doc = new DOMParser().parseFromString(
                        await response.text(),'text/html'
                    );

                    const found = doc.querySelectorAll('.dpc-vote-thumbnail-cell');

                    if (!found.length &&
                        !doc.querySelector('a[href*="challenge_vote_image.php"]')) {
                        throw new Error('Challenge page unavailable');
                    }

                    for (const cell of found) {
                        const link = cell.querySelector('a[href*="challenge_vote_image.php?IMAGE_ID="]');
                        const photo = cell.querySelector('.dpc-vote-thumbnail-image img');
                        if (!link || !photo) continue;

                        const href = new URL(link.getAttribute('href'),response.url).href;
                        const selected = cell.querySelector('a.vs');
                        const comment = cell.querySelector('img[src*="comment_"]');

                        entryMap.set(href,{
                            href,
                            source:new URL(photo.getAttribute('src'),response.url).href,
                            title:link.querySelector('b')?.textContent.trim()
                                || link.textContent.trim() || 'Photograph',
                            rating:Number(selected?.textContent.trim())||0,
                            commented:!!comment &&
                                !comment.getAttribute('src').includes('comment_none')
                        });
                    }

                    enqueuePages(doc,response.url);
                    entries.splice(0,entries.length,...entryMap.values());
                }
            } catch (error) {
                indexFailed=true;
                console.warn('DPC gallery index:',error);
            } finally {
                indexing=false;
                renderGroups();
                restoreGalleryScroll();
            }
        }

        function renderGroups() {
            const container=$('.dpc-list-groups');

            const filtered=entries.filter(e=>
                activeRating!==null ? e.rating===activeRating :
                mode==='unrated' ? e.rating===0 :
                mode==='comments' ? !e.commented : true
            );

            const ordered=[0,10,9,8,7,6,5,4,3,2,1]
                .flatMap(r=>filtered.filter(e=>e.rating===r));

            const shown=ordered.slice(0,visibleLimit);
            const wanted=new Set(shown.map(e=>e.href));

            for (const card of container.querySelectorAll('.dpc-thumb-card')) {
                if (!wanted.has(card.href)) card.remove();
            }

            container.querySelector('.dpc-empty')?.remove();

            for (const rating of [0,10,9,8,7,6,5,4,3,2,1]) {
                const group=shown.filter(e=>e.rating===rating);
                let section=container.querySelector('[data-group="'+rating+'"]');

                if (!group.length) {
                    section?.remove();
                    continue;
                }

                if (!section) {
                    section=document.createElement('section');
                    section.className='dpc-list-group';
                    section.dataset.group=rating;
                    section.innerHTML='<div class="dpc-group-heading"><span class="dpc-group-name"></span><span class="dpc-group-count"></span></div><div class="dpc-contact-sheet"></div>';
                }

                section.querySelector('.dpc-group-name').innerHTML=
                    rating?'Rated <em>'+rating+'</em>':'Unrated';

                const count=filtered.filter(e=>e.rating===rating).length;
                section.querySelector('.dpc-group-count').textContent=
                    count+(count===1?' photo':' photos');

                const sheet=section.querySelector('.dpc-contact-sheet');
                const existing=new Map([...sheet.children].map(c=>[c.href,c]));

                for (const entry of group) {
                    let card=existing.get(entry.href);
                    if (!card) {
                        card=document.createElement('a');
                        card.className='dpc-thumb-card';
                        card.href=entry.href;
                        card.innerHTML='<div class="dpc-thumb-stage"><img loading="lazy" decoding="async">'+
                            (entry.commented?'<span class="dpc-thumb-comment">'+commentIcon+'</span>':'')+
                            '</div><div class="dpc-thumb-title"></div>';
                        const img=card.querySelector('img');
                        img.src=entry.source;
                        img.alt=entry.title;
                        card.querySelector('.dpc-thumb-title').textContent=entry.title;

                        card.onclick=()=>{
                            rememberGallery();
                            sessionStorage.setItem('dpc-return-list-'+challengeId,listURL(challengeId));
                            sessionStorage.setItem('dpc-list-scroll-'+challengeId,String(scrollY));
                        };
                    }
                    sheet.append(card);
                }

                container.append(section);
            }

            if (!shown.length) {
                const empty=document.createElement('div');
                empty.className='dpc-empty';
                empty.textContent=indexing?'Finding photographs…':'No matching photographs.';
                container.append(empty);
            }

            sentinel.dataset.more=String(shown.length<ordered.length);
            sentinel.textContent=indexing?'Loading challenge…':
                indexFailed?'Some pages could not be loaded. Refresh to retry.':
                shown.length<ordered.length?'Loading more photographs…':'';
            sentinel.hidden=!sentinel.textContent;

            updateFilterButtons();
        }

        let mode = currentFilter === '-1' ? 'comments' : 'all';
        if (/^(10|[1-9])$/.test(currentFilter||'')) {
            activeRating=Number(currentFilter);
        }

        try {
            const saved=JSON.parse(sessionStorage.getItem(stateKey)||'null');
            if (saved && sessionStorage.getItem('dpc-list-scroll-'+challengeId)!==null) {
                mode=saved.mode||'all';
                activeRating=saved.activeRating??null;
                visibleLimit=Math.max(BATCH,Number(saved.visibleLimit)||BATCH);
            }
        } catch {}

        const sentinel=document.createElement('div');
        sentinel.className='dpc-infinite-sentinel';
        $('.dpc-pagination').replaceWith(sentinel);

        function updateFilterButtons() {
            for (const b of app.querySelectorAll('.dpc-filter')) {
                b.classList.toggle('active',
                    activeRating===null && b.dataset.filter===mode);
            }
            for (const b of app.querySelectorAll('.dpc-rating-filter')) {
                b.classList.toggle('active',
                    Number(b.dataset.rating)===activeRating);
            }
        }

        function changeFilter(nextMode,rating=null) {
            mode=nextMode;
            activeRating=rating;
            visibleLimit=BATCH;
            rememberGallery();
            renderGroups();
            const filters=$('.dpc-list-filters');
            if (filters.getBoundingClientRect().top<0) {
                filters.scrollIntoView({block:'start',behavior:'instant'});
            }
            if (!reducedMotion.matches) {
                $('.dpc-list-groups').animate(
                    [{opacity:.65},{opacity:1}],
                    {duration:150,easing:'ease-out'}
                );
            }
        }

        for (const b of app.querySelectorAll('.dpc-filter')) {
            b.onclick=()=>changeFilter(b.dataset.filter);
        }

        for (let i=1;i<=10;i++) {
            const b=document.createElement('button');
            b.type='button';
            b.className='dpc-rating-filter';
            b.dataset.rating=String(i);
            b.textContent=i;
            b.onclick=()=>changeFilter('all',activeRating===i?null:i);
            $('.dpc-rating-filters').append(b);
        }

        function restoreGalleryScroll() {
            const key='dpc-list-scroll-'+challengeId;
            const saved=sessionStorage.getItem(key);
            if (saved===null) return;
            sessionStorage.removeItem(key);
            requestAnimationFrame(()=>scrollTo(0,Number(saved)||0));
        }

        $('#dpc-original').onclick=()=>original();

        mount();
        renderGroups();

        const moreObserver=new IntersectionObserver(records=>{
            if (records.some(r=>r.isIntersecting) &&
                sentinel.dataset.more==='true' && !indexing) {
                visibleLimit+=BATCH;
                rememberGallery();
                renderGroups();
            }
        },{rootMargin:'400px 0px'});

        moreObserver.observe(sentinel);
        buildIndex();

    }

    if (isHome) { buildHome(); return; }
    if (isList) {
        buildList();
        return;
    }

    /* ==========================================
       INDIVIDUAL PHOTOGRAPH VOTING
       ========================================== */

    const cache = new Map();

    function read(doc,win,frame=null) {
        const photo = doc.querySelector('.dpc-vote-primary-image');
        const form = doc.forms.frmVote;

        if (!photo || !form) return null;

        const links = [...doc.querySelectorAll('a')];

        const ratings = links.filter(a =>
            a.matches('.v,.vs') &&
            /^(10|[1-9])$/.test(a.textContent.trim())
        );

        if (ratings.length !== 10) return null;

        const prev = links.find(a => a.textContent.trim()==='<<');
        const next = links.find(a => a.textContent.trim()==='>>');

        /* V3.2 — Extract metadata independently of visibility */
        function readableText(node) {
            const clone=node.cloneNode(true);

            clone.querySelectorAll('script,style,noscript')
                .forEach(n=>n.remove());

            clone.querySelectorAll('br').forEach(n=>
                n.replaceWith(doc.createTextNode('\n'))
            );

            clone.querySelectorAll('div,p,tr,td,th,h1,h2,h3,center')
                .forEach(n=>{
                    n.prepend(doc.createTextNode('\n'));
                    n.append(doc.createTextNode('\n'));
                });

            return clone.textContent
                .replace(/\u00a0/g,' ')
                .replace(/[ \t]+/g,' ')
                .replace(/ *\n */g,'\n')
                .replace(/\n+/g,'\n')
                .trim();
        }

        let title='',challenge='',challengeUrl='';

        let p=(doc.getElementById('img_container')||photo).parentElement;

        for (let i=0;p&&i<8;i++,p=p.parentElement) {
            const candidates=[
                p.innerText||'',
                readableText(p)
            ];

            for (const text of candidates) {
                const m=text.match(
                    /([^\n]+)\n\s*for\s+([^\n]+Challenge[^\n]*)/i
                );

                if (!m) continue;

                title=m[1].trim();
                challenge=m[2].trim();

                challengeUrl=[...p.querySelectorAll('a')]
                    .find(a=>
                        a.textContent.trim().length>4 &&
                        challenge.includes(a.textContent.trim()) &&
                        !/editing/i.test(a.textContent)
                    )?.href||'';

                break;
            }

            if (title) break;
        }

        /* V3.3 — Consistent challenge metadata */
        const challengeKey=String(form.elements.CHALLENGE_ID?.value||'');
        const metadataKey='dpc-challenge-meta-'+challengeKey;
        let savedMeta={};

        try {
            savedMeta=JSON.parse(sessionStorage.getItem(metadataKey)||'{}');
        } catch {}

        const fullText=readableText(doc.body);
        const editingMatch=fullText.match(
            /\b(Standard|Minimal|Advanced|Expert|Extended|Basic|No)\s+Editing\s+Challenge\b/i
        );

        const editionMatch=challenge.match(
            /^(.*?)\s+Challenge(?:\s+(.*))?$/i
        );

        let editionName=editingMatch
            ? editingMatch[1]+' Editing'
            : editionMatch?.[1]||'';

        let challengeName=editionMatch?.[2]?.trim()||'';

        const challengeLink=links.find(a=>{
            try {
                const u=new URL(a.getAttribute('href'),win.location.href);
                const label=a.textContent.trim();
                return u.searchParams.get('CHALLENGE_ID')===challengeKey &&
                    /challenge(?:_vote_list|_results)?\.php$/i.test(u.pathname) &&
                    label.length>0 &&
                    !/^(challenge|overview|results|vote|back|return|view|all|list)\b/i.test(label) &&
                    !/editing challenge/i.test(label) &&
                    !/^[\d\s<>]+$/.test(label);
            } catch {
                return false;
            }
        });

        if (!challengeName && challengeLink) {
            challengeName=challengeLink.textContent.trim();
        }

        if (/editing challenge/i.test(challengeName)) {
            challengeName='';
        }

        if (!editionName || /^challenge$/i.test(editionName)) {
            editionName=savedMeta.edition||'Challenge';
        }

        if (!challengeName) {
            challengeName=savedMeta.challenge||'';
        }

        if (challengeKey) {
            try {
                sessionStorage.setItem(metadataKey,JSON.stringify({
                    edition:editionName,
                    challenge:challengeName
                }));
            } catch {}
        }



        const pageStats=stats(
            doc.body.textContent.replace(/\s+/g,' ')
        );

        if (!pageStats.progress) {
            pageStats.progress=stats(readableText(doc.body)
                .replace(/\s+/g,' ')).progress;
        }

        return {
            doc,win,frame,form,
            id:new URL(win.location.href)
                .searchParams.get('IMAGE_ID'),
            index:Number(form.elements.INDEX?.value),
            challengeId:form.elements.CHALLENGE_ID?.value,
            source:photo.currentSrc||photo.src,
            title:title||photo.alt||'Challenge photograph',
            challenge:challengeName,
            edition:editionName,
            challengeUrl,
            ratings,
            selected:ratings.find(a=>a.classList.contains('vs'))
                ?.textContent.trim(),
            prev,next,
            prevId:prev?.getAttribute('onclick')
                ?.match(/NEXT_ID\.value\s*=\s*['"]?(\d+)/)?.[1],
            nextId:next?form.elements.NEXT_ID?.value:null,
            comment:doc.getElementById('COMMENT'),
            favourite:doc.getElementById('favorites'),
            report:links.find(a=>
                /suspect a rules violation/i.test(a.textContent)
            ),
            ...pageStats
        };
    }

    let current = read(document,window);
    if (!current) return;

    let mode = localStorage.getItem('dpc-mode') === 'comment'
        ? 'comment' : 'vote';

    let busy=false,dirty=false,generation=0;
    let previous=null,next=null;

    const initial = current;

    app.innerHTML = header+`
<div class="dpc-stage">
    <div class="dpc-track-gallery">
        ${Array.from({length:3},()=>`
            <div class="dpc-slide">
                <img draggable="false" alt="">
                <span class="dpc-slide-status"></span>
            </div>
        `).join('')}
    </div>

    <span class="dpc-gallery-status" hidden></span>

    <button class="dpc-stage-button dpc-overview"
            aria-label="Challenge overview">
        ${gridIcon}
    </button>

    <button class="dpc-stage-button dpc-expand"
            aria-label="Enlarge photograph">
        ${expandIcon}
    </button>
</div>

<div class="dpc-info">
    <div class="dpc-kicker">
        <span class="dpc-edition"></span>
        <span class="dpc-number"></span>
    </div>
    <h1 class="dpc-title"></h1>
    <a class="dpc-challenge"></a>
</div>

<section class="dpc-controls">
    <div class="dpc-tabs" role="tablist">
        <button class="dpc-tab" data-mode="vote" role="tab">Vote</button>
        <button class="dpc-tab" data-mode="comment" role="tab">Comment</button>
    </div>

    <div class="dpc-panel" id="vote-panel">
        <div class="dpc-rating-label">
            <span>YOUR RATING</span>
            <span class="dpc-current-score"></span>
        </div>

        <div class="dpc-grid">
            ${Array.from({length:10},(_,i)=>
                `<button class="dpc-score" data-score="${i+1}">
                    ${i+1}
                </button>`
            ).join('')}
        </div>

        <div class="dpc-rating-scale">
            <span>Poor</span>
            <span>Exceptional</span>
        </div>
    </div>

    <div class="dpc-panel" id="comment-panel">
        <div class="dpc-rating-label">
            <span>YOUR COMMENT</span>
            <span class="dpc-comment-score"></span>
        </div>
        <textarea id="dpc-comment-input"
                  placeholder="Share your thoughts…"></textarea>
        <div class="dpc-comment-hint">
            Saved when you move to another photograph
        </div>
    </div>

    <div class="dpc-navigation">
        <button class="dpc-nav-button" id="dpc-prev">
            <span>←</span> Previous
        </button>
        <span class="dpc-nav-hint">Swipe to browse</span>
        <button class="dpc-nav-button" id="dpc-next">
            Next <span>→</span>
        </button>
    </div>

    ${progressMarkup}

    <div class="dpc-actions">
        <button class="dpc-text-button" id="dpc-favourite"></button>
        <button class="dpc-text-button" id="dpc-report">
            ⚐ Report entry
        </button>
    </div>

    ${footer}
</section>`;

    const engine = document.createElement('div');
    engine.id = 'dpc-engine';
    engine.setAttribute('aria-hidden','true');

    document.body.append(engine);
    mount();

    const stage = $('.dpc-stage');
    const track = $('.dpc-track-gallery');
    const slides = [...track.children];
    const scores = [...app.querySelectorAll('.dpc-score')];
    const input = $('#dpc-comment-input');

    function status(s='') {
        $('.dpc-gallery-status').textContent = s;
        $('.dpc-gallery-status').hidden = !s;
    }

    function setBusy(v) {
        busy=v;
        scores.forEach(b=>b.disabled=v);
        $('#dpc-prev').disabled=v||!current.prev;
        $('#dpc-next').disabled=v||!current.next;
        input.disabled=v||!current.comment;
        $('#dpc-favourite').disabled=v;
        $('#dpc-report').disabled=v;
        $('.dpc-overview').disabled=v;
    }

    function tabs() {
        for (const b of app.querySelectorAll('.dpc-tab')) {
            b.classList.toggle('active',b.dataset.mode===mode);
            b.setAttribute(
                'aria-selected',
                String(b.dataset.mode===mode)
            );
        }

        $('#vote-panel').hidden=mode!=='vote';
        $('#comment-panel').hidden=mode!=='comment';
    }

    for (const b of app.querySelectorAll('.dpc-tab')) {
        b.onclick=()=>{
            mode=b.dataset.mode;
            localStorage.setItem('dpc-mode',mode);
            tabs();
        };
    }

    /* Staggered editorial typography */

    function typeset(direction=0,animate=true) { editorialTypeset($('.dpc-title'),current.title,direction,animate); }

    function slide(i,p,loading=false) {
        const img=slides[i].querySelector('img');

        if (p) {
            if (img.src!==p.source) img.src=p.source;
            img.alt=p.title;
        } else {
            img.removeAttribute('src');
            img.alt='';
        }

        slides[i].querySelector('span').textContent=
            !p&&loading?'Loading…':'';
    }

    function position(x=0,animate=false) {
        track.style.transition=animate&&!reducedMotion.matches
            ? 'transform 260ms cubic-bezier(.2,.75,.2,1)'
            : 'none';

        track.style.transform=
            `translate3d(calc(-33.333333% + ${x}px),0,0)`;
    }

    async function animateSlide(direction,page) {
        if (!direction || !page || reducedMotion.matches) return;

        slide(direction===1?2:0,page);

        await new Promise(resolve=>{
            let done=false;

            const end=()=>{
                if (done) return;
                done=true;
                track.removeEventListener('transitionend',end);
                resolve();
            };

            track.addEventListener('transitionend',end);
            position(-direction*stage.clientWidth,true);
            setTimeout(end,310);
        });
    }

    function preload(id,index) {
        if (!id||id==='0') return Promise.resolve(null);

        id=String(id);

        if (id===initial.id&&!initial.invalid) {
            return Promise.resolve(initial);
        }

        if (cache.has(id)) return cache.get(id).promise;

        const frame=document.createElement('iframe');
        frame.tabIndex=-1;

        let resolve,done=false;

        const promise=new Promise(r=>resolve=r);
        const record={frame,promise,page:null};

        cache.set(id,record);

        function finish(p) {
            if (done) return;
            done=true;

            clearTimeout(timer);
            frame.removeEventListener('load',load);

            if (p) {
                record.page=p;
            } else {
                if (cache.get(id)===record) cache.delete(id);
                frame.remove();
            }

            resolve(p);
        }

        async function load() {
            try {
                const p=read(
                    frame.contentDocument,
                    frame.contentWindow,
                    frame
                );

                if (
                    !p ||
                    p.id!==id ||
                    p.challengeId!==current.challengeId ||
                    (Number.isFinite(index)&&p.index!==index)
                ) {
                    return finish(null);
                }

                const img=new Image();
                img.src=p.source;

                await img.decode();
                finish(p);
            } catch {
                finish(null);
            }
        }

        const timer=setTimeout(()=>finish(null),10000);

        frame.addEventListener('load',load);
        frame.src=imageURL(id);
        engine.append(frame);

        return promise;
    }

    function prune() {
        const keep=new Set([
            current.id,current.prevId,
            current.nextId,next?.nextId
        ]);

        for (const [id,r] of cache) {
            if (r.page&&!keep.has(id)) {
                r.frame.remove();
                cache.delete(id);
            }
        }
    }

    function neighbours() {
        const token=++generation;
        const p=current;

        previous=null;
        next=null;

        slide(0,null,!!p.prevId);
        slide(2,null,!!p.nextId);

        Promise.all([
            preload(p.prevId,p.index-1).then(r=>{
                if (token===generation) {
                    previous=r;
                    slide(0,r);
                }
            }),

            preload(p.nextId,p.index+1).then(r=>{
                if (token===generation) {
                    next=r;
                    slide(2,r);

                    if (r?.nextId) {
                        preload(r.nextId,r.index+1).then(()=>{
                            if (token===generation) prune();
                        });
                    }
                }
            })
        ]).then(()=>{
            if (token===generation) prune();
        });
    }

    function favourite() {
        const checked=!!current.favourite?.checked;

        $('#dpc-favourite').hidden=!current.favourite;
        $('#dpc-favourite').classList.toggle('active',checked);

        $('#dpc-favourite').textContent=checked
            ? '♥ Added to favourites'
            : '♡ Add to favourites';
    }

    function update(direction=0) {
        $('.dpc-edition').textContent =
            current.challenge &&
            !/editing challenge/i.test(current.challenge)
                ? current.challenge : 'Challenge';

        $('.dpc-number').textContent=
            Number.isFinite(current.index)
                ? String(current.index+1).padStart(2,'0')+
                    (current.progress?' / '+current.progress[2]:'')
                : '';

        $('.dpc-challenge').textContent=current.challenge;

        typeset(direction);

        if (current.challengeId) {
            $('.dpc-challenge').href=listURL(current.challengeId);
        }

        $('.dpc-current-score').textContent=current.selected
            ? current.selected+' / 10'
            : 'Not yet rated';

        $('.dpc-comment-score').textContent=current.selected
            ? 'Rated '+current.selected+'/10'
            : 'Not yet rated';

        scores.forEach(b=>{
            const selected=b.dataset.score===current.selected;

            b.classList.remove('pressed');
            b.classList.toggle('selected',selected);
            b.setAttribute('aria-pressed',String(selected));
        });

        const c=current.comment?.value||'';

        input.value=/^Enter your comment here/i.test(c)?'':c;

        dirty=false;

        $('.dpc-comment-hint').textContent=current.comment
            ? 'Saved when you move to another photograph'
            : 'Comments unavailable';

        showStats(current);
        favourite();

        $('#dpc-report').hidden=!current.report;

        tabs();
        setBusy(false);
    }

    function sync(page=current) {
        if (dirty&&page.comment) {
            page.comment.value=input.value;

            page.comment.dispatchEvent(
                new page.win.Event('input',{bubbles:true})
            );

            page.comment.dispatchEvent(
                new page.win.Event('change',{bubbles:true})
            );
        }
    }

    input.oninput=()=>{
        dirty=true;
        sync();

        $('.dpc-comment-hint').textContent=
            'Unsaved · swipe or press Next to save';
    };

    function commit(p,direction=0) {
        current=p;
        position();
        slide(1,p);

        history.replaceState(
            history.state,'',imageURL(p.id)
        );

        update(direction);
        status();
        neighbours();
    }

    /* Native voting and comment submission */

    async function nativeAction(link,options={}) {
        if (!link||busy) return;

        const {
            direction=1,
            score=null,
            after=null
        }=options;

        const p=current;
        const linkIndex=p.ratings.indexOf(link);

        setBusy(true);
        status('Saving…');

        if (score!==null) {
            const pressed=scores.find(
                b=>b.dataset.score===String(score)
            );

            scores.forEach(b=>b.classList.remove('selected'));
            pressed?.classList.add('pressed');

            $('.dpc-current-score').textContent=
                'Saving '+score+' / 10';
        }

        const expectedPage=direction===1?next:previous;

        let actionPage=p;
        let actionLink=link;

        // Use a same-origin frame for the first photograph too,
        // so the visible page can remain in place during voting.

        if (!p.frame) {
            const frame=document.createElement('iframe');
            frame.tabIndex=-1;

            const loaded=await new Promise(resolve=>{
                let finished=false;

                function finish(value) {
                    if (finished) return;
                    finished=true;
                    clearTimeout(timer);
                    frame.removeEventListener('load',load);
                    resolve(value);
                }

                function load() {
                    try {
                        const q=read(
                            frame.contentDocument,
                            frame.contentWindow,
                            frame
                        );

                        finish(q&&q.id===p.id?q:null);
                    } catch {
                        finish(null);
                    }
                }

                const timer=setTimeout(()=>finish(null),10000);

                frame.addEventListener('load',load);
                frame.src=imageURL(p.id);
                engine.append(frame);
            });

            if (!loaded) {
                frame.remove();

                if (after) {
                    status('Could not save. Please try again.');
                    setBusy(false);
                    return;
                }

                sync(p);
                link.click();
                return;
            }

            actionPage=loaded;

            actionLink=linkIndex>=0
                ? loaded.ratings[linkIndex]
                : direction===-1?loaded.prev:loaded.next;
        }

        if (!actionLink) {
            status('Action unavailable');
            setBusy(false);
            return;
        }

        sync(actionPage);

        const frame=actionPage.frame;

        ++generation;

        let done=false;

        function cleanup() {
            clearTimeout(timer);
            frame.removeEventListener('load',load);
        }

        function fail() {
            if (done) return;
            done=true;
            cleanup();

            setBusy(false);
            scores.forEach(b=>b.classList.remove('pressed'));
            $('.dpc-current-score').textContent='Check saved rating';
            status('Save not confirmed. Refresh before retrying.');
        }

        async function load() {
            if (done) return;

            try {

                /* V3.5 — Handle final photograph submission */
                const responseDoc=frame.contentDocument;
                const responseURL=new URL(frame.contentWindow.location.href);

                if (
                    responseURL.pathname==='/challenge_vote_list.php' &&
                    responseURL.searchParams.get('CHALLENGE_ID')===
                        String(p.challengeId)
                ) {
                    const cell=[...responseDoc.querySelectorAll(
                        '.dpc-vote-thumbnail-cell'
                    )].find(cell=>
                        [...cell.querySelectorAll('a[href*="IMAGE_ID="]')]
                            .some(a=>{
                                try {
                                    return new URL(a.href)
                                        .searchParams.get('IMAGE_ID')===String(p.id);
                                } catch {
                                    return false;
                                }
                            })
                    );

                    const savedScore=cell?.querySelector('a.vs')
                        ?.textContent.trim();

                    if (score!==null && savedScore!==String(score)) {
                        done=true;
                        cleanup();
                        setBusy(false);
                        scores.forEach(b=>b.classList.remove('pressed'));
                        $('.dpc-current-score').textContent='Check saved rating';
                        status('Check your saved vote in the overview.');
                        return;
                    }

                    done=true;
                    cleanup();
                    dirty=false;

                    if (after) {
                        after();
                    } else {
                        location.href=listURL(p.challengeId);
                    }
                    return;
                }

                const updated=read(
                    frame.contentDocument,
                    frame.contentWindow,
                    frame
                );

                if (
                    !updated ||
                    updated.challengeId!==p.challengeId
                ) return fail();

                done=true;
                cleanup();

                if (score!==null) await sleep(180);

                const actualDirection=updated.id===p.id
                    ? 0
                    : updated.index>p.index?1:-1;

                if (actualDirection) {
                    await animateSlide(
                        actualDirection,
                        expectedPage?.id===updated.id
                            ? expectedPage
                            : updated
                    );
                }

                for (const r of cache.values()) {
                    if (r.frame!==frame) r.frame.remove();
                }

                cache.clear();
                initial.invalid=true;

                cache.set(updated.id,{
                    frame,
                    page:updated,
                    promise:Promise.resolve(updated)
                });

                commit(updated,actualDirection);

                if (after) after();

            } catch {
                setBusy(false);
                scores.forEach(b=>b.classList.remove('pressed'));
                $('.dpc-current-score').textContent='Check saved rating';
                status('Could not confirm save. Refresh to check.');
            }
        }

        const timer=setTimeout(fail,15000);

        frame.addEventListener('load',load);

        try {
            actionLink.click();
        } catch {
            fail();
        }
    }

    async function navigate(d) {
        if (busy) return;

        const link=d===1?current.next:current.prev;

        if (!link) {
            position(0,true);
            return;
        }

        if (dirty) {
            input.blur();
            position(0,true);
            nativeAction(link,{direction:d});
            return;
        }

        let p=d===1?next:previous;

        if (!p) {
            position(0,true);
            status('Loading photograph…');
            setBusy(true);

            p=await preload(
                d===1?current.nextId:current.prevId,
                current.index+d
            );

            setBusy(false);

            if (!p) {
                nativeAction(link,{direction:d});
                return;
            }
        }

        setBusy(true);
        await animateSlide(d,p);
        commit(p,d);
    }

    $('#dpc-prev').onclick=()=>navigate(-1);
    $('#dpc-next').onclick=()=>navigate(1);

    scores.forEach(b=>{
        b.onclick=()=>{
            const link=current.ratings.find(a=>
                a.textContent.trim()===b.dataset.score
            );

            nativeAction(link,{
                direction:1,
                score:Number(b.dataset.score)
            });
        };
    });

    $('#dpc-favourite').onclick=()=>{
        if (!busy) {
            current.favourite?.click();
            favourite();
        }
    };

    $('#dpc-report').onclick=()=>{
        if (!busy) current.report?.click();
    };

    /* Return to the contact sheet */

    $('.dpc-overview').onclick=e=>{
        e.stopPropagation();

        if (busy||!current.challengeId) return;

        const go=()=>{
            const saved=sessionStorage.getItem(
                'dpc-return-list-'+current.challengeId
            );

            let destination=listURL(current.challengeId);

            if (saved) {
                try {
                    const u=new URL(saved);

                    if (
                        u.origin===location.origin &&
                        u.pathname==='/challenge_vote_list.php' &&
                        u.searchParams.get('CHALLENGE_ID')===
                            String(current.challengeId)
                    ) destination=u.href;
                } catch {}
            }

            location.href=destination;
        };

        if (dirty) {
            if (current.next) {
                nativeAction(current.next,{
                    direction:1,
                    after:go
                });
            } else if (current.prev) {
                nativeAction(current.prev,{
                    direction:-1,
                    after:go
                });
            } else if (confirm('Leave with an unsaved comment?')) {
                go();
            }
        } else {
            go();
        }
    };

    /* Finger-tracked photograph carousel */

    let drag=null,suppress=0;

    stage.onpointerdown=e=>{
        if (
            busy ||
            !e.isPrimary ||
            e.button!==0 ||
            e.target.closest('button')
        ) return;

        drag={
            id:e.pointerId,
            x:e.clientX,
            y:e.clientY,
            lastX:e.clientX,
            t:performance.now(),
            v:0,
            axis:null
        };

        stage.setPointerCapture(e.pointerId);
        track.style.transition='none';
    };

    stage.onpointermove=e=>{
        if (!drag||drag.id!==e.pointerId) return;

        const dx=e.clientX-drag.x;
        const dy=e.clientY-drag.y;

        if (
            !drag.axis &&
            Math.max(Math.abs(dx),Math.abs(dy))>5
        ) {
            drag.axis=Math.abs(dx)>Math.abs(dy)*1.15
                ? 'x':'y';
        }

        if (drag.axis!=='x') return;

        const t=performance.now();

        drag.v=.35*drag.v+
            .65*(e.clientX-drag.lastX)/
            Math.max(1,t-drag.t);

        drag.lastX=e.clientX;
        drag.t=t;

        position(
            (dx<0?next:previous)
                ? clamp(dx,-stage.clientWidth,stage.clientWidth)
                : dx*.18
        );
    };

    stage.onpointerup=e=>{
        if (!drag||drag.id!==e.pointerId) return;

        const dx=e.clientX-drag.x;
        const dy=e.clientY-drag.y;

        const v=performance.now()-drag.t<100
            ? drag.v:0;

        const advance=drag.axis==='x'&&(
            Math.abs(dx)>stage.clientWidth*.19 ||
            (
                Math.abs(dx)>18 &&
                Math.abs(v)>.35 &&
                Math.sign(dx)===Math.sign(v)
            )
        );

        drag=null;

        if (Math.abs(dx)>7||Math.abs(dy)>7) {
            suppress=Date.now()+400;
        }

        if (advance) navigate(dx<0?1:-1);
        else position(0,true);
    };

    function cancel() {
        if (drag) {
            drag=null;
            suppress=Date.now()+400;
            position(0,true);
        }
    }

    stage.onpointercancel=cancel;
    stage.onlostpointercapture=cancel;

    /* Full-screen pinch and drag viewer */

    const viewer=document.createElement('div');

    viewer.id='dpc-viewer';
    viewer.hidden=true;

    viewer.innerHTML=`
<div class="dpc-viewer-stage">
    <img draggable="false" alt="">
</div>
<div class="dpc-viewer-bar">
    <span class="dpc-zoom-label">100%</span>
    <button class="dpc-viewer-close" aria-label="Close">×</button>
</div>
<div class="dpc-viewer-hint">
    Pinch to zoom · Double tap to enlarge
</div>`;

    document.body.append(viewer);

    const vs=viewer.querySelector('.dpc-viewer-stage');
    const vi=vs.querySelector('img');
    const points=new Map();

    let scale=1,x=0,y=0;
    let gesture=null,tap=null,lastTap=0,scroll=0;

    function render() {
        const mx=Math.max(
            0,(vi.offsetWidth*scale-vs.clientWidth)/2
        );

        const my=Math.max(
            0,(vi.offsetHeight*scale-vs.clientHeight)/2
        );

        x=clamp(x,-mx,mx);
        y=clamp(y,-my,my);

        vi.style.transform=
            `translate3d(${x}px,${y}px,0) scale(${scale})`;

        viewer.querySelector('.dpc-zoom-label').textContent=
            Math.round(scale*100)+'%';
    }

    function zoom(s,px,py) {
        s=clamp(s,1,6);

        const r=vs.getBoundingClientRect();
        const cx=px-r.left-r.width/2;
        const cy=py-r.top-r.height/2;

        x=cx-(cx-x)*s/scale;
        y=cy-(cy-y)*s/scale;

        scale=s;

        if (s===1) x=y=0;

        render();
    }

    function open() {
        if (busy||!viewer.hidden) return;

        scroll=scrollY;
        scale=1;
        x=y=0;

        vi.src=current.source;
        vi.alt=current.title;

        viewer.hidden=false;
        app.inert=true;

        root.classList.add('dpc-viewing');

        history.pushState(
            {dpcViewer:true},'',location.href
        );

        requestAnimationFrame(render);
    }

    function hide() {
        viewer.hidden=true;
        app.inert=false;

        root.classList.remove('dpc-viewing');

        points.clear();
        gesture=tap=null;
        lastTap=0;

        scrollTo(0,scroll);
    }

    function close() {
        if (viewer.hidden) return;

        hide();

        if (history.state?.dpcViewer) history.back();
    }

    stage.onclick=e=>{
        if (e.target.closest('button')) return;
        if (Date.now()>=suppress) open();
    };

    $('.dpc-expand').onclick=e=>{
        e.stopPropagation();
        open();
    };

    viewer.querySelector('button').onclick=close;

    addEventListener('popstate',()=>{
        if (!viewer.hidden) hide();
    });

    addEventListener('keydown',e=>{
        if (e.key==='Escape') close();
    });

    const pt=e=>({x:e.clientX,y:e.clientY});

    const dist=(a,b)=>
        Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));

    const mid=(a,b)=>({
        x:(a.x+b.x)/2,
        y:(a.y+b.y)/2
    });

    vs.onpointerdown=e=>{
        e.preventDefault();

        vs.setPointerCapture(e.pointerId);
        points.set(e.pointerId,pt(e));

        if (points.size===1) {
            tap={...pt(e),t:Date.now()};
        } else {
            tap=null;
            lastTap=0;

            if (points.size===2) {
                const [a,b]=[...points.values()];

                gesture={
                    d:dist(a,b),
                    c:mid(a,b)
                };
            }
        }
    };

    vs.onpointermove=e=>{
        if (!points.has(e.pointerId)) return;

        const old=points.get(e.pointerId);
        const p=pt(e);

        points.set(e.pointerId,p);

        if (points.size===2&&gesture) {
            const [a,b]=[...points.values()];
            const d=dist(a,b);
            const c=mid(a,b);

            zoom(
                scale*d/gesture.d,
                gesture.c.x,
                gesture.c.y
            );

            x+=c.x-gesture.c.x;
            y+=c.y-gesture.c.y;

            gesture={d,c};

            render();
        } else if (points.size===1) {
            if (tap&&dist(tap,p)>10) tap=null;

            if (scale>1) {
                x+=p.x-old.x;
                y+=p.y-old.y;
                render();
            }
        }
    };

    function end(e) {
        const single=points.size===1;

        points.delete(e.pointerId);

        if (points.size<2) gesture=null;

        if (
            e.type!=='pointercancel' &&
            single &&
            tap &&
            Date.now()-tap.t<250
        ) {
            const now=Date.now();

            if (now-lastTap<320) {
                zoom(
                    scale>1?1:2.5,
                    e.clientX,e.clientY
                );

                lastTap=0;
            } else {
                lastTap=now;
            }
        }

        tap=null;
    }

    vs.onpointerup=end;
    vs.onpointercancel=end;

    vs.addEventListener('wheel',e=>{
        e.preventDefault();

        zoom(
            scale*Math.exp(-e.deltaY*.002),
            e.clientX,e.clientY
        );
    },{passive:false});

    vi.onload=render;

    $('#dpc-original').onclick=()=>{
        if (
            dirty &&
            !confirm('Leave with an unsaved comment?')
        ) return;

        original(imageURL(current.id));
    };


    /* Only refit when the available width actually changes.
       Opening the keyboard must not shrink the title. */
    let lastTitleWidth=$('.dpc-title').clientWidth;
    let titleResizeFrame=0;

    addEventListener('resize',()=>{
        if (!busy&&!drag) position();
        if (!viewer.hidden) render();

        cancelAnimationFrame(titleResizeFrame);
        titleResizeFrame=requestAnimationFrame(()=>{
            const width=$('.dpc-title').clientWidth;

            if (width>0 && Math.abs(width-lastTitleWidth)>1) {
                lastTitleWidth=width;
                typeset(0,false);
            }
        });
    });


    document.fonts?.ready.then(()=>{
        typeset(0,false);
    });

    position();
    slide(1,current);
    update();
    neighbours();
    scrollTo(0,0);
}

/* V3.1 — Reliable photograph metadata */
if (isList || isHome) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded',boot,{once:true});
    } else {
        boot();
    }
} else {
    if (document.readyState === 'complete') {
        boot();
    } else {
        window.addEventListener('load',boot,{once:true});
    }
}

})();


// ==UserScript==
// @name DPChallenge Mobile — Editorial Gallery
// @namespace dpc-mobile
// @version 5.44
// @updateURL https://raw.githubusercontent.com/Konador/dpc-mobile-restyle/main/dpc-mobile.user.js
// @downloadURL https://raw.githubusercontent.com/Konador/dpc-mobile-restyle/main/dpc-mobile.user.js
// @match *://*.dpchallenge.com/challenge_vote_image.php*
// @match *://*.dpchallenge.com/challenge_vote_list.php*
// @match *://*.dpchallenge.com/
// @match *://*.dpchallenge.com/index.php*
// @match *://*.dpchallenge.com/image.php*
// @match *://*.dpchallenge.com/profile.php*
// @match *://*.dpchallenge.com/challenge_results.php*
// @match *://*.dpchallenge.com/challenge_index.php*
// @match *://*.dpchallenge.com/challenge_submit.php*
// @match *://*.dpchallenge.com/challenge_submit_preview.php*
// @match *://*.dpchallenge.com/forum.php*
// @match *://*.dpchallenge.com/community_index.php*
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
    ';} html:not(.dpc-mobile) body{opacity:0!important;visibility:hidden!important;}';

if (bootRoot) bootRoot.append(bootStyle);
else {
    const earlyBootObserver=new MutationObserver(()=>{
        if(document.documentElement){document.documentElement.append(bootStyle);earlyBootObserver.disconnect();}
    });
    earlyBootObserver.observe(document,{childList:true});
}

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


/* Shared, conservative background request budget. Native navigation and vote writes remain independent. */
const dpcCooldownKey='dpc-background-cooldown-v1',dpcStartKey='dpc-background-last-start-v1';
const dpcImageKey='dpc-shared-image-urls-v1';
const backgroundJobs=[];
let backgroundRunning=false,backgroundTimer=null,backgroundController=null,localCooldown=0;
function storageNumber(key){try{return Number(localStorage.getItem(key))||0;}catch{return 0;}}
function backgroundBlocked(){return Math.max(localCooldown,storageNumber(dpcCooldownKey))>Date.now();}
function stopBackground(response){
    let until=Date.now()+5*60*1000;
    const retry=response?.headers?.get('Retry-After');
    if(retry){const seconds=Number(retry);const parsed=Number.isFinite(seconds)?Date.now()+seconds*1000:Date.parse(retry);if(Number.isFinite(parsed))until=Math.max(until,parsed);}
    localCooldown=until;try{localStorage.setItem(dpcCooldownKey,String(until));}catch{}
    while(backgroundJobs.length)backgroundJobs.shift().reject(new Error('Background requests paused'));
}
function pumpBackground(){
    if(backgroundTimer!==null){clearTimeout(backgroundTimer);backgroundTimer=null;}
    if(backgroundRunning||!backgroundJobs.length||document.hidden)return;
    if(backgroundBlocked()){while(backgroundJobs.length)backgroundJobs.shift().reject(new Error('Background requests paused'));return;}
    const wait=Math.max(0,800-(Date.now()-storageNumber(dpcStartKey)));
    if(wait){backgroundTimer=setTimeout(pumpBackground,wait);return;}
    const job=backgroundJobs.shift();backgroundRunning=true;
    const controller=new AbortController();backgroundController=controller;
    const run=async()=>{
        if(document.hidden||backgroundBlocked())throw new Error('Background requests paused');
        try{localStorage.setItem(dpcStartKey,String(Date.now()));}catch{}
        const timer=setTimeout(()=>controller.abort(),15000);
        try{
            const response=await fetch(job.url,{...job.options,signal:controller.signal});
            if([429,502,503,504].includes(response.status)){stopBackground(response);throw new Error('Server busy: '+response.status);}
            // Hold the slot until the complete response has arrived.
            const content=await response.text();
            return {ok:response.ok,status:response.status,url:response.url,text:async()=>content};
        }finally{clearTimeout(timer);}
    };
    // Where available, coordinate the same queue across tabs using an origin-wide lock.
    const work=navigator.locks?.request?navigator.locks.request('dpc-background-fetch-v1',async()=>{
        const remaining=Math.max(0,800-(Date.now()-storageNumber(dpcStartKey)));
        if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));
        return run();
    }):run();
    Promise.resolve(work).then(job.resolve,job.reject).finally(()=>{backgroundRunning=false;backgroundController=null;pumpBackground();});
}
// Small interactive prefetch lane, separate from bulk thumbnail pagination.
const interactiveJobs=[];let interactiveActive=0;
function pumpInteractive(){
    if(document.hidden)return;
    if(backgroundBlocked()){while(interactiveJobs.length)interactiveJobs.shift().reject(new Error('Background requests paused'));return;}
    while(interactiveActive<3&&interactiveJobs.length){
        const job=interactiveJobs.shift();interactiveActive++;
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
        fetch(job.url,{...job.options,signal:controller.signal}).then(async response=>{
            if([429,502,503,504].includes(response.status)){stopBackground(response);throw Error('Server busy');}
            const content=await response.text();return {ok:response.ok,status:response.status,url:response.url,text:async()=>content};
        }).then(job.resolve,job.reject).finally(()=>{clearTimeout(timer);interactiveActive--;pumpInteractive();});
    }
}
function interactiveFetch(url,options={},priority=false){
    if(backgroundBlocked())return Promise.reject(Error('Background requests paused'));
    return new Promise((resolve,reject)=>{interactiveJobs[priority?'unshift':'push']({url,options,resolve,reject});pumpInteractive();});
}
document.addEventListener('visibilitychange',pumpInteractive);
addEventListener('pagehide',()=>{while(interactiveJobs.length)interactiveJobs.shift().reject(Error('Page left'));});
function backgroundFetch(url,options={}){
    if(backgroundBlocked())return Promise.reject(new Error('Background requests paused'));
    return new Promise((resolve,reject)=>{backgroundJobs.push({url,options,resolve,reject});pumpBackground();});
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pumpBackground();});
addEventListener('pagehide',()=>{backgroundController?.abort();while(backgroundJobs.length)backgroundJobs.shift().reject(new Error('Page left'));});
addEventListener('pageshow',()=>pumpBackground());
function photoFilename(src,base=location.href){try{return new URL(src,base).pathname.split('/').pop();}catch{return '';}}
function photoCacheId(href){try{const u=new URL(href,location.href);return u.pathname==='/image.php'?u.searchParams.get('IMAGE_ID'):null;}catch{return null;}}
function sharedPhotoRead(href,thumb){
    const id=photoCacheId(href);if(!id)return null;
    try{const hit=JSON.parse(localStorage.getItem(dpcImageKey)||'{}')[id];if(hit&&Date.now()-hit.time<30*86400000&&/^https?:\/\//i.test(hit.full)&&(!thumb||photoFilename(hit.full)===photoFilename(thumb)))return hit;}catch{}
    return null;
}
function sharedPhotoWrite(href,full,width,height){
    const id=photoCacheId(href);if(!id||!full||!width||!height)return;
    try{
        const url=new URL(full,href);if(!/^https?:$/.test(url.protocol)||!photoFilename(url.href).includes('_'+id+'.'))return;
        const cache=JSON.parse(localStorage.getItem(dpcImageKey)||'{}')||{};
        if(cache[id]?.area>width*height&&Date.now()-cache[id].time<30*86400000)return;
        cache[id]={full:url.href,area:width*height,ratio:height/width,time:Date.now()};
        localStorage.setItem(dpcImageKey,JSON.stringify(Object.fromEntries(Object.entries(cache).sort((a,b)=>b[1].time-a[1].time).slice(0,500))));
    }catch{}
}

let root = document.documentElement;
const isForum = /\/(?:forum|community_index)\.php$/i.test(location.pathname);
const isHome = location.pathname === '/' || location.pathname === '/index.php';
const isPhotoDetail = location.pathname === '/image.php';
const isProfile = location.pathname === '/profile.php';
const isSubmit = location.pathname === '/challenge_submit.php';
const isPreview = location.pathname === '/challenge_submit_preview.php';
const isChallengeIndex = location.pathname === '/challenge_index.php';
const isResults = location.pathname === '/challenge_results.php';
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
    root = document.documentElement;
    viewport();
    observer.disconnect();

    const style = document.createElement('style');
    style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,500;1,6..96,500;1,6..96,700&display=swap');

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
    style.textContent += "#dpc-app .dpc-home-vote-card{padding:13px 12px;text-align:left;min-height:160px}#dpc-app .dpc-home-vote-card h3{font-size:23px;line-height:1.08;margin:0 0 8px}#dpc-app .dpc-home-vote-card .dpc-home-meta{font-size:13px;line-height:1.45;font-weight:400;max-width:72%;margin:0 0 10px}#dpc-app .dpc-home-vote-card .dpc-home-detail{font-size:11px;gap:5px 8px;justify-content:flex-start}#dpc-app .dpc-home-vote-card .dpc-entry-rules{font-size:9px;text-transform:uppercase;letter-spacing:.055em}#dpc-app .dpc-home-vote-card .dpc-entry-deadline{font-size:12px;color:var(--accent);font-weight:500}#dpc-app .dpc-home-vote-card .dpc-home-vote-status{font-size:13px;margin:8px 0}#dpc-app .dpc-home-vote-card .dpc-home-action{font-size:11px;padding:7px 10px;margin-top:8px;align-self:flex-start}#dpc-app .dpc-home-vote-card:before{opacity:1;background-image:linear-gradient(90deg,#111115fa 0%,#111115e8 35%,#111115a0 65%,#11111530 100%),var(--vote-image,none)}html.dpc-light #dpc-app .dpc-home-vote-card:before{background-image:linear-gradient(90deg,#f5f6f8fa 0%,#f5f6f8e8 35%,#f5f6f8a0 65%,#f5f6f830 100%),var(--vote-image,none)}";
    style.textContent += "#dpc-app .dpc-home section{margin-bottom:38px}#dpc-app .dpc-home section>h2{position:relative;padding:2px 0 12px 12px;margin:0 0 14px;border-bottom:1px solid var(--line);font-size:30px;letter-spacing:-.035em}#dpc-app .dpc-home section>h2:before{content:'';position:absolute;left:0;top:6px;width:3px;height:26px;border-radius:0;background:var(--accent)}#dpc-app .dpc-home section>h2 em{color:inherit;font-style:italic}";
    style.textContent += "#dpc-app .dpc-entry-grid h3,#dpc-app .dpc-home-vote-card h3,#dpc-app .dpc-home-vote-card h3 a{color:inherit}#dpc-app .dpc-home-vote-card .dpc-home-vote-status{color:inherit;font-weight:500}";
    style.textContent += "#dpc-app .dpc-entry-grid h3,#dpc-app .dpc-home-vote-card h3,#dpc-app .dpc-home-vote-card h3 a{color:var(--accent)}#dpc-app .dpc-home-vote-card .dpc-home-detail{display:grid;grid-template-columns:96px minmax(0,1fr);column-gap:8px;align-items:baseline}#dpc-app .dpc-home-vote-card .dpc-entry-deadline{grid-column:2}#dpc-app .dpc-home-vote-card .dpc-entry-rules{grid-column:1}#dpc-app .dpc-home-vote-card .dpc-home-vote-status{font-size:13px;font-weight:500;color:var(--muted)}#dpc-app .dpc-home-vote-card .dpc-home-meta{font-size:13px!important;line-height:1.4!important}#dpc-app .dpc-home-vote-card:before{background-image:linear-gradient(90deg,#111115fa 0%,#111115ed 40%,#111115b0 70%,#11111545 100%),var(--vote-image,none)}html.dpc-light #dpc-app .dpc-home-vote-card:before{background-image:linear-gradient(90deg,#f5f6f8fa 0%,#f5f6f8ed 40%,#f5f6f8b0 70%,#f5f6f845 100%),var(--vote-image,none)}";
    style.textContent += "html.dpc-comment-keyboard #dpc-app{padding:0!important}html.dpc-comment-keyboard #dpc-app .dpc-header,html.dpc-comment-keyboard #dpc-app .dpc-info,html.dpc-comment-keyboard #dpc-app .dpc-tabs,html.dpc-comment-keyboard #dpc-app .dpc-controls>:not(#comment-panel),html.dpc-comment-keyboard #dpc-app .dpc-footer,html.dpc-comment-keyboard #dpc-app .dpc-stage-button{display:none!important}html.dpc-comment-keyboard #dpc-app .dpc-stage{height:var(--dpc-keyboard-photo,180px)!important;min-height:0!important}html.dpc-comment-keyboard #dpc-app .dpc-controls{padding:0 12px!important;margin:0!important}html.dpc-comment-keyboard #comment-panel{padding:8px 0!important;margin:0!important}html.dpc-comment-keyboard #dpc-comment-input{height:80px!important;min-height:56px!important;margin:4px 0!important}html.dpc-comment-keyboard #dpc-app .dpc-slide{padding:5px!important}";
    style.textContent += "#dpc-app #dpc-submit-comment{display:block;width:100%;min-height:36px;margin:8px 0 0;border:1px solid var(--accent);border-radius:6px;background:var(--accent);color:#111115;font-size:13px;font-weight:600}html.dpc-light #dpc-app #dpc-submit-comment{color:white}html.dpc-comment-keyboard #dpc-app #dpc-submit-comment{margin-top:5px;min-height:34px}";
    style.textContent += "#dpc-app #comment-panel{height:auto!important;min-height:138px;padding-bottom:12px}#dpc-app #dpc-submit-comment{min-height:36px;margin:8px 0 0;background:transparent;color:var(--accent);border:1px solid var(--accent);font-weight:500}#dpc-app #dpc-submit-comment:disabled{opacity:.45;background:transparent;color:var(--muted);border-color:var(--line)}html.dpc-light #dpc-app #dpc-submit-comment{color:var(--accent)}#dpc-app .dpc-comment-hint:empty{display:none}html.dpc-comment-keyboard #dpc-app #comment-panel{min-height:0!important;padding-bottom:8px!important}#dpc-app #dpc-comment-input:focus{outline:none;box-shadow:none;border-color:var(--accent)}";
    style.textContent += "#dpc-app #dpc-submit-comment{background:var(--accent);color:#111115;border:1px solid var(--accent);font-weight:600}html.dpc-light #dpc-app #dpc-submit-comment{color:#fff}#dpc-app #dpc-submit-comment:disabled,html.dpc-light #dpc-app #dpc-submit-comment:disabled{opacity:1;background:#24242c;color:#777580;border:1px solid #393842;cursor:default}html.dpc-light #dpc-app #dpc-submit-comment:disabled{background:#e4e5e9;color:#85858d;border-color:#d1d2d8}";
    style.textContent += "#dpc-app .dpc-thumb-comment{position:static;display:inline-flex;align-items:center;gap:4px;background:none;padding:0;margin-top:5px;color:var(--accent);font:10px/1.3 system-ui,sans-serif;letter-spacing:.01em}#dpc-app .dpc-thumb-comment svg{width:13px;height:13px;flex-shrink:0}html.dpc-light #dpc-app .dpc-thumb-comment{color:var(--accent)}";
    style.textContent += "#dpc-app .dpc-native-menu-group>summary{cursor:pointer;padding:12px 0;border-bottom:1px solid var(--line);font-weight:600;color:var(--accent)}#dpc-app .dpc-native-menu-children{padding-left:16px}#dpc-app .dpc-native-menu-children a{font-size:13px}#dpc-app .dpc-home-menu[hidden]{display:none!important}";
    style.textContent += "#dpc-app .dpc-home-menu a.dpc-restyled-link{display:flex;align-items:center;justify-content:space-between;gap:10px}#dpc-app .dpc-restyle-mark{display:inline-flex;align-items:center;gap:2px;color:var(--muted);opacity:.65;flex:none;height:13px}#dpc-app .dpc-restyle-mark svg{width:13px;height:13px;flex:none}#dpc-app .dpc-restyle-mark i{font:italic 500 17px/1 var(--serif);font-optical-sizing:none;font-variation-settings:'opsz' 12,'wght' 500;letter-spacing:-.6px;-webkit-text-stroke:0;position:relative;top:-2px;padding-right:1px}";
    style.textContent += "#dpc-app .dpc-brand .dpc-brand-word{color:inherit;margin:0;white-space:nowrap}#dpc-app .dpc-brand-word em{font-family:var(--serif);font-weight:500;font-size:1em;font-style:italic;color:var(--accent);letter-spacing:-.8px;margin-left:1px}html.dpc-comment-keyboard #dpc-app .dpc-home-menu{display:none!important}";
    style.textContent += "#dpc-app .dpc-header{position:relative;z-index:1002;background:#111115}html.dpc-light #dpc-app .dpc-header{background:#f5f6f8}html.dpc-menu-open #dpc-app .dpc-header{position:fixed;top:0;left:0;right:0}html.dpc-menu-open #dpc-app{padding-top:54px!important}html.dpc-menu-open,html.dpc-menu-open body{overflow:hidden!important}#dpc-app .dpc-home-menu-button{border:0;padding:0;width:36px;height:36px;display:grid;place-items:center;color:inherit}#dpc-app .dpc-menu-backdrop{position:fixed;inset:0;z-index:1000;background:#0009;opacity:0;visibility:hidden;transition:opacity .28s,visibility .28s}#dpc-app .dpc-home-menu{position:fixed;z-index:1001;top:54px;right:0;bottom:0;width:min(88vw,420px);padding:24px 26px 36px;background:#19191e;box-shadow:-12px 0 40px #0003;border:0;overflow-y:auto;overscroll-behavior:contain;transform:translateX(105%);visibility:hidden;transition:transform .32s cubic-bezier(.22,.75,.25,1),visibility .32s}html.dpc-light #dpc-app .dpc-home-menu{background:#f5f6f8}html.dpc-menu-open #dpc-app .dpc-home-menu{transform:translateX(0);visibility:visible}html.dpc-menu-open #dpc-app .dpc-menu-backdrop{opacity:1;visibility:visible}#dpc-app .dpc-home-menu .dpc-home-welcome{font:12px/1.5 system-ui,sans-serif;color:var(--muted);margin:0 0 22px;padding:0}#dpc-app .dpc-home-menu>details>summary,#dpc-app .dpc-home-menu>a{font:500 25px/1.2 var(--serif);color:inherit;border:0;padding:8px 0;letter-spacing:-.5px}#dpc-app .dpc-native-menu-group>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px}#dpc-app .dpc-native-menu-group>summary::-webkit-details-marker{display:none}#dpc-app .dpc-native-menu-group>summary:after{content:'';width:7px;height:7px;border-right:1px solid var(--muted);border-bottom:1px solid var(--muted);transform:rotate(-45deg);margin-right:4px;transition:transform .2s}#dpc-app .dpc-native-menu-group[open]>summary:after{transform:rotate(45deg)}#dpc-app .dpc-native-menu-group[open]>summary{color:var(--accent)}#dpc-app .dpc-native-menu-children{padding:3px 0 10px 13px}#dpc-app .dpc-native-menu-children a,#dpc-app .dpc-native-menu-children summary{font:400 14px/1.4 system-ui,sans-serif;color:inherit;border:0;padding:7px 0}#dpc-app .dpc-home-menu>a:not(.dpc-restyled-link){font:400 13px/1.5 system-ui,sans-serif;color:var(--muted);padding:9px 0}#dpc-app .dpc-home-menu>details+a{margin-top:20px}html.dpc-comment-keyboard #dpc-app .dpc-menu-backdrop{display:none!important}@media(prefers-reduced-motion:reduce){#dpc-app .dpc-home-menu,#dpc-app .dpc-menu-backdrop{transition:none}}";
    style.textContent += "#dpc-app .dpc-native-menu-group>summary.dpc-split-summary{position:relative;padding:0;gap:0;min-height:44px}#dpc-app .dpc-split-summary>a.dpc-parent-link{font:inherit;letter-spacing:inherit;color:inherit;flex:1;min-width:0;padding:8px 0;border:0;display:flex;align-items:center;justify-content:space-between;gap:8px;align-self:stretch}#dpc-app .dpc-split-summary>.dpc-expand-hit{width:48px;min-height:44px;flex:none;align-self:stretch}#dpc-app .dpc-split-summary:after{position:absolute;right:15px;top:50%;margin:0;pointer-events:none;transform:translateY(-50%) rotate(-45deg)}#dpc-app .dpc-native-menu-group[open]>summary.dpc-split-summary:after{transform:translateY(-50%) rotate(45deg)}#dpc-app .dpc-split-summary .dpc-restyle-mark{margin-right:2px}";
    style.textContent += "#dpc-app .dpc-native-menu-children>details>summary,#dpc-app .dpc-native-menu-children>a{min-height:34px;padding:7px 0;font:400 14px/20px system-ui,sans-serif;box-sizing:border-box}#dpc-app .dpc-native-menu-children>details>summary.dpc-split-summary{padding:0;min-height:34px}#dpc-app .dpc-native-menu-children .dpc-split-summary>.dpc-expand-hit{min-height:0;height:auto;align-self:stretch}#dpc-app .dpc-native-menu-children .dpc-split-summary>a.dpc-parent-link{padding:7px 0;min-height:34px}";
    style.textContent += "#dpc-app .dpc-native-menu-group>summary{position:relative;align-items:center}#dpc-app .dpc-native-menu-group>summary:after{position:absolute;right:15px;top:50%;margin:0;transform:translate(0,-50%) rotate(-45deg);transform-origin:center}#dpc-app .dpc-native-menu-group[open]>summary:after{transform:translate(0,-50%) rotate(45deg)}#dpc-app .dpc-split-summary>a.dpc-parent-link{align-items:center}#dpc-app .dpc-split-summary .dpc-restyle-mark{align-self:center;transform:translateY(0);margin-top:0;margin-bottom:0}#dpc-app .dpc-restyle-mark i{top:-1px}";
    style.textContent += '#dpc-app .dpc-home-thread a{text-decoration:none;color:inherit}#dpc-app .dpc-home-thread a.dpc-thread-category{color:var(--accent)}';
    style.textContent += "#dpc-app .dpc-home-thread{display:flex;flex-direction:column;gap:4px;padding:12px 0;border-bottom:1px solid var(--line);font:400 14px/1.4 system-ui,sans-serif;color:inherit;text-decoration:none}#dpc-app .dpc-home-thread[hidden]{display:none!important}#dpc-app .dpc-thread-category{font:500 11px/1.35 system-ui,sans-serif;color:var(--accent)}#dpc-app .dpc-thread-title{font:500 16px/1.35 system-ui,sans-serif;color:inherit;overflow-wrap:anywhere}#dpc-app .dpc-thread-details{display:flex;justify-content:space-between;align-items:baseline;gap:10px;color:var(--muted);font:400 11px/1.4 system-ui,sans-serif}#dpc-app .dpc-thread-time{flex:none;text-align:right}#dpc-app .dpc-home-thread small{font:400 11px/1.4 system-ui,sans-serif;margin:0}";
    style.textContent += "#dpc-app .dpc-photo-detail{padding:16px;max-width:900px;margin:auto}#dpc-app .dpc-detail-challenge{display:block;margin-bottom:12px;color:var(--accent);font-size:14px}#dpc-app .dpc-detail-stage{background:#151515;margin:0 -16px;display:flex;justify-content:center;align-items:center}#dpc-app .dpc-detail-stage img{display:block;max-width:100%;max-height:75vh;object-fit:contain}#dpc-app .dpc-detail-title{height:100px;margin:12px 0 0}#dpc-app .dpc-detail-credit{display:flex;justify-content:center;align-items:center;gap:10px;margin:0 0 24px;color:var(--accent)}#dpc-app .dpc-detail-ribbon{font-size:12px;border:1px solid currentColor;border-radius:4px;padding:3px 7px}#dpc-app .dpc-detail-ribbon[data-place=\"1st Place\"]{color:#709ce5}#dpc-app .dpc-detail-ribbon[data-place=\"2nd Place\"]{color:#d66c78}#dpc-app .dpc-detail-ribbon[data-place=\"3rd Place\"]{color:#c6a34c}#dpc-app .dpc-detail-section{border-top:1px solid var(--line);padding:18px 0;margin:0}#dpc-app .dpc-detail-section h2{font:500 25px Georgia,serif;margin:0 0 15px}#dpc-app .dpc-detail-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:9px 12px;font-size:14px;margin:0}#dpc-app .dpc-detail-fields dt{color:var(--muted)}#dpc-app .dpc-detail-fields dd{margin:0;overflow-wrap:anywhere}#dpc-app .dpc-detail-vote{display:grid;grid-template-columns:22px 1fr 30px;gap:8px;align-items:center;font-size:13px;margin:7px 0}#dpc-app .dpc-detail-track{height:9px;background:var(--line);border-radius:3px;overflow:hidden}#dpc-app .dpc-detail-track div{height:100%;background:var(--accent)}#dpc-app .dpc-detail-vote.own{color:#d66c78;font-weight:bold}#dpc-app .dpc-detail-vote.own .dpc-detail-track div{background:#d66c78}#dpc-app .dpc-detail-note{font-size:12px;color:var(--muted)}#dpc-app .dpc-detail-prose{font-size:15px;line-height:1.6;overflow-wrap:anywhere}#dpc-app .dpc-detail-prose img{max-width:100%;height:auto}#dpc-app .dpc-detail-action{display:block;width:100%;box-sizing:border-box;padding:12px;margin:12px 0;border:1px solid var(--line);border-radius:6px;color:var(--accent);background:transparent;text-align:center;font:inherit}#dpc-app .dpc-detail-related{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}#dpc-app .dpc-detail-related img{width:100%;height:90px;object-fit:contain;background:#151515}#dpc-app .dpc-detail-related span{display:block;font-size:12px}#dpc-app .dpc-detail-comment{padding:16px 0;border-bottom:1px solid var(--line)}#dpc-app .dpc-detail-comment-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}#dpc-app .dpc-detail-comment-head img{width:40px;height:40px;object-fit:cover;border-radius:50%}#dpc-app .dpc-detail-comment-head small{display:block;color:var(--muted);font-size:11px;margin-top:3px}#dpc-app .dpc-detail-comment-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:12px}#dpc-app .dpc-detail-comment-actions button{background:none;border:0;color:var(--muted);padding:0;font:inherit}#dpc-app .dpc-detail-helpful{display:block;color:var(--accent);margin-top:10px}#dpc-app .dpc-detail-divider{font-size:13px;color:var(--muted);margin:22px 0 0}";
    style.textContent += "#dpc-app .dpc-photo-detail{padding:12px 16px 24px}#dpc-app .dpc-detail-challenge{margin:0;font:500 13px/1.4 system-ui,sans-serif}#dpc-app .dpc-detail-title{height:90px;margin:0!important}#dpc-app .dpc-detail-credit{justify-content:flex-start;margin:0 0 12px;gap:7px;font:400 14px/1.4 system-ui,sans-serif}#dpc-app .dpc-detail-credit svg{position:static;width:19px;height:26px;flex:none}#dpc-app .dpc-detail-stage{height:min(55vh,520px);touch-action:pan-y pinch-zoom}#dpc-app .dpc-detail-stage img{max-height:100%;max-width:100%}#dpc-app .dpc-detail-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0 16px;font-size:12px;color:var(--muted)}#dpc-app .dpc-detail-nav button{background:transparent;color:var(--accent);border:1px solid var(--line);border-radius:6px;padding:9px 12px;font:500 13px system-ui,sans-serif}#dpc-app .dpc-detail-section h2{font:500 23px/1.2 var(--serif),Georgia,serif;margin:0 0 14px}#dpc-app .dpc-detail-fields{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:0;font:400 13px/1.45 system-ui,sans-serif}#dpc-app .dpc-detail-fields dt,#dpc-app .dpc-detail-fields dd{padding:8px 0;border-bottom:1px solid var(--line)}#dpc-app .dpc-detail-fields dd{text-align:right;padding-left:12px}#dpc-app .dpc-detail-prose{font:400 14px/1.6 system-ui,sans-serif}#dpc-app .dpc-detail-comment-head a{font:600 14px system-ui,sans-serif}#dpc-app .dpc-detail-comment-actions{font:400 12px system-ui,sans-serif}";
    style.textContent += "#dpc-app .dpc-detail-carousel{overflow:hidden;position:relative;touch-action:pan-y pinch-zoom;display:block}#dpc-app .dpc-detail-rail{display:flex;width:100%;height:100%;will-change:transform}#dpc-app .dpc-detail-slide{flex:0 0 100%;min-width:0;height:100%;display:flex;align-items:center;justify-content:center}#dpc-app .dpc-detail-slide img{width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none}";
    style.textContent += "#dpc-app .dpc-detail-title{margin:8px 0 0!important}#dpc-app .dpc-detail-credit{justify-content:center;margin:0 0 12px}";
    style.textContent += "#dpc-app .dpc-photo-caption{margin:10px 0;min-height:103px}#dpc-app .dpc-photo-caption .dpc-detail-credit{justify-content:flex-start;gap:7px}#dpc-app .dpc-photo-caption .dpc-detail-credit a{font:inherit;color:inherit}";
    style.textContent += "#dpc-app .dpc-brand-word .dpc-brand-end{position:relative;display:inline-block}#dpc-app .dpc-brand-word .dpc-brand-end em{position:absolute;left:0;bottom:.92em;font-size:.53em;line-height:1;letter-spacing:0;margin:0;transform:translateY(-.65em)}#dpc-app .dpc-brand .dpc-brand-word{padding-top:4px}";
    style.textContent += "#dpc-app .dpc-photo-detail{padding:12px 12px 24px}#dpc-app .dpc-detail-gallery,#dpc-app .dpc-detail-section{background:#25262e;border:1px solid #ffffff20;border-radius:6px;padding:12px;margin:0 0 14px;min-width:0}#dpc-app .dpc-detail-gallery .dpc-detail-stage{margin:0;background:#151515}#dpc-app .dpc-detail-gallery .dpc-photo-caption{margin:10px 0}#dpc-app .dpc-photo-caption .dpc-detail-credit{font:italic 500 18px/1.25 var(--serif);margin:0}#dpc-app .dpc-detail-gallery .dpc-detail-nav{padding:8px 0 0;border-top:1px solid var(--line)}#dpc-app .dpc-photo-detail .dpc-detail-challenge{margin:8px 4px 10px;font:500 15px/1.4 system-ui,sans-serif}#dpc-app .dpc-brand-word .dpc-brand-end{color:inherit;margin:0}#dpc-app .dpc-brand-word .dpc-brand-end em{left:.12em;bottom:.83em;transform:none}html.dpc-light #dpc-app .dpc-detail-gallery,html.dpc-light #dpc-app .dpc-detail-section{background:#fff;border-color:#cdd3df}";
    style.textContent += "#dpc-app .dpc-detail-results-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px;align-items:start}#dpc-app .dpc-detail-results-layout.single{grid-template-columns:minmax(0,1fr)}#dpc-app .dpc-detail-columns{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:3px;align-items:end}#dpc-app .dpc-detail-column{min-width:0;text-align:center;font:400 10px/1.2 system-ui,sans-serif;color:var(--muted)}#dpc-app .dpc-detail-column-track{height:100px;position:relative;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid var(--line);padding-top:14px}#dpc-app .dpc-detail-column-fill{width:100%;background:var(--accent);border-radius:2px 2px 0 0;position:relative}#dpc-app .dpc-detail-column-count{position:absolute;top:0;left:0;right:0;color:inherit;font-size:9px}#dpc-app .dpc-detail-column-score{display:block;padding-top:5px}#dpc-app .dpc-detail-column.own{color:#d66c78;font-weight:700}#dpc-app .dpc-detail-column.own .dpc-detail-column-fill{background:#d66c78}#dpc-app .dpc-detail-distribution-note{font:400 10px/1.3 system-ui,sans-serif;color:var(--muted);margin-top:8px}#dpc-app .dpc-detail-summary .dpc-detail-fields{grid-template-columns:minmax(0,1fr) auto;font-size:11px;line-height:1.3}#dpc-app .dpc-detail-summary .dpc-detail-fields dt,#dpc-app .dpc-detail-summary .dpc-detail-fields dd{padding:5px 0;overflow-wrap:anywhere}#dpc-app .dpc-detail-summary .dpc-detail-fields dd{padding-left:5px}";
    style.textContent += "#dpc-app .dpc-brand-word .dpc-brand-end em{left:calc(.48em - 2px);bottom:1.48em;transform:none}#dpc-app .dpc-detail-gallery{overflow:hidden}#dpc-app .dpc-detail-gallery .dpc-photo-caption{margin:4px 0 4px}#dpc-app .dpc-detail-photographer{border-top:1px solid var(--line);padding:12px 0 2px;margin:0}#dpc-app .dpc-detail-photographer h2{font:500 19px/1.2 var(--serif),Georgia,serif;margin:0 0 8px;color:inherit}#dpc-app .dpc-photo-detail .dpc-detail-prose{font:400 12px/1.5 system-ui,sans-serif}#dpc-app .dpc-detail-results-layout{align-items:stretch}#dpc-app .dpc-detail-distribution{display:flex;flex-direction:column;min-width:0;min-height:130px}#dpc-app .dpc-detail-columns{flex:1;align-items:stretch;gap:4px;min-height:110px}#dpc-app .dpc-detail-column{display:flex;flex-direction:column;min-height:0}#dpc-app .dpc-detail-column-track{height:auto;flex:1;min-height:0;padding:0}#dpc-app .dpc-detail-column-plot{position:absolute;inset:16px 0 0;display:flex;align-items:flex-end;justify-content:center}#dpc-app .dpc-detail-column-fill{width:65%;max-width:12px}#dpc-app .dpc-detail-column-score{flex:none}#dpc-app .dpc-detail-distribution-note{flex:none}";
    style.textContent += "#dpc-app .dpc-photo-detail .dpc-detail-prose{font:400 13px/1.4 system-ui,sans-serif;color:var(--muted);-webkit-text-size-adjust:none;text-size-adjust:none}#dpc-app .dpc-photo-detail .dpc-detail-prose *{font-size:inherit!important;line-height:inherit!important;-webkit-text-size-adjust:none;text-size-adjust:none}#dpc-app .dpc-detail-photographer .dpc-detail-prose{position:relative;padding-left:0;display:flow-root}#dpc-app .dpc-detail-photographer .dpc-detail-prose::before{content:'“';float:left;position:static;display:block;width:32px;height:30px;margin:0 4px 0 0;color:var(--accent);font:900 58px/.9 Georgia,serif}#dpc-app .dpc-detail-column-count{top:auto;line-height:1;pointer-events:none}#dpc-app .dpc-detail-icon-action{display:inline-flex;align-items:center;gap:6px}#dpc-app .dpc-detail-action.dpc-detail-icon-action{display:flex;justify-content:center}#dpc-app .dpc-detail-icon-action svg{width:15px;height:15px;flex:none}#dpc-app .dpc-detail-comment-actions{gap:6px 14px;align-items:center;-webkit-text-size-adjust:none;text-size-adjust:none}#dpc-app .dpc-detail-comment-actions a{color:var(--accent);flex:none}#dpc-app .dpc-detail-comment-actions .dpc-detail-helpful{display:inline-flex;margin:0;color:var(--muted);font:inherit;max-width:100%}#dpc-app .dpc-detail-comment .dpc-detail-prose{font-size:13px!important;line-height:1.4!important;-webkit-text-size-adjust:none;text-size-adjust:none}";
    style.textContent += "#dpc-app .dpc-detail-swipe-area{touch-action:pan-y pinch-zoom;min-width:0}";
    style.textContent += "#dpc-app .dpc-detail-results-layout:not(.single){grid-template-columns:minmax(0,1fr) minmax(0,1.06fr);gap:14px}#dpc-app .dpc-detail-summary .dpc-detail-fields{align-items:baseline;column-gap:6px;font-variant-numeric:tabular-nums}#dpc-app .dpc-detail-summary .dpc-detail-fields dt,#dpc-app .dpc-detail-summary .dpc-detail-fields dd{padding:5px 0;align-self:stretch}#dpc-app .dpc-detail-summary .dpc-detail-fields dt:first-child,#dpc-app .dpc-detail-summary .dpc-detail-fields dd:nth-child(2){padding-top:0}#dpc-app .dpc-detail-summary .dpc-detail-fields dt:nth-last-child(2),#dpc-app .dpc-detail-summary .dpc-detail-fields dd:last-child{padding-bottom:0;border-bottom:0}#dpc-app .dpc-detail-column-plot{top:13px}#dpc-app .dpc-detail-distribution-note{margin-top:6px}#dpc-app .dpc-detail-column-score{padding-top:4px}";
    style.textContent += "#dpc-app .dpc-photo-detail{position:relative;overflow-x:clip}#dpc-app .dpc-detail-current{min-width:0}#dpc-app .dpc-photo-detail.dpc-detail-preview{position:absolute;top:0;left:0;width:100%;margin:0;pointer-events:none;overflow:visible}#dpc-app .dpc-detail-preview .dpc-photo-caption,#dpc-app .dpc-detail-preview .dpc-detail-photographer,#dpc-app .dpc-detail-preview .dpc-detail-section>*{visibility:hidden}#dpc-app .dpc-detail-column-fill{transform-origin:center bottom}#dpc-app .dpc-detail-stage img{width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none}";
    style.textContent += "#dpc-app .dpc-detail-preview .dpc-photo-caption,#dpc-app .dpc-detail-preview .dpc-detail-photographer,#dpc-app .dpc-detail-preview .dpc-detail-section>*{visibility:visible}#dpc-app .dpc-photo-detail{overflow-anchor:none}#dpc-app .dpc-photo-caption.has-result{padding-bottom:24px;min-height:127px}#dpc-app .dpc-detail-caption-result{position:absolute;bottom:0;right:0;display:flex;align-items:baseline;gap:5px;color:var(--accent);white-space:nowrap;font:italic 600 15px/1.2 var(--serif),Georgia,serif;font-variant-numeric:tabular-nums}#dpc-app .dpc-detail-caption-rank{font-size:19px;color:inherit}#dpc-app .dpc-detail-caption-slash{color:var(--muted);font-size:13px}#dpc-app .dpc-detail-caption-average{color:var(--muted)}";
    style.textContent += "@media (prefers-reduced-motion:no-preference){#dpc-app .dpc-detail-preview .dpc-detail-column-fill,#dpc-app .dpc-detail-preview .dpc-detail-column-count,#dpc-app .dpc-detail-preview .dpc-title-part,#dpc-app .dpc-detail-preview .dpc-detail-credit{visibility:hidden}}";
    style.textContent += "#dpc-app .dpc-detail-gallery .dpc-detail-stage{width:100%;height:auto;min-height:0;max-height:none;display:block}#dpc-app .dpc-detail-gallery .dpc-detail-stage img{display:block;width:100%;height:auto;max-width:100%;max-height:none;object-fit:contain}";
    style.textContent += "#dpc-app .dpc-detail-gallery .dpc-detail-stage{margin:-12px -12px 0;width:calc(100% + 24px);max-width:none}";
    style.textContent += "#dpc-app .dpc-results-page{max-width:1000px;padding:20px 12px}#dpc-app .dpc-results-page .dpc-list-title{font-size:clamp(32px,9vw,60px)!important}#dpc-app .dpc-results-description{font:400 13px/1.45 system-ui,sans-serif;color:var(--muted);margin:0 4px 12px}#dpc-app .dpc-results-details{margin:12px 0 24px;padding:0 12px}#dpc-app .dpc-results-details .dpc-detail-fields{padding-bottom:12px}#dpc-app .dpc-challenge-results-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}#dpc-app .dpc-result-photo-card{background:#25262e;border:1px solid #ffffff20;border-radius:6px;overflow:hidden;min-width:0}#dpc-app .dpc-result-photo-link{display:block}#dpc-app .dpc-result-photo-link img{display:block;width:100%;height:auto;max-width:100%}#dpc-app .dpc-result-photo-caption{padding:10px 10px 12px}#dpc-app .dpc-result-photo-title{display:block;font:500 25px/1.04 var(--serif),Georgia,serif;letter-spacing:-.035em;color:inherit;overflow-wrap:anywhere;margin-bottom:8px}#dpc-app .dpc-result-photo-meta{display:flex;align-items:center;gap:6px}#dpc-app .dpc-result-photo-author{display:flex;align-items:center;gap:5px;font:italic 500 15px/1.2 var(--serif),Georgia,serif;color:var(--accent);min-width:0}#dpc-app .dpc-result-photo-author a{overflow-wrap:anywhere}#dpc-app .dpc-result-photo-score{display:flex;justify-content:flex-end;align-items:baseline;gap:5px;font:italic 600 14px/1.2 var(--serif),Georgia,serif;color:var(--accent);margin-top:8px;white-space:nowrap}#dpc-app .dpc-result-personal{display:flex;justify-content:space-between;gap:5px;color:var(--muted);font-size:10px;margin-top:7px}#dpc-app .dpc-results-page .dpc-infinite-sentinel{display:block;width:100%;border:0;background:none;color:var(--muted);padding:18px;font-size:12px}html.dpc-light #dpc-app .dpc-result-photo-card{background:#fff;border-color:#cdd3df}@media(min-width:700px){#dpc-app .dpc-challenge-results-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:480px){#dpc-app .dpc-challenge-results-grid{grid-template-columns:1fr}#dpc-app .dpc-result-photo-title{font-size:32px}#dpc-app .dpc-result-photo-caption{padding:12px}#dpc-app .dpc-result-photo-author{font-size:18px}}";
    style.textContent += "#dpc-app .dpc-challenge-results-grid{grid-template-columns:1fr;gap:10px}#dpc-app .dpc-result-photo-card{display:grid;grid-template-columns:minmax(0, .85fr) minmax(0,1fr);align-items:start}#dpc-app .dpc-result-photo-link{padding:0;position:relative;align-self:stretch;display:flex;align-items:center;justify-content:center;background:#151515;min-width:0}#dpc-app .dpc-result-photo-link img{display:block;width:100%;height:auto;min-height:0}#dpc-app .dpc-result-photo-caption{padding:10px;min-width:0}#dpc-app .dpc-result-photo-title{font-size:clamp(20px,5.3vw,27px);margin-bottom:5px}#dpc-app .dpc-result-photo-author{font-size:14px}#dpc-app .dpc-result-photo-author svg{width:15px;height:21px}#dpc-app .dpc-result-photo-score{justify-content:flex-start;margin:6px 0 8px;font-size:12px;gap:4px}#dpc-app .dpc-result-photo-score .dpc-detail-caption-rank{font-size:17px}#dpc-app .dpc-result-row-stats{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:5px;row-gap:3px;margin:0;font:400 10px/1.3 system-ui,sans-serif;font-variant-numeric:tabular-nums}#dpc-app .dpc-result-row-stats dt{color:var(--muted);margin:0}#dpc-app .dpc-result-row-stats dd{margin:0;text-align:right}#dpc-app .dpc-result-own-vote{color:var(--accent);font-weight:600}#dpc-app .dpc-result-own-comment{border-top:1px solid var(--line);margin-top:8px;padding-top:7px;font:400 10px/1.35 system-ui,sans-serif;color:var(--muted);overflow-wrap:anywhere}#dpc-app .dpc-result-own-comment span{color:var(--accent);font-weight:600}#dpc-app .dpc-result-own-comment p{margin:3px 0 0}#dpc-app .dpc-results-sort{display:flex;gap:8px;margin:0 0 16px;border-bottom:1px solid var(--line)}#dpc-app .dpc-results-sort-link{flex:1;text-align:center;color:var(--muted);padding:10px 4px;font-size:12px}#dpc-app .dpc-results-sort-link.active{color:var(--accent);border-bottom:2px solid var(--accent)}@media(min-width:700px){#dpc-app .dpc-challenge-results-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}";
    style.textContent += "#dpc-app .dpc-header-messages{position:relative;display:grid;place-items:center;width:32px;height:36px;flex:none;color:var(--muted)}#dpc-app .dpc-header-messages svg{width:21px;height:21px}#dpc-app .dpc-message-dot{display:none;position:absolute;top:5px;right:3px;width:8px;height:8px;border-radius:50%;background:#e35e75;box-shadow:0 0 0 2px #111115}#dpc-app .dpc-header-messages.unread{color:var(--accent)}#dpc-app .dpc-header-messages.unread .dpc-message-dot{display:block}html.dpc-light #dpc-app .dpc-message-dot{box-shadow:0 0 0 2px #f5f6f8}#dpc-app .dpc-header.has-messages{padding-inline:12px;gap:5px}#dpc-app .dpc-header.has-messages .dpc-header-right{gap:3px;flex:none}#dpc-app .dpc-header.has-messages .dpc-brand{font-size:clamp(17px,6vw,24px)!important}#dpc-app .dpc-header.has-messages .dpc-brand svg{width:23px;height:23px}#dpc-app .dpc-result-photo-score{font-weight:700;font-optical-sizing:none;font-variation-settings:'opsz' 14,'wght' 700}#dpc-app .dpc-result-photo-score .dpc-detail-caption-rank,#dpc-app .dpc-result-photo-score .dpc-detail-caption-average{font-weight:700;-webkit-text-stroke:.12px currentColor}";
    style.textContent += "#dpc-app .dpc-home-challenge-tabs{display:flex;justify-content:flex-start;gap:22px;margin:0 0 16px;border-bottom:1px solid var(--line)}#dpc-app .dpc-home-challenge-tab{flex:0 0 auto;min-width:0;padding:10px 0 12px;text-align:left;background:none;border:0;border-bottom:2px solid transparent;color:var(--muted);font:500 clamp(19px,5.5vw,29px)/1.1 var(--serif),Georgia,serif;font-optical-sizing:none;font-variation-settings:'opsz' 24,'wght' 500;-webkit-text-stroke:.25px currentColor;letter-spacing:-.035em;white-space:nowrap}#dpc-app .dpc-home-challenge-tab em{font:inherit;font-style:italic;color:inherit}#dpc-app .dpc-home-challenge-tab.active{color:var(--ink,#f0edf0);border-bottom-color:var(--accent)}html.dpc-light #dpc-app .dpc-home-challenge-tab{-webkit-text-stroke:.35px currentColor}";
    style.textContent += "#dpc-app .dpc-brand svg{width:26px;height:35px}#dpc-app .dpc-header.has-messages .dpc-brand svg{width:23px;height:31px}";
    style.textContent += "#dpc-app .dpc-detail-gallery .dpc-detail-stage.dpc-fixed-photo-stage{position:relative;height:auto;overflow:hidden}#dpc-app .dpc-detail-gallery .dpc-detail-stage.dpc-fixed-photo-stage img{position:absolute;inset:0;width:100%;height:100%;max-height:none;object-fit:contain}";
    style.textContent += "#dpc-app .dpc-profile-page{max-width:900px;margin:auto;padding:12px 12px 24px}#dpc-app .dpc-profile-card{background:#25262e;border:1px solid #ffffff20;border-radius:6px;overflow:hidden;min-width:0}html.dpc-light #dpc-app .dpc-profile-card{background:#fff;border-color:#cdd3df}#dpc-app .dpc-profile-hero{padding:16px;margin-bottom:18px}#dpc-app .dpc-profile-identity{display:flex;align-items:center;gap:14px}#dpc-app .dpc-profile-avatar{width:84px;height:auto;object-fit:contain;border-radius:6px;flex:none}#dpc-app .dpc-profile-who{min-width:0}#dpc-app .dpc-profile-who h1{font:500 clamp(29px,8vw,48px)/1.06 var(--serif),Georgia,serif;margin:0 0 5px;overflow-wrap:anywhere}#dpc-app .dpc-profile-realname{font:italic 500 20px/1.2 var(--serif),Georgia,serif;color:var(--accent)}#dpc-app .dpc-profile-meta,#dpc-app .dpc-profile-status{font:400 11px/1.5 system-ui,sans-serif;color:var(--muted);overflow-wrap:anywhere}#dpc-app .dpc-profile-status{margin-top:5px}#dpc-app .dpc-profile-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin:15px 0;padding:12px 0;text-align:center}#dpc-app .dpc-profile-metrics strong{display:block;font:italic 700 clamp(15px,4.6vw,23px)/1.2 var(--serif),Georgia,serif;color:var(--accent)}#dpc-app .dpc-profile-metrics span,#dpc-app .dpc-profile-medals span{font-size:10px;color:var(--muted)}#dpc-app .dpc-profile-actions{display:flex;gap:6px;flex-wrap:wrap}#dpc-app .dpc-profile-actions a{flex:1;text-align:center;border:1px solid var(--line);border-radius:5px;padding:8px 4px;font-size:12px}#dpc-app .dpc-profile-tabs{gap:15px;overflow-x:auto;scrollbar-width:none}#dpc-app .dpc-profile-tabs button{font-size:clamp(16px,4.5vw,23px)}#dpc-app .dpc-profile-section{margin:0 0 24px}#dpc-app .dpc-profile-section h2{font:500 28px/1.1 var(--serif),Georgia,serif;letter-spacing:-.035em;margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid var(--line);-webkit-text-stroke:.18px currentColor}#dpc-app .dpc-profile-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#dpc-app .dpc-profile-photo{position:relative;display:flex;align-items:center;justify-content:center;background:#151515;min-width:0;aspect-ratio:4/3}#dpc-app .dpc-profile-photo img{width:100%;height:100%;object-fit:contain}#dpc-app .dpc-profile-photo .dpc-overlay-ribbon{position:absolute;top:6px;left:6px;width:22px;height:30px}#dpc-app .dpc-profile-caption{display:flex;flex-direction:column;gap:5px;padding:9px;min-width:0;font-size:11px;overflow-wrap:anywhere}#dpc-app .dpc-profile-photo-title{font:500 20px/1.12 var(--serif),Georgia,serif;color:inherit}#dpc-app .dpc-profile-score{font:italic 700 15px/1.2 var(--serif),Georgia,serif;color:var(--accent)}#dpc-app .dpc-profile-medals{display:flex;justify-content:space-around;text-align:center;margin:12px 0}#dpc-app .dpc-profile-medals>div{display:flex;flex-direction:column;align-items:center;gap:5px}#dpc-app .dpc-profile-medals svg{position:static;width:35px;height:47px}#dpc-app .dpc-profile-medals strong{font:500 29px/1 var(--serif)}#dpc-app .dpc-profile-fold{margin-bottom:8px;padding:12px}#dpc-app .dpc-profile-fold summary{cursor:pointer;font-size:13px}#dpc-app .dpc-profile-award-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line)}#dpc-app .dpc-profile-award-row>svg,#dpc-app .dpc-profile-award-row>img{position:static;width:22px;height:30px;object-fit:contain;flex:none}#dpc-app .dpc-profile-award-row a{display:block;font-size:12px}#dpc-app .dpc-profile-award-row a:first-child{font:500 18px/1.2 var(--serif),Georgia,serif;color:inherit}#dpc-app .dpc-profile-controls{display:flex;gap:6px;flex-wrap:wrap}#dpc-app .dpc-profile-controls input,#dpc-app .dpc-profile-controls select{min-width:0;flex:1;background:#80808014;color:inherit;border:1px solid var(--line);border-radius:5px;padding:9px;font:12px system-ui}#dpc-app .dpc-profile-list{display:grid;gap:8px}#dpc-app .dpc-profile-list-card{display:grid;grid-template-columns: minmax(0,.75fr) minmax(0,1fr);align-items:stretch}#dpc-app .dpc-profile-list-card .dpc-profile-photo{aspect-ratio:auto;min-height:100px}#dpc-app .dpc-profile-list-card .dpc-profile-photo img{position:absolute;inset:0}#dpc-app .dpc-profile-info{padding:14px;font:13px/1.6 system-ui,sans-serif;overflow-wrap:anywhere}#dpc-app .dpc-profile-info h3{font:600 12px system-ui;color:var(--accent);margin:12px 0 4px}#dpc-app .dpc-profile-info img{max-width:100%;height:auto}#dpc-app .dpc-profile-prose{margin-bottom:8px}#dpc-app .dpc-profile-info li{margin-left:15px}@media(min-width:700px){#dpc-app .dpc-profile-gallery{grid-template-columns:repeat(3,minmax(0,1fr))}#dpc-app .dpc-profile-list{grid-template-columns:repeat(2,minmax(0,1fr))}}";
    style.textContent += "#dpc-app .dpc-profile-fields-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}#dpc-app .dpc-profile-fields-grid .wide{grid-column:1/-1}#dpc-app .dpc-profile-fields-grid .dpc-profile-field{border-bottom:1px solid var(--line);padding:6px 0}#dpc-app .dpc-profile-fields-grid h3{margin:0 0 3px}#dpc-app .dpc-profile-fields-grid .dpc-profile-prose{margin:0}#dpc-app .dpc-profile-stat-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0;margin:0}#dpc-app .dpc-profile-stat-grid dt,#dpc-app .dpc-profile-stat-grid dd{padding:6px 0;border-bottom:1px solid var(--line);margin:0}#dpc-app .dpc-profile-stat-grid dt{color:var(--muted)}#dpc-app .dpc-profile-stat-grid dd{text-align:right;font-weight:500}#dpc-app .dpc-profile-stat-group{grid-column:1/-1;color:var(--accent);font-weight:600;margin-top:8px}";
    style.textContent += "#dpc-app .dpc-profile-photo-title .dpc-overlay-ribbon{position:static;display:inline-block;width:16px;height:22px;vertical-align:-4px;margin:0 6px 0 0;filter:none}";
    style.textContent += "#dpc-app .dpc-native-menu-group>summary.dpc-split-summary:after{display:none}#dpc-app .dpc-split-summary>.dpc-expand-hit{display:flex;align-items:center;flex:1;min-width:0;width:auto;padding:8px 0;cursor:pointer}#dpc-app .dpc-split-summary>a.dpc-parent-link{flex:0 0 44px;width:44px;justify-content:center;padding:0;color:var(--accent)}#dpc-app .dpc-split-summary>.dpc-restyle-mark{flex:none;margin-right:5px}#dpc-app .dpc-native-menu-children .dpc-split-summary>a.dpc-parent-link{padding:0;min-height:34px}#dpc-app .dpc-native-menu-children .dpc-split-summary>.dpc-expand-hit{padding:7px 0}";
    style.textContent += "#dpc-app .dpc-split-summary>a.dpc-restyle-badge-link{display:flex;align-items:center;justify-content:center;flex:none;padding:0 5px;border:0;align-self:stretch}#dpc-app .dpc-restyle-badge-link .dpc-restyle-mark{margin:0}";
    style.textContent += "#dpc-app .dpc-challenge-index .dpc-home-challenge-tabs{gap:clamp(8px,3vw,22px);overflow-x:auto;scrollbar-width:none}#dpc-app .dpc-challenge-index .dpc-home-challenge-tab{font-size:clamp(15px,4.5vw,24px)}#dpc-app .dpc-index-panel[hidden]{display:none!important}#dpc-app .dpc-challenge-index .dpc-entry-grid{margin-top:0}#dpc-app .dpc-index-extra{font-size:11px;color:var(--muted);margin-bottom:12px}#dpc-app .dpc-index-type{grid-column:1/-1;color:var(--muted);font-size:10px}#dpc-app .dpc-challenge-index .dpc-home-detail{grid-template-columns:1fr}#dpc-app .dpc-challenge-index .dpc-home-detail>*{grid-column:1/-1;text-align:left}";
    style.textContent += "#dpc-app .dpc-submit-page{max-width:680px;padding:16px 12px 32px}#dpc-app .dpc-submit-back{display:inline-block;font-size:13px;margin:0 0 14px;color:var(--accent)}#dpc-app .dpc-submit-card{padding:16px;margin:0 0 14px}#dpc-app .dpc-submit-kicker{font:600 10px system-ui;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}#dpc-app .dpc-submit-title{font:500 clamp(36px,10vw,58px)/1.02 var(--serif),Georgia,serif;letter-spacing:-.045em;margin:0 0 12px;overflow-wrap:anywhere}#dpc-app .dpc-submit-description{font-size:14px;line-height:1.55;margin:0 0 14px}#dpc-app .dpc-submit-meta{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);margin:0;font-size:12px}#dpc-app .dpc-submit-meta dt,#dpc-app .dpc-submit-meta dd{margin:0;padding:8px 0;border-top:1px solid var(--line)}#dpc-app .dpc-submit-meta dt{color:var(--muted)}#dpc-app .dpc-submit-meta dd{text-align:right;overflow-wrap:anywhere}#dpc-app .dpc-submit-card h2{font:500 28px/1.1 var(--serif),Georgia,serif;letter-spacing:-.035em;margin:0 0 14px;padding:0 0 10px;border-bottom:1px solid var(--line);color:inherit}#dpc-app .dpc-submit-card h2 em{color:inherit}#dpc-app .dpc-submit-rule-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#dpc-app .dpc-submit-rule-grid>div{background:#80808013;border-radius:5px;padding:10px;font-size:12px;line-height:1.45}#dpc-app .dpc-submit-rule-grid strong{display:block;color:var(--accent);font-size:11px;margin-bottom:4px}#dpc-app .dpc-submit-rules-link{display:inline-block;margin-top:12px;font-size:12px}#dpc-app .dpc-native-upload{margin:0!important;padding:0!important;border:0!important;background:none!important;width:auto!important;color:inherit}#dpc-app #upload_container{display:flex;flex-direction:column;gap:10px;width:100%;position:relative}#dpc-app #upload_file{float:none!important;width:100%!important;box-sizing:border-box;min-height:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#8080800b;border:1px dashed var(--accent)!important;border-radius:8px;padding:20px 8px!important;text-align:center}#dpc-app #upload_file>img,#dpc-app #upload_file>div{float:none!important;padding:0!important;color:var(--accent)!important;font:500 24px/1.2 var(--serif),Georgia,serif!important}#dpc-app .dpc-upload-graphic{width:48px;height:48px;color:var(--accent)}#dpc-app .dpc-upload-graphic svg{width:100%;height:100%}#dpc-app .dpc-upload-hint{font:12px system-ui;color:var(--muted)}#dpc-app .dpc-workshop-button{float:none!important;margin:0!important;border:1px solid var(--line)!important;border-radius:6px;padding:0!important;display:flex;align-items:center;justify-content:center;min-height:44px}#dpc-app .dpc-workshop-button>img{display:none}#dpc-app .dpc-workshop-picker{float:none!important;flex:1;text-align:center;padding:12px!important;color:var(--accent)!important;font:500 13px system-ui!important}#dpc-app #file_selection{margin:14px 0!important;padding:10px;background:#80808012;border-radius:6px;overflow:hidden}#dpc-app #file_selection table{width:100%;table-layout:fixed}#dpc-app #file_selection td{max-width:100%;overflow-wrap:anywhere}#dpc-app #file_selection img{width:auto!important;height:auto!important;max-width:100%;max-height:210px;object-fit:contain;border:0!important;border-radius:4px}#dpc-app #file_selection td>div{max-width:100%;white-space:normal;overflow-wrap:anywhere}#dpc-app #upload_progress{width:100%!important;font-size:11px}#dpc-app #upload_size_progress_bar{background:var(--accent)!important}#dpc-app .dpc-upload-agreement{width:100%!important;margin:14px 0;background:#8080800c;border:1px solid var(--line);border-radius:6px;padding:9px;border-spacing:6px;font-size:12px;line-height:1.55}#dpc-app .dpc-upload-agreement label{font:inherit;color:inherit}#dpc-app #agreement_check{width:20px;height:20px;accent-color:var(--accent);margin:2px 4px 0 0}#dpc-app .dpc-native-upload input[type=button],#dpc-app .dpc-classic-upload input[type=submit],#dpc-app .dpc-classic-upload input[type=button]{border:1px solid var(--line);background:transparent;color:inherit;font:600 14px system-ui;border-radius:6px;min-height:44px;padding:10px 16px;margin:0 6px 8px 0}#dpc-app #submit{background:var(--accent);color:#111115;border-color:var(--accent);min-width:55%}#dpc-app #submit:disabled{opacity:.4}#dpc-app .dpc-native-upload .textsm{font:12px/1.5 system-ui;color:var(--muted)}#dpc-app .dpc-native-upload .textsm span[onclick]{color:var(--accent);text-decoration:underline}#dpc-app .dpc-classic-upload .divider,#dpc-app .dpc-classic-upload .divider_container{background:none;color:inherit;border:0;margin:0;padding:0}#dpc-app .dpc-classic-upload input[type=file]{max-width:100%;margin:12px 0}html.dpc-submission.dpc-mobile body>.ui-dialog,html.dpc-submission.dpc-mobile body>.ui-widget-overlay,html.dpc-submission.dpc-mobile body>[id*=\"jqip\"],html.dpc-submission.dpc-mobile body>[class*=\"imagePicker\"]{display:block!important;max-width:100vw}";
    style.textContent += "#dpc-app .dpc-profile-who h1{font-weight:600;-webkit-text-stroke:.18px currentColor}#dpc-app .dpc-profile-realname{font-weight:600}";
    style.textContent += "#dpc-app .dpc-upload-card{margin-top:14px}#dpc-app .dpc-upload-card h2{margin-bottom:12px}#dpc-app .dpc-native-upload #upload_file{min-height:132px!important;padding:15px!important;gap:0!important}#dpc-app #upload_file>.dpc-upload-caption{display:flex!important;flex-direction:column;align-items:center;gap:7px;pointer-events:none}#dpc-app .dpc-upload-caption strong{font:600 19px/1.2 system-ui,sans-serif;color:var(--accent)}#dpc-app .dpc-upload-caption .dpc-upload-graphic{display:block!important;width:38px;height:38px}#dpc-app .dpc-upload-caption svg,#dpc-app .dpc-workshop-icon svg{display:block!important;width:100%;height:100%}#dpc-app #upload_container>.dpc-workshop-button{margin:0!important;float:none!important;width:100%!important;box-sizing:border-box;border:1px solid var(--line)!important;border-radius:6px!important;padding:0!important}#dpc-app .dpc-workshop-button>img{display:none!important}#dpc-app #imagePicker.dpc-workshop-picker{display:flex!important;align-items:center;justify-content:center;gap:8px;color:var(--accent)!important;font:600 13px system-ui!important;float:none!important;padding:12px!important}#dpc-app .dpc-workshop-icon{display:block;width:19px;height:19px;flex:none;pointer-events:none}#dpc-app .dpc-upload-agreement td,#dpc-app .dpc-upload-agreement label{color:#e4e3e8!important;font:400 12px/1.55 system-ui,sans-serif!important}html.dpc-light #dpc-app .dpc-upload-agreement td,html.dpc-light #dpc-app .dpc-upload-agreement label{color:#30323a!important}#dpc-app .dpc-upload-agreement{margin:12px 0!important;padding:8px!important}#dpc-app .dpc-upload-actions{display:flex;gap:8px;margin:12px 0}#dpc-app .dpc-upload-actions input{margin:0!important;flex:1;min-width:0!important}#dpc-app .dpc-upload-actions #submit{flex:2}#dpc-app .dpc-upload-actions #submit:disabled{background:#80808015!important;color:var(--muted)!important;border-color:var(--line)!important;opacity:1}#dpc-app .dpc-native-upload>.textsm{margin-top:10px}#dpc-app .dpc-native-upload>.textsm br{display:none}#dpc-app .dpc-submit-page .dpc-submit-card{margin-bottom:14px!important}#dpc-app .dpc-submit-page{display:block}";
    style.textContent += "#dpc-app .dpc-submit-page .dpc-submit-card{margin:0 0 12px;padding:14px}#dpc-app .dpc-submit-page .dpc-submit-card h2{margin:0 0 12px;padding:0 0 10px;border-left:0;font-size:28px}#dpc-app .dpc-submit-page .dpc-submit-card h2:before{display:none}#dpc-app .dpc-submit-page #upload_container{display:flex!important;gap:8px!important;align-items:stretch!important}#dpc-app .dpc-submit-page #upload_file{min-height:144px!important;padding:16px 10px!important;display:flex!important;align-items:center!important;justify-content:center!important;background:color-mix(in srgb,var(--accent) 5%,transparent)!important}#dpc-app .dpc-submit-page #upload_file>.dpc-upload-caption{display:flex!important;flex-direction:column;align-items:center;gap:7px;color:var(--accent);font:14px system-ui,sans-serif}#dpc-app .dpc-submit-page #upload_file>.dpc-upload-caption[hidden],#dpc-app .dpc-selected-stage[hidden]{display:none!important}#dpc-app .dpc-submit-page .dpc-upload-caption strong{font:600 16px system-ui,sans-serif;color:var(--accent)}#dpc-app .dpc-submit-page .dpc-upload-graphic{display:block!important;width:38px;height:38px}#dpc-app .dpc-submit-page .dpc-upload-graphic svg,#dpc-app .dpc-submit-page .dpc-workshop-icon svg{display:block!important;width:100%;height:100%}#dpc-app .dpc-submit-page .dpc-upload-hint{display:block!important;font:12px system-ui;color:var(--muted)}#dpc-app .dpc-submit-page #upload_container>.dpc-workshop-button{display:flex!important;float:none!important;margin:0!important;padding:0!important;border:1px solid var(--line)!important;min-height:44px!important;border-radius:6px!important;background:transparent!important}#dpc-app .dpc-submit-page .dpc-workshop-button>img{display:none!important}#dpc-app .dpc-submit-page #imagePicker{display:flex!important;align-items:center!important;justify-content:center!important;gap:8px;float:none!important;width:100%;padding:11px!important;color:var(--accent)!important;font:600 13px system-ui!important}#dpc-app .dpc-workshop-icon{display:inline-block!important;width:19px;height:19px;flex:none}#dpc-app .dpc-submit-page .dpc-upload-agreement{margin:12px 0!important;padding:8px!important;border-spacing:6px!important;color:inherit!important;background:transparent!important}#dpc-app .dpc-submit-page .dpc-upload-agreement td,#dpc-app .dpc-submit-page .dpc-upload-agreement label{color:inherit!important;font:12px/1.55 system-ui,sans-serif!important}html:not(.dpc-light) #dpc-app .dpc-submit-page .dpc-upload-agreement td,html:not(.dpc-light) #dpc-app .dpc-submit-page .dpc-upload-agreement label{color:#e4e3e8!important}html.dpc-light #dpc-app .dpc-submit-page .dpc-upload-agreement td,html.dpc-light #dpc-app .dpc-submit-page .dpc-upload-agreement label{color:#30323a!important}#dpc-app .dpc-upload-actions{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin:12px 0}#dpc-app .dpc-submit-page .dpc-upload-actions input{width:100%;margin:0!important;min-width:0!important}#dpc-app .dpc-submit-page .dpc-native-upload>.textsm{margin:8px 0!important;font-size:11px!important}#dpc-app .dpc-submit-page .dpc-native-upload>.textsm br{display:none}#dpc-app .dpc-submit-page .dpc-selected-stage{display:flex!important;flex-direction:column;align-items:center;gap:10px;width:100%}#dpc-app .dpc-submit-page #upload_file>.dpc-selected-stage[hidden]{display:none!important}#dpc-app .dpc-submit-page .dpc-selected-stage img{display:block!important;width:100%;height:auto;max-height:55vh;object-fit:contain;border-radius:5px}#dpc-app .dpc-replace-photo{font:600 12px system-ui;color:var(--accent)}#dpc-app .dpc-submit-page.dpc-home .dpc-has-preview #upload_file{padding:8px!important;border-style:solid!important}#dpc-app .dpc-has-preview #file_selection{padding:6px!important;margin:6px 0!important}#dpc-app .dpc-has-preview #file_selection td>div{width:auto!important}";
    style.textContent += "#dpc-app .dpc-submit-page #upload_file{min-height:156px!important}#dpc-app .dpc-submit-page #upload_file>.dpc-upload-caption{visibility:visible!important;opacity:1!important;pointer-events:none}#dpc-app .dpc-submit-page #upload_file>.dpc-upload-caption[hidden]{display:none!important}#dpc-app .dpc-submit-page #upload_container>.dpc-workshop-button{border:0!important;min-height:36px!important}#dpc-app .dpc-submit-page #imagePicker{padding:8px!important;font-weight:500!important}#dpc-app .dpc-submit-page .dpc-upload-agreement{border:0!important;padding:0!important}#dpc-app .dpc-submit-page .dpc-upload-actions{margin-top:14px}#dpc-app .dpc-submit-page .dpc-native-upload>.textsm{font-size:11px!important;line-height:1.5!important}#dpc-app .dpc-submit-page .dpc-submit-description{font-size:13px;line-height:1.5}#dpc-app .dpc-submit-page .dpc-submit-meta dt,#dpc-app .dpc-submit-page .dpc-submit-meta dd{padding:6px 0}#dpc-app .dpc-submit-page .dpc-submit-rule-grid>div{padding:8px}";
    style.textContent += "#dpc-app .dpc-submit-page .dpc-submit-kicker{font:600 10px/1.3 system-ui,sans-serif!important;letter-spacing:.09em;margin-bottom:6px}#dpc-app .dpc-submit-page .dpc-submit-back{font:500 12px/1.4 system-ui,sans-serif!important}#dpc-app .dpc-submit-page .dpc-submit-title{font-size:clamp(30px,8vw,44px)!important;margin-bottom:9px}#dpc-app .dpc-submit-page .dpc-submit-description{font:400 13px/1.5 system-ui,sans-serif!important;margin-bottom:12px}#dpc-app .dpc-submit-page .dpc-submit-card h2{font-size:24px!important}#dpc-app .dpc-submit-page .dpc-submit-meta dt,#dpc-app .dpc-submit-page .dpc-submit-meta dd,#dpc-app .dpc-submit-page .dpc-submit-meta dd a{font-size:11px!important;line-height:1.45}#dpc-app .dpc-submit-page .dpc-submit-rule-grid strong{font:600 10px/1.4 system-ui,sans-serif!important}#dpc-app .dpc-submit-page .dpc-submit-rule-grid span{font:400 11px/1.45 system-ui,sans-serif!important}#dpc-app .dpc-submit-page .dpc-submit-rules-link{font:500 11px/1.4 system-ui,sans-serif!important}#dpc-app .dpc-submit-page #upload_file>.dpc-upload-caption strong{font-size:15px!important}#dpc-app .dpc-submit-page #upload_file .dpc-upload-hint{font-size:11px!important}#dpc-app .dpc-submit-page #imagePicker{font-size:12px!important}#dpc-app .dpc-submit-page .dpc-upload-agreement td,#dpc-app .dpc-submit-page .dpc-upload-agreement label,#dpc-app .dpc-submit-page .dpc-upload-agreement a{font-size:11px!important;line-height:1.55!important}#dpc-app .dpc-submit-page .dpc-native-upload>.textsm,#dpc-app .dpc-submit-page .dpc-native-upload>.textsm span,#dpc-app .dpc-submit-page .dpc-native-upload>.textsm a{font:400 10px/1.5 system-ui,sans-serif!important}#dpc-app .dpc-submit-page .dpc-upload-actions input{font-size:13px!important}";
    style.textContent += "#dpc-app .dpc-submit-page #upload_file>.dpc-selected-stage:not([hidden]){display:flex!important}#dpc-app .dpc-submit-page #file_selection,#dpc-app .dpc-submit-page #file_selection td,#dpc-app .dpc-submit-page #file_selection td>div{color:inherit!important}#dpc-app .dpc-submit-page.dpc-home .dpc-has-preview #upload_file{min-height:0!important}";
    style.textContent += "#dpc-app .dpc-submit-page #upload_file>.dpc-upload-caption{display:flex!important;position:relative;z-index:0}#dpc-app .dpc-submit-page .dpc-local-entry-preview:not([hidden]){display:block!important;max-width:100%;max-height:50vh;object-fit:contain;border-radius:5px}#dpc-app .dpc-submit-page .dpc-local-entry-preview[hidden]{display:none!important}#dpc-app .dpc-submit-page #file_selection *:not(input):not(button){color:inherit!important}";
    style.textContent += "#dpc-app .dpc-submit-page .dpc-local-preview-ready #file_selection img{display:none!important}#dpc-app .dpc-submit-page .dpc-local-preview-ready #file_selection{padding:4px 8px!important;margin:4px 0!important;background:transparent!important}";
    style.textContent += "#dpc-app .dpc-submit-page #upload_file>.dpc-legacy-upload-prompt{display:none!important}#dpc-app .dpc-submit-page #upload_file{min-height:64px!important;padding:14px 8px!important;gap:0!important}#dpc-app .dpc-submit-page #upload_file>.dpc-upload-caption{gap:8px!important}#dpc-app .dpc-submit-page .dpc-upload-hint:empty{display:none!important}#dpc-app .dpc-submit-page .dpc-local-preview-ready #upload_file{min-height:0!important;padding:8px!important}";
    style.textContent += "#dpc-app .dpc-submit-page #file_selection .dpc-numeric-filename{display:none!important}";
    style.textContent += "#dpc-app .dpc-entry-editor form{margin:0}#dpc-app .dpc-entry-editor [hidden],#dpc-app .dpc-upload-warnings[hidden]{display:none!important}#dpc-app .dpc-entry-preview{display:block;width:100%;max-height:55vh;object-fit:contain;border-radius:6px;margin-bottom:12px}#dpc-app .dpc-entry-status,#dpc-app .dpc-entry-help{font:12px/1.5 system-ui;color:var(--muted)}#dpc-app .dpc-entry-links{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}#dpc-app .dpc-entry-editor a{font-size:12px}#dpc-app .dpc-entry-link[href*=unsubmit]{color:#e67c7c!important}#dpc-app .dpc-entry-editor h2:not(:first-child){margin-top:20px}#dpc-app .dpc-entry-fields{display:grid;gap:12px}#dpc-app .dpc-entry-field{display:grid;gap:5px;min-width:0}#dpc-app .dpc-entry-field label,#dpc-app .dpc-entry-label{font:600 12px system-ui;color:var(--muted)}#dpc-app .dpc-entry-field input:not([type=file]),#dpc-app .dpc-entry-field select,#dpc-app .dpc-entry-field textarea{box-sizing:border-box;width:100%;min-width:0;max-width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:transparent;color:inherit;font:14px system-ui;min-height:40px}#dpc-app .dpc-entry-field select option{color:#16161b;background:#fff}#dpc-app .dpc-entry-field textarea{resize:vertical;min-height:120px}#dpc-app .dpc-entry-date,#dpc-app .dpc-entry-exposure{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}#dpc-app .dpc-entry-date label{font-size:10px}#dpc-app .dpc-entry-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#dpc-app .dpc-entry-toolbar img{width:18px;height:auto}#dpc-app .dpc-entry-critique{display:flex;gap:8px;align-items:flex-start;font:12px/1.5 system-ui}#dpc-app .dpc-entry-critique input{accent-color:var(--accent);width:18px;height:18px;flex:none}#dpc-app .dpc-entry-editor .dpc-upload-actions input{width:100%;min-width:0;padding:12px 8px;border:1px solid var(--line);border-radius:6px;color:inherit;background:transparent;font:600 13px system-ui}#dpc-app .dpc-entry-editor input[name=SubmitUpdate]{background:var(--accent);color:#111115}#dpc-app .dpc-upload-warnings{margin:8px 0;padding:10px 12px;border:1px solid #d49b55;border-radius:6px;color:#d49b55;font:12px/1.5 system-ui}#dpc-app .dpc-upload-warnings p{margin:0 0 5px}#dpc-app .dpc-upload-warnings p:last-child{margin:0}#dpc-app .dpc-submit-page #file_selection table,#dpc-app .dpc-submit-page #file_selection tbody,#dpc-app .dpc-submit-page #file_selection tr,#dpc-app .dpc-submit-page #file_selection td{display:block;width:100%;box-sizing:border-box}#dpc-app .dpc-submit-page #upload_progress{width:100%!important;float:none!important;text-align:left;font:12px/1.5 system-ui}#dpc-app .dpc-submit-page #upload_progress .progress_bar{height:8px;border:0;background:#80808030;border-radius:8px;margin:8px 0}#dpc-app .dpc-submit-page #upload_size_progress_bar{height:8px;background-image:none!important;border-radius:8px;transition:width .15s linear}#dpc-app .dpc-submit-page #upload_progress div[style*=\"font-style: italic\"]{height:auto!important;width:100%!important;overflow:visible!important;font-style:normal!important}#dpc-app .dpc-submit-page #upload_size_progress_total{font-size:11px!important;color:var(--muted)!important}";
    style.textContent += "#dpc-app .dpc-submit-page .dpc-entry-editor .dpc-entry-status,#dpc-app .dpc-submit-page .dpc-entry-editor .dpc-entry-help{font:400 11px/1.5 system-ui!important;margin:8px 0!important;color:var(--muted)}#dpc-app .dpc-submit-page .dpc-entry-links{display:flex;gap:6px 12px;flex-wrap:wrap;margin:10px 0 0}#dpc-app .dpc-submit-page .dpc-entry-links a{font:600 11px/1.4 system-ui!important;padding:6px 0}#dpc-app .dpc-submit-page .dpc-entry-editor h2:not(:first-child){margin:18px 0 12px!important}#dpc-app .dpc-submit-page .dpc-entry-editor form{margin:0!important;padding:0!important}#dpc-app .dpc-submit-page .dpc-entry-fields{gap:10px}#dpc-app .dpc-submit-page .dpc-entry-field label,#dpc-app .dpc-submit-page .dpc-entry-label{font:600 11px/1.4 system-ui!important}#dpc-app .dpc-submit-page .dpc-entry-field input:not([type=file]),#dpc-app .dpc-submit-page .dpc-entry-field select,#dpc-app .dpc-submit-page .dpc-entry-field textarea{font:400 13px/1.4 system-ui!important;padding:8px!important;min-height:38px}#dpc-app .dpc-submit-page .dpc-entry-field textarea{min-height:100px}#dpc-app .dpc-submit-page .dpc-entry-toolbar{gap:4px}#dpc-app .dpc-submit-page .dpc-entry-toolbar a{display:inline-flex!important;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:4px;padding:5px 7px;font:500 10px/1.2 system-ui!important;color:var(--accent)!important;text-decoration:none!important}#dpc-app .dpc-submit-page .dpc-entry-toolbar a:nth-child(1){font-weight:700!important}#dpc-app .dpc-submit-page .dpc-entry-toolbar a:nth-child(2){font-style:italic!important}#dpc-app .dpc-submit-page .dpc-entry-toolbar a:nth-child(3){text-decoration:underline!important}#dpc-app .dpc-submit-page .dpc-entry-toolbar a:nth-child(4){text-decoration:line-through!important}#dpc-app .dpc-submit-page .dpc-entry-date label{font-size:10px!important}#dpc-app .dpc-submit-page .dpc-entry-editor .dpc-entry-preview{width:100%;height:auto;max-height:55vh;object-fit:contain;margin:0 0 8px}#dpc-app .dpc-submit-page .dpc-entry-editor form>table[hidden]{display:none!important}";
    style.textContent += "#dpc-app.dpc-sticky-site-header{--dpc-sticky-header-height:54px}html:not(.dpc-menu-open) #dpc-app.dpc-sticky-site-header>.dpc-header{position:sticky;top:0;z-index:1002}#dpc-app.dpc-sticky-site-header .dpc-home-main-tabs{position:sticky;top:var(--dpc-sticky-header-height);z-index:90;background:#111115;padding-top:4px;isolation:isolate}html.dpc-light #dpc-app.dpc-sticky-site-header .dpc-home-main-tabs{background:#f5f6f8}html.dpc-menu-open #dpc-app.dpc-sticky-site-header .dpc-home-main-tabs{z-index:90}#dpc-app.dpc-sticky-site-header .dpc-home-main-tabs:before{content:\"\";position:absolute;inset:0 -18px;z-index:-1;background:inherit;pointer-events:none}";
    style.textContent += "#dpc-app .dpc-gallery-context-label{font:400 10px/1.4 system-ui;color:var(--muted);text-align:center;margin:0 0 8px}";
    style.textContent += "#dpc-app>.dpc-gallery-context-label{height:30px;min-height:30px;display:flex;align-items:center;justify-content:center;margin:0!important;padding:0 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box}#dpc-app .dpc-profile-section>h2,#dpc-app .dpc-detail-section>h2,#dpc-app .dpc-detail-photographer>h2{position:relative;padding-left:12px!important}#dpc-app .dpc-profile-section>h2:before,#dpc-app .dpc-detail-section>h2:before,#dpc-app .dpc-detail-photographer>h2:before{content:\"\";position:absolute;left:0;top:.16em;width:3px;height:.86em;background:var(--accent)}";
    style.textContent += "#dpc-app a.dpc-link-pressed,#dpc-app a.dpc-link-loading{opacity:.72;text-decoration:underline!important;text-decoration-thickness:1px!important;text-underline-offset:3px}#dpc-app a.dpc-link-loading{animation:dpc-link-feedback 1.2s ease-in-out infinite alternate}#dpc-app a.dpc-link-pressed:has(img),#dpc-app a.dpc-link-loading:has(img){text-decoration:none!important}#dpc-app a.dpc-link-pressed:has(img) img,#dpc-app a.dpc-link-loading:has(img) img{filter:brightness(.83)}@keyframes dpc-link-feedback{from{opacity:.72}to{opacity:1}}@media(prefers-reduced-motion:reduce){#dpc-app a.dpc-link-loading{animation:none}}";
    style.textContent += "#dpc-app>.dpc-gallery-context-label{height:27px;min-height:27px;font-size:10px;display:block;text-align:center;line-height:27px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#dpc-app>.dpc-gallery-context-label+.dpc-photo-detail{padding-top:3px!important}";
    style.textContent += "#dpc-app .dpc-home-main-tabs{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:0!important;justify-items:stretch;align-items:stretch}#dpc-app .dpc-home-main-tabs>.dpc-home-challenge-tab{display:block;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;padding:10px 0 12px!important;text-align:center!important;letter-spacing:-.035em;font-size:clamp(16px,4.5vw,25px)!important;box-sizing:border-box}#dpc-app .dpc-home-main-tabs>.dpc-home-challenge-tab em{margin:0!important;padding:0!important}#dpc-app .dpc-home .dpc-results-feature>h3{position:relative;padding-left:12px;margin:0 0 12px;font:500 23px/1.15 var(--serif),Georgia,serif;letter-spacing:-.025em;color:inherit;text-align:left}#dpc-app .dpc-home .dpc-results-feature>h3:before{content:\"\";position:absolute;left:0;top:.15em;width:3px;height:.85em;background:var(--accent)}#dpc-app .dpc-home .dpc-results-feature>h3 a{font:inherit;color:inherit;letter-spacing:inherit}#dpc-app .dpc-home .dpc-results-feature>h3 em{font:inherit;font-style:italic;color:inherit}";
    document.head.append(style);

    const header = `
<header class="dpc-header">
    <a class="dpc-brand" href="/">
        <svg viewBox="0 0 40 54" aria-hidden="true"><mask id="dpc-shutter-mask"><circle cx="20" cy="20" r="18.5" fill="white"/><path d="M20 12 L26.928 16 L26.928 24 L20 28 L13.072 24 L13.072 16 Z" fill="black"/><path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate(0 20 20)"/><path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate(60 20 20)"/><path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate(120 20 20)"/><path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate(180 20 20)"/><path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate(240 20 20)"/><path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate(300 20 20)"/></mask><circle cx="20" cy="20" r="18.5" fill="currentColor" mask="url(#dpc-shutter-mask)"/><path d="M8 34 A20.2 20.2 0 0 0 19 40.2 L13 52 L10 46 L3 48 Z M21 40.2 A20.2 20.2 0 0 0 32 34 L37 48 L30 46 L27 52 Z" fill="currentColor"/></svg><span class="dpc-brand-word">DPChall<span class="dpc-brand-end">enge<em>restyle</em></span></span>
    </a>
    <div class="dpc-header-right"><button type="button" class="dpc-theme-toggle" aria-label="Switch theme"></button></div>
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

    style.textContent += "#dpc-app.dpc-entry-preview-mode .dpc-navigation,#dpc-app.dpc-entry-preview-mode .dpc-actions{display:none!important}#dpc-app.dpc-entry-preview-mode .dpc-overview{font:600 20px system-ui}";
    style.textContent += "#dpc-app .dpc-home-vote-status{display:flex;flex-wrap:wrap;gap:6px 12px}#dpc-app .dpc-home-comment-status{font-size:inherit}#dpc-app .dpc-home-progress[hidden]{display:none!important}";
    style.textContent += "#dpc-app .dpc-home-vote-card .dpc-home-progress{position:relative;overflow:hidden}#dpc-app .dpc-home-vote-card .dpc-home-progress i{position:absolute;left:0;top:0;height:100%;transition:width .25s ease}#dpc-app .dpc-home-vote-card .dpc-home-progress .dpc-home-comment-fill{background:#d4ac58;z-index:1}";
    style.textContent += "#dpc-app .dpc-auto-continue{display:flex;align-items:center;justify-content:center;gap:6px;margin:8px 0 10px;font:400 11px/1.4 system-ui;color:var(--muted);cursor:pointer}#dpc-app .dpc-auto-continue input{width:14px;height:14px;margin:0;accent-color:var(--accent)}#dpc-app .dpc-auto-continue[hidden]{display:none!important}";
    style.textContent += "@property --dpc-save-angle{syntax:\"<angle>\";initial-value:0deg;inherits:false}@keyframes dpc-saving-gradient{to{--dpc-save-angle:360deg}}#dpc-app .dpc-score.dpc-saving-button,#dpc-app #dpc-submit-comment.dpc-saving-button:disabled{opacity:1!important;background:linear-gradient(var(--dpc-save-angle),#8fa7df 0%,#c5d3f3 48%,#91a8df 100%)!important;color:#102537!important;border-color:#b4c5ed!important;animation:dpc-saving-gradient 1.8s linear infinite}#dpc-app .dpc-score.pressed.dpc-saving-button{animation:dpc-vote-press .32s ease-out both,dpc-saving-gradient 1.8s linear infinite}@media(prefers-reduced-motion:reduce){#dpc-app .dpc-score.dpc-saving-button,#dpc-app .dpc-score.pressed.dpc-saving-button,#dpc-app #dpc-submit-comment.dpc-saving-button:disabled{animation:none!important}}";
    style.textContent += "#dpc-app .dpc-entry-grid .dpc-home-submitted-card{grid-column:1/-1;min-height:160px;isolation:isolate;overflow:hidden;position:relative}#dpc-app .dpc-entry-grid .dpc-home-submitted-card:before{content:\"\";position:absolute;inset:0;z-index:-1;background-size:cover;background-position:center right;background-repeat:no-repeat}#dpc-app .dpc-entry-grid .dpc-home-submitted-card .dpc-home-meta{max-width:72%;margin:0 0 10px;opacity:1}#dpc-app .dpc-entry-grid .dpc-home-submitted-card .dpc-home-detail{display:flex;flex-direction:row;flex-wrap:wrap;gap:6px 10px;margin:0;padding-top:0;border:0}#dpc-app .dpc-entry-grid .dpc-home-submitted-status{font:600 12px/1.4 system-ui;color:var(--accent);margin-top:10px}#dpc-app .dpc-entry-grid .dpc-home-submitted-card .dpc-home-action{margin-top:8px;align-self:flex-start}";
    style.textContent += "#dpc-app .dpc-home-main-tabs{gap:0;justify-content:space-between}#dpc-app .dpc-home-main-tabs .dpc-home-challenge-tab{flex:1;text-align:center;font-size:clamp(19px,5.5vw,29px)}#dpc-app [id^=dpc-home-challenge-panel-][hidden]{display:none!important}";
    style.textContent += "#dpc-app .dpc-home-main-tabs .dpc-home-challenge-tab.active em{font-style:normal}#dpc-app #dpc-home-challenge-panel-1 .dpc-home-vote-card{padding:13px 12px!important;min-height:142px;border-radius:6px}#dpc-app #dpc-home-challenge-panel-1 .dpc-home-vote-card h3,#dpc-app #dpc-home-challenge-panel-1 .dpc-home-vote-card h3 a{font:500 23px/1.08 var(--serif)!important;letter-spacing:inherit}#dpc-app #dpc-home-challenge-panel-1 .dpc-home-vote-card .dpc-home-meta{font:400 13px/1.45 system-ui!important;margin:0 0 12px;opacity:.86}#dpc-app #dpc-home-challenge-panel-1 .dpc-home-vote-card .dpc-home-detail{font:400 11px/1.3 system-ui;gap:5px 8px}#dpc-app #dpc-home-challenge-panel-1 .dpc-home-vote-status{font:500 11px/1.4 system-ui}#dpc-app #dpc-home-challenge-panel-1 .dpc-home-action{font:500 11px/1.4 system-ui;padding:7px 8px}#dpc-app #dpc-home-challenge-panel-1 .dpc-home-vote-card:before{transition:none!important}";
    style.textContent += "#dpc-app #dpc-home-challenge-panel-1 .dpc-vote-bg-reveal:before{background-image:linear-gradient(90deg,#111115fa 0%,#111115ed 40%,#111115b0 70%,#11111545 100%),var(--vote-blur,none);filter:blur(13px);transform:scale(1.08);opacity:0;transition:opacity .35s ease!important}#dpc-app #dpc-home-challenge-panel-1 .dpc-vote-bg-reveal.dpc-bg-preview:before{opacity:1}#dpc-app #dpc-home-challenge-panel-1 .dpc-vote-bg-reveal:after{content:\"\";position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:linear-gradient(90deg,#111115fa 0%,#111115ed 40%,#111115b0 70%,#11111545 100%),var(--vote-image,none);background-size:cover;background-position:center,right center;opacity:0;transition:opacity .65s ease}#dpc-app #dpc-home-challenge-panel-1 .dpc-vote-bg-reveal.dpc-bg-ready:after{opacity:1}html.dpc-light #dpc-app #dpc-home-challenge-panel-1 .dpc-vote-bg-reveal:before{background-image:linear-gradient(90deg,#f5f6f8fa 0%,#f5f6f8ed 40%,#f5f6f8b0 70%,#f5f6f845 100%),var(--vote-blur,none)}html.dpc-light #dpc-app #dpc-home-challenge-panel-1 .dpc-vote-bg-reveal:after{background-image:linear-gradient(90deg,#f5f6f8fa 0%,#f5f6f8ed 40%,#f5f6f8b0 70%,#f5f6f845 100%),var(--vote-image,none)}@media(prefers-reduced-motion:reduce){#dpc-app #dpc-home-challenge-panel-1 .dpc-vote-bg-reveal:before,#dpc-app #dpc-home-challenge-panel-1 .dpc-vote-bg-reveal:after{transition:none!important}}";
    style.textContent += "#dpc-app .dpc-home-carousel section .dpc-home-vote-card:not(.dpc-home-submitted-card) h3,#dpc-app .dpc-home-carousel section .dpc-home-vote-card:not(.dpc-home-submitted-card) h3 a{font-size:19px!important;line-height:1.12!important}#dpc-app .dpc-home-carousel section .dpc-home-vote-card:not(.dpc-home-submitted-card) .dpc-home-meta{font-size:12px!important;line-height:1.4!important;max-width:85%;margin:0 0 9px;-webkit-text-size-adjust:none;text-size-adjust:none}#dpc-app .dpc-home-carousel section .dpc-home-vote-card:not(.dpc-home-submitted-card){-webkit-text-size-adjust:none;text-size-adjust:none}#dpc-app .dpc-home-carousel section .dpc-home-vote-card:not(.dpc-home-submitted-card) .dpc-home-vote-status{font-size:10px!important}#dpc-app .dpc-home-carousel section .dpc-home-vote-card:not(.dpc-home-submitted-card) .dpc-entry-deadline{font-size:11px!important}#dpc-app .dpc-home-carousel section .dpc-home-vote-card:not(.dpc-home-submitted-card) .dpc-home-action{font-size:10px!important;padding:6px 8px}";
    style.textContent += "#dpc-app .dpc-home-carousel{width:100%;overflow:hidden;touch-action:pan-y pinch-zoom;position:relative}#dpc-app .dpc-home-carousel-track{display:flex;width:100%;align-items:flex-start;will-change:transform}#dpc-app .dpc-home-carousel-track>section{flex:0 0 100%;width:100%;min-width:0;box-sizing:border-box;margin:0!important;display:flow-root}#dpc-app .dpc-home-carousel-track>section[aria-hidden=true]{pointer-events:none}#dpc-app .dpc-home-carousel-track>section>h2[hidden]{display:none!important}";
    style.textContent += "#dpc-app .dpc-home-carousel{max-width:100%;min-width:0;padding:0!important;box-sizing:border-box}#dpc-app .dpc-home-carousel-track{max-width:none!important;min-width:0;gap:0!important;padding:0!important;margin:0!important;box-sizing:border-box}#dpc-app .dpc-home-carousel-track>section{flex-shrink:0!important;flex-grow:0!important;overflow:hidden;box-sizing:border-box;padding:0!important;margin:0!important;border:0!important}#dpc-app .dpc-home-carousel-track>section .dpc-results-feature{margin-left:0;margin-right:0}";
    style.textContent += "#dpc-app .dpc-home-main-tabs .dpc-home-challenge-tab{font-size:clamp(16px,4.7vw,25px);min-width:0;padding-left:0;padding-right:0}";
    style.textContent += "#dpc-app #dpc-home-challenge-panel-1 .dpc-vote-bg-reveal.dpc-bg-instant:after{transition:none!important;opacity:1}#dpc-app #dpc-home-challenge-panel-1 .dpc-vote-bg-reveal.dpc-bg-instant:before{opacity:0!important;transition:none!important}";
    style.textContent += "#dpc-app #dpc-home-challenge-panel-1 .dpc-vote-bg-reveal.dpc-bg-ready:before{opacity:0!important}#dpc-app #dpc-home-challenge-panel-1 .dpc-vote-bg-reveal.dpc-bg-ready:after{opacity:1!important}#dpc-app .dpc-home-submitted-card:before{opacity:0;transition:opacity .45s ease!important}#dpc-app .dpc-home-submitted-card.dpc-bg-ready:before,#dpc-app .dpc-home-submitted-card.dpc-bg-instant:before{opacity:1}#dpc-app .dpc-home-submitted-card.dpc-bg-instant:before{transition:none!important}";
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

    function buildSharedMenu() {
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
        const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n;};
        const link=(a,cls,txt)=>{const n=make('a',cls,txt||clean(a));n.href=safe(a);return n;};
        const menu=make('nav','dpc-home-menu');menu.id='dpc-navigation';menu.setAttribute('aria-label','Site navigation');menu.inert=true;
        const backdrop=make('div','dpc-menu-backdrop');backdrop.setAttribute('aria-hidden','true');
        $('.dpc-header').after(backdrop,menu);
        const menuButton=make('button','dpc-home-menu-button');
        menuButton.type='button';menuButton.setAttribute('aria-controls',menu.id);
        $('.dpc-header-right').append(menuButton);
        let open=false;
        function setMenu(value){
            open=value;root.classList.toggle('dpc-menu-open',open);menu.inert=!open;
            menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');
            menuButton.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">'+(open?'<path d="M6 6l12 12M18 6L6 18"/>':'<path d="M3 8h18M3 16h18"/>')+'</svg>';
        }
        setMenu(false);menuButton.onclick=()=>setMenu(!open);backdrop.onclick=()=>setMenu(false);
        document.addEventListener('keydown',e=>{if(open&&e.key==='Escape'){setMenu(false);menuButton.focus();}});
        menu.addEventListener('click',e=>{if(e.target.closest('a[href]'))setMenu(false);});
        menu.addEventListener('toggle',e=>{if(e.target.tagName==='DETAILS'&&e.target.open&&e.target.parentElement===menu)for(const other of menu.children)if(other!==e.target&&other.tagName==='DETAILS')other.open=false;},true);
        const seen=new Set();
        function menuLink(a){const url=safe(a),name=clean(a);if(!url||!name||seen.has(url))return;seen.add(url);menu.append(link(a));}
        // Read the native menu definitions, or its already-built menu tree.
        function nativeMenu(prefix,count,depth=0){
            if(depth>8)return [];
            const items=[];
            for(let i=1;i<=Math.min(Number(count)||0,200);i++){
                const key=prefix+i,arr=window[key];
                if(!Array.isArray(arr))continue;
                items.push({arr,children:nativeMenu(key+'_',arr[3],depth+1)});
            }
            return items;
        }
        function nativeTree(container,depth=0){
            if(!container||depth>8)return [];
            const items=[];
            for(let m=container.FrstMbr;m&&items.length<200;m=m.PrvMbr){
                if(Array.isArray(m.Arr))items.unshift({arr:m.Arr,children:nativeTree(m.CCn,depth+1)});
            }
            return items;
        }
        function renderNative(items,parent){
            for(const item of items){
                const label=document.createElement('template');
                label.innerHTML=String(item.arr[0]||'');
                const name=clean(label.content);
                if(!name)continue;
                let url='';
                try{if(item.arr[1]){const u=new URL((window.BaseHref||'')+item.arr[1],location.href);if(/^https?:$/.test(u.protocol))url=u.href;}}catch{}
                const tabDestination={'Cast Votes':'vote','View Results':'view','Submit Photos':'submit'}[name];
                if(tabDestination)url=new URL('/challenge_index.php#'+tabDestination,location.href).href;
                const a=url?make('a','',name):null;
                if(a){a.href=url;seen.add(url);}
                if(item.children.length){
                    const group=make('details','dpc-native-menu-group'),summary=make('summary','',a?'':name);
                    if(a){
                        summary.classList.add('dpc-split-summary');
                        a.classList.add('dpc-parent-link');
                        const expand=make('span','dpc-expand-hit',name);
                        summary.append(expand,a);
                        a.textContent='';
                        a.setAttribute('aria-label','Go to '+name);
                        a.title='Go to '+name;
                        a.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
                        summary.setAttribute('aria-label','Expand or collapse '+name);
                        a.addEventListener('click',e=>{e.stopPropagation();});
                        a.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')e.stopPropagation();});
                        a.addEventListener('click',()=>setMenu(false));
                    }
                    group.append(summary);
                    const sub=make('div','dpc-native-menu-children');
                    renderNative(item.children,sub);group.append(sub);parent.append(group);
                }else if(a)parent.append(a);
            }
        }
        const nativeItems=nativeMenu('Menu',window.NoOffFirstLineMenus);
        const tree=nativeItems.length?nativeItems:nativeTree(window.FrstCntnr);
        if(tree.length)renderNative(tree,menu);
        else originalLinks.filter(a=>/^(My Home|Challenges|Community|League|Photos|Equipment|Learn|Help)$/i.test(clean(a))).forEach(menuLink);
        originalLinks.filter(a=>/^(Inbox|Log out|Log in|Register|Private Messaging|Image Search)$/i.test(clean(a))).forEach(menuLink);
        const news=region(newsHead,a=>!!clean(a)&&!!safe(a));if(news) [...news.querySelectorAll('a[href]')].filter(a=>!/^(here|android|ios|click here)$/i.test(clean(a))).forEach(menuLink);
        const inbox=originalLinks.find(a=>/inbox|private messag/i.test(clean(a)));if(inbox)menuLink(inbox);
        if(isHome){
            const destination=[...originalLinks,...menu.querySelectorAll('a[href]')].find(a=>/^(?:my messages|inbox|private messaging|private messages|messages)(?:\s*\(\d+\))?$/i.test(clean(a)))||inbox;
            if(destination&&safe(destination)){
                const icon=make('a','dpc-header-messages');icon.href=safe(destination);
                icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg><span class="dpc-message-dot" aria-hidden="true"></span>';
                function unread(doc){
                    const links=[...doc.querySelectorAll('a[href]')].filter(a=>/inbox|private messag|my messages|new messages|unread messages/i.test(clean(a))||safe(a)===icon.href);
                    for(const a of links){
                        const label=[clean(a),a.title,a.getAttribute('aria-label'),...[...a.querySelectorAll('img')].map(im=>[im.alt,im.title,im.getAttribute('src')].join(' '))].filter(Boolean).join(' ');
                        if(/\b(?:[1-9]\d*\s+(?:new|unread)\s+(?:private\s+)?messages?|(?:new|unread)\s+(?:private\s+)?messages?\s*[:(]\s*[1-9]\d*|(?:inbox|my messages)\s*\([1-9]\d*\)|you have (?:a|one|[1-9]\d*) new (?:private\s+)?messages?)\b/i.test(label)||/(?:new[_-]?(?:pm|msg|message|mail)|(?:pm|msg|message|mail)[_-]?new)\.(?:gif|png|svg)/i.test(label))return true;
                    }
                    const text=(doc.body?.innerText||doc.body?.textContent||'').replace(/\s+/g,' ');
                    return /\b(?:you have\s+(?:a|one|[1-9]\d*)\s+(?:new|unread)\s+(?:private\s+)?messages?|[1-9]\d*\s+(?:new|unread)\s+(?:private\s+)?messages?)\b/i.test(text);
                }
                function update(doc){const active=unread(doc);icon.classList.toggle('unread',active);icon.setAttribute('aria-label',active?'Messages — unread messages':'Messages');icon.title=active?'Unread messages':'Messages';}
                update(document);$('.dpc-header-right').prepend(icon);$('.dpc-header').classList.add('has-messages');
                addEventListener('pageshow',e=>{if(e.persisted)backgroundFetch(location.href,{credentials:'same-origin',cache:'no-cache'}).then(r=>r.ok?r.text():null).then(html=>{if(html)update(new DOMParser().parseFromString(html,'text/html'));}).catch(()=>{});});
            }
        }
        const searchForm=[...document.forms].find(f=>/image.search/i.test(f.action)||/image search/i.test(clean(f)));
        if(searchForm)menu.append(searchForm.cloneNode(true));
        const welcome=(document.body.textContent||'').match(/Welcome back[^\r\n]{0,80}/i);
        if(welcome)menu.prepend(make('div','dpc-home-welcome',welcome[0].split(/\(\s*log out/i)[0].trim()));
        // Mark only destinations actually covered by the userscript's @match paths.
        const supportedPaths=["/challenge_vote_image.php","/challenge_vote_list.php","/","/index.php","/image.php","/challenge_results.php","/profile.php","/challenge_index.php","/challenge_submit.php","/forum.php","/community_index.php"];
        let markerId=0;
        for(const a of menu.querySelectorAll('a[href]')){
            let u;try{u=new URL(a.href,location.href);}catch{continue;}
            if(!/^https?:$/.test(u.protocol)||!/(^|\.)dpchallenge\.com$/i.test(u.hostname)||!supportedPaths.includes(u.pathname))continue;
            const badge=make('span','dpc-restyle-mark');
            badge.title='Restyled for mobile';badge.setAttribute('aria-label','Restyled for mobile');
            const id='dpc-re-shutter-'+(++markerId);
            badge.innerHTML='<svg viewBox="0 0 40 40" aria-hidden="true"><mask id="'+id+'"><circle cx="20" cy="20" r="18.5" fill="white"/><path d="M20 12 L26.928 16 L26.928 24 L20 28 L13.072 24 L13.072 16 Z" fill="black"/>'+[0,60,120,180,240,300].map(angle=>'<path d="M20 12 L41 24.124" stroke="black" stroke-width="2.4" transform="rotate('+angle+' 20 20)"/>').join('')+'</mask><circle cx="20" cy="20" r="18.5" fill="currentColor" mask="url(#'+id+')"/></svg><i aria-hidden="true">re</i>';
            if(a.classList.contains('dpc-parent-link')){const badgeLink=make('a','dpc-restyle-badge-link');badgeLink.href=a.href;badgeLink.setAttribute('aria-label',a.getAttribute('aria-label'));badgeLink.append(badge);badgeLink.addEventListener('click',e=>{e.stopPropagation();setMenu(false);});badgeLink.addEventListener('keydown',e=>{if(e.key==='Enter')e.stopPropagation();});a.before(badgeLink);}else{const name=make('span','dpc-restyle-link-label');while(a.firstChild)name.append(a.firstChild);a.append(name,badge);a.classList.add('dpc-restyled-link');}
        }
    }

    function mount() {
        buildSharedMenu();
        document.body.append(app);
        root.classList.add('dpc-mobile');
        let pressedLink=null,loadingLink=null,feedbackTimer=null,pressPoint=null;
        const linkFrom=e=>{const a=e.target.closest?.('a[href]');if(!a||!app.contains(a)||a.matches('.dpc-brand,.dpc-home-hero'))return null;const u=new URL(a.href,location.href);return /^https?:$/.test(u.protocol)?a:null;};
        function releaseLink(){pressedLink?.classList.remove('dpc-link-pressed');pressedLink=null;pressPoint=null;}
        function clearLinkFeedback(){releaseLink();loadingLink?.classList.remove('dpc-link-loading');loadingLink=null;clearTimeout(feedbackTimer);}
        app.addEventListener('pointerdown',e=>{releaseLink();if(!e.isPrimary||e.button!==0)return;const a=linkFrom(e);if(a){pressedLink=a;pressPoint={x:e.clientX,y:e.clientY};a.classList.add('dpc-link-pressed');}},true);
        app.addEventListener('pointermove',e=>{if(pressPoint&&Math.hypot(e.clientX-pressPoint.x,e.clientY-pressPoint.y)>9)releaseLink();},true);
        for(const event of ['pointerup','pointercancel','lostpointercapture'])app.addEventListener(event,releaseLink,true);
        app.addEventListener('click',e=>{const a=linkFrom(e);if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank'||a.hasAttribute('download'))return;queueMicrotask(()=>{if(e.defaultPrevented||!a.isConnected)return;clearLinkFeedback();loadingLink=a;a.classList.add('dpc-link-loading');feedbackTimer=setTimeout(clearLinkFeedback,10000);});});
        addEventListener('pageshow',clearLinkFeedback);

        if(!/\/challenge_vote_image\.php$/i.test(location.pathname)){
            app.classList.add('dpc-sticky-site-header');
            const stickyHeader=app.querySelector('.dpc-header');
            if(stickyHeader){
                const measureHeader=()=>app.style.setProperty('--dpc-sticky-header-height',stickyHeader.getBoundingClientRect().height+'px');
                measureHeader();
                if(typeof ResizeObserver!=='undefined')new ResizeObserver(measureHeader).observe(stickyHeader);
            }
        }

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
            const shared=sharedPhotoRead(safe(rec.a),rec.src);if(shared){rec.full=shared.full;rec.ratio=shared.ratio;rec.area=shared.area;return;}
            const hit=photoCache[safe(rec.a)];
            if(hit&&hit.thumb===rec.src&&Date.now()-hit.time<30*86400000&&/^https?:\/\//i.test(hit.full)){
                rec.full=hit.full;rec.ratio=hit.ratio;rec.area=hit.area;
            }
        }
        function savePhoto(rec){
            if(!rec.full)return;
            if(rec.area&&rec.ratio)sharedPhotoWrite(safe(rec.a),rec.full,Math.round(Math.sqrt(rec.area/rec.ratio)),Math.round(Math.sqrt(rec.area*rec.ratio)));
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
        const allVoted=votes.length>0&&votes.every(item=>item.progress&&+item.progress[2]>0&&+item.progress[1]>=+item.progress[2]);
        const voteSectionLabel=allVoted?'Open for comments':'Open for voting';
        async function countHomeComments(doc,base,id,total){
            const seen=new Map(),visited=new Set(),queue=[];
            const first=new URL('/challenge_vote_list.php?CHALLENGE_ID='+encodeURIComponent(id),location.origin).href;
            function collect(page,url){
                visited.add(url);
                for(const cell of page.querySelectorAll('.dpc-vote-thumbnail-cell')){
                    const link=cell.querySelector('a[href*="challenge_vote_image.php?IMAGE_ID="]');
                    if(!link||!cell.querySelector('.dpc-vote-thumbnail-image img'))continue;
                    const imageId=new URL(link.getAttribute('href'),url).searchParams.get('IMAGE_ID');
                    if(!imageId)continue;
                    seen.set(imageId,!!cell.querySelector('a[href*="challenge_vote_list_comment.php"] img[src$="/comment.gif"]'));
                }
                for(const link of page.querySelectorAll('a[href]')){
                    if(!link.querySelector('img[src*="/images/page/"]'))continue;
                    const u=new URL(link.getAttribute('href'),url);
                    if(u.origin!==location.origin||u.pathname!=='/challenge_vote_list.php'||u.searchParams.get('CHALLENGE_ID')!==id)continue;
                    u.searchParams.delete('filter');u.hash='';
                    if(!visited.has(u.href)&&!queue.includes(u.href))queue.push(u.href);
                }
            }
            const initial=new URL(base);
            if(initial.pathname==='/challenge_vote_list.php'&&initial.searchParams.get('CHALLENGE_ID')===id&&!initial.searchParams.get('filter'))collect(doc,initial.href);
            else queue.push(first);
            while(queue.length&&seen.size<total){
                const url=queue.shift();if(visited.has(url))continue;
                const response=await backgroundFetch(url,{credentials:'same-origin'});if(!response.ok)throw Error('Comment count unavailable');
                collect(new DOMParser().parseFromString(await response.text(),'text/html'),response.url||url);
            }
            if(seen.size!==total||!total)return null;
            return [...seen.values()].filter(Boolean).length;
        }

        if(!votes.length&&!entries.length)console.warn('DPC homepage: challenge markup not recognised');
        app.innerHTML=header+'<div class="dpc-home"></div>'+footer;
        const body=$('.dpc-home');
        function section(first,last){const sec=make('section');const h=make('h2','',first+' ');h.append(make('em','',last));sec.append(h);body.append(sec);return sec;}
        const submissionChecks=[];
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
                const completed=!!item.progress&&+item.progress[2]>0&&+item.progress[1]>=+item.progress[2];
                const commentStatus=make('span','dpc-home-comment-status','Comments —');
                if(item.progress){const status=make('div','dpc-home-vote-status');status.append(make('span','',item.progress[1]+'/'+item.progress[2]+' rated'));status.append(commentStatus);card.append(status);}
                if(item.progress){const bar=make('div','dpc-home-progress'),fill=make('i','dpc-home-rated-fill'),comments=make('i','dpc-home-comment-fill');fill.style.width=Math.min(100,100*+item.progress[1]/Math.max(1,+item.progress[2]))+'%';comments.style.width='0%';bar.append(fill,comments);card.append(bar);}
                if(voting){
                    card.classList.add('dpc-home-vote-card');
                    const voteKey='dpc-vote-bg-v6-'+(new URL(safe(item.a)).searchParams.get('CHALLENGE_ID')||safe(item.action));
                    let saved={pool:[],images:{},last:null};try{const data=JSON.parse(sessionStorage.getItem(voteKey)||'null');if(data&&Array.isArray(data.pool)&&data.images)saved=data;}catch{}
                    const persist=()=>{try{sessionStorage.setItem(voteKey,JSON.stringify(saved));}catch{}};
                    card.classList.add('dpc-vote-bg-reveal');
                    const set=(src,base)=>{if(!src)return;try{const u=new URL(src,base);if(!/^https?:$/.test(u.protocol))return;card.style.setProperty('--vote-image','url('+JSON.stringify(u.href)+')');return u.href;}catch{}};
                    async function showBlur(src){
                        try{const im=new Image();im.src=src;await im.decode();card.style.setProperty('--vote-blur','url('+JSON.stringify(src)+')');card.classList.add('dpc-bg-preview');}catch{}
                    }
                    async function revealBg(src,known=false){
                        const im=new Image();im.src=src;
                        const immediate=im.complete&&im.naturalWidth>0;
                        await im.decode().catch(()=>{if(!im.complete||!im.naturalWidth)throw Error('Image unavailable');});
                        if(!set(src,safe(item.action)))throw Error('Invalid background');
                        if(immediate){card.classList.add('dpc-bg-instant','dpc-bg-ready');return;}
                        if(!card.classList.contains('dpc-bg-preview')){card.style.setProperty('--vote-blur','url('+JSON.stringify(src)+')');card.classList.add('dpc-bg-preview');}
                        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                        if(!reducedMotion.matches)await sleep(100);
                        card.classList.add('dpc-bg-ready');
                    }
                    let picked=false;
                    async function pickBackground(pool){
                        if(picked||!pool.length)return;
                        picked=true;
                        const alternatives=pool.filter(x=>x.thumb!==saved.last);
                        const choices=alternatives.length?alternatives:pool;
                        const photo=choices[Math.floor(Math.random()*choices.length)];
                        saved.last=photo.thumb;persist();
                        if(saved.images[photo.thumb]){
                            try{await revealBg(saved.images[photo.thumb],true);return;}catch{delete saved.images[photo.thumb];persist();}
                        }
                        const blurred=showBlur(photo.thumb);
                        let candidate=photo.thumb;
                        if(photo.entry)try{
                            const entryUrl=new URL(photo.entry,location.origin);
                            const imageId=entryUrl.searchParams.get('IMAGE_ID');
                            const target=imageId?imageURL(imageId):entryUrl.href;
                            const full=await interactiveFetch(target,{credentials:'same-origin'},true);
                            if(full.ok){
                                const doc=new DOMParser().parseFromString(await full.text(),'text/html');
                                const img=doc.querySelector('img.dpc-vote-primary-image,.dpc-vote-primary-image img,form[name="frmVote"] img#image, img#main_image');
                                if(img?.getAttribute('src'))candidate=new URL(img.getAttribute('src'),full.url||target).href;
                            }
                        }catch{}
                        for(const url of new Set([candidate,photo.thumb])){
                            try{await blurred;await revealBg(url);if(url!==photo.thumb){saved.images[photo.thumb]=url;persist();}break;}catch{}
                        }
                    }
                    if(saved.pool.length)pickBackground(saved.pool).catch(()=>{});
                    async function loadVoteImage(){
                        const challengeId=new URL(safe(item.a)).searchParams.get('CHALLENGE_ID');
                        const listUrl=challengeId?new URL('/challenge_vote_list.php?CHALLENGE_ID='+encodeURIComponent(challengeId),location.origin).href:safe(item.action);
                        const response=await interactiveFetch(listUrl,{credentials:'same-origin'});if(!response.ok)return;
                        const doc=new DOMParser().parseFromString(await response.text(),'text/html');
                        const id=new URL(safe(item.a)).searchParams.get('CHALLENGE_ID')||new URL(safe(item.action)).searchParams.get('CHALLENGE_ID');
                        if(id&&item.progress)countHomeComments(doc,response.url||safe(item.action),id,+item.progress[2]).then(n=>{
                            if(n===null)return;
                            commentStatus.textContent=n+'/'+item.progress[2]+' commented';
                            if(completed){const action=card.querySelector('.dpc-home-action');if(action)action.textContent=n===0?'Start commenting':'Continue commenting';}
                            const fill=card.querySelector('.dpc-home-comment-fill');if(fill)fill.style.width=(100*n/+item.progress[2])+'%';
                        }).catch(()=>{});
                        const images=[...doc.querySelectorAll('.dpc-vote-thumbnail-image img,.dpc-vote-primary-image,.dpc-vote-thumbnail-cell img[src],a[href*="challenge_vote_image.php"] img[src]')].filter(im=>{const src=im.getAttribute('src')||'';return src&&!/spacer|pixel|pix\\.gif|logo|ribbon|removed\\.png/i.test(src);});
                        if(!images.length)return;
                        const ranked=images.map(image=>({image,rating:Number(image.closest('.dpc-vote-thumbnail-cell')?.querySelector('a.vs')?.textContent.trim())||0})).filter(x=>x.rating>0).sort((a,b)=>b.rating-a.rating).slice(0,10);
                        const pool=ranked.length?ranked.map(x=>x.image):images;
                        const unique=new Map();
                        for(const image of pool){
                            const thumb=new URL(image.getAttribute('src'),response.url).href;
                            const entry=image.matches('.dpc-vote-primary-image')?null:image.closest('a[href*="challenge_vote_image.php"][href*="IMAGE_ID="]')||image.closest('.dpc-vote-thumbnail-cell')?.querySelector('a[href*="challenge_vote_image.php"][href*="IMAGE_ID="]')||image.closest('td')?.querySelector('a[href*="challenge_vote_image.php"][href*="IMAGE_ID="]');
                            unique.set(thumb,{thumb,entry:entry?new URL(entry.getAttribute('href'),response.url).href:null});
                        }
                        saved.pool=[...unique.values()];persist();
                        await pickBackground(saved.pool);
                    }
                    const voteObserver=new IntersectionObserver(items=>{if(items.some(x=>x.isIntersecting)){voteObserver.disconnect();loadVoteImage().catch(()=>{});}},{rootMargin:'300px'});voteObserver.observe(card);
                }
                if(voting){
                    const action=link(item.action,'dpc-home-action',completed?'Continue commenting':item.progress&&+item.progress[1]===0?'Start voting':'Continue voting');
                    card.append(action);
                    card.style.cursor='pointer';
                    const titleLink=title.querySelector('a');if(titleLink)titleLink.href=action.href;
                    card.addEventListener('click',e=>{
                        if(e.defaultPrevented||e.target.closest('a,button,input,select,textarea')||window.getSelection()?.toString())return;
                        if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
                        location.href=action.href;
                    });
                }
                if(!voting){
                    const id=new URL(safe(item.a)).searchParams.get('CHALLENGE_ID')||new URL(safe(item.action)).searchParams.get('CHALLENGE_ID');
                    if(id){
                        const destination=new URL('/challenge_submit.php?CHALLENGE_ID='+encodeURIComponent(id),location.origin).href;
                        card.href=destination;
                        async function checkSubmission(){
                            const response=await interactiveFetch(destination,{credentials:'same-origin'},true);if(!response.ok)return;
                            const doc=new DOMParser().parseFromString(await response.text(),'text/html');
                            const form=doc.querySelector('form[name="frmSubmit"]');
                            const image=doc.querySelector('a[href*="challenge_submit_preview.php"] img');
                            if(!form?.querySelector('input[name="IMAGE_ID"][value]')||!form.querySelector('[name="SubmitUpdate"]'))return;
                            card.classList.add('dpc-home-vote-card','dpc-home-submitted-card');
                            const status=make('div','dpc-home-submitted-status','✓ Entry submitted');card.append(status);
                            card.append(make('span','dpc-home-action','Edit entry'));
                            if(image){
                                const url=new URL(image.getAttribute('src'),response.url||destination);
                                if(url.origin===location.origin&&url.pathname.endsWith('/challenge_submit_readimage.php')){
                                    url.searchParams.set('TYPE','/');
                                    const originalUrl=new URL(image.getAttribute('src'),response.url||destination).href;
                                    (async()=>{for(const src of new Set([url.href,originalUrl])){try{const preload=new Image();preload.src=src;const immediate=preload.complete&&preload.naturalWidth>0;await preload.decode();card.style.setProperty('--vote-image','url('+JSON.stringify(src)+')');card.classList.add(immediate?'dpc-bg-instant':'dpc-bg-ready');return;}catch{}}})();
                                }
                            }
                        }
                        card.style.visibility='hidden';
                        submissionChecks.push(checkSubmission().catch(()=>{}).finally(()=>{card.style.visibility='';}));
                    }
                }
                grid.append(card);if(i>=limit){card.hidden=true;hidden.push(card);}
            });
            if(hidden.length){const b=make('button','dpc-home-more','View all '+items.length);b.onclick=()=>{hidden.forEach(c=>c.hidden=false);b.remove();};sec.append(b);}
        }
        const votingSection=section('Open for',allVoted?'comments':'voting');
        if(votes.length)cards(votes,votingSection,true,Infinity);
        else if(voteHead){const area=region(voteHead,a=>!!safe(a));if(area)votingSection.append(area.cloneNode(true));}
        if(votingSection.children.length===1)votingSection.append(make('p','dpc-home-meta','No challenges open for voting.'));
        let resultsSection=null;
        const entrySection=section('Open for','entries');
        if(entries.length){cards(entries,entrySection,false,Infinity);const grid=entrySection.querySelector('.dpc-entry-grid');if(grid){grid.style.visibility='hidden';Promise.allSettled(submissionChecks).then(()=>{const ordered=[...grid.children];for(const card of ordered.filter(c=>c.classList.contains('dpc-home-submitted-card')))grid.append(card);for(const card of ordered.filter(c=>!c.classList.contains('dpc-home-submitted-card')))grid.append(card);grid.style.visibility='';});}}
        else if(entryHead){const area=region(entryHead,a=>!!safe(a));if(area)entrySection.append(area.cloneNode(true));}
        if(entrySection.children.length===1)entrySection.append(make('p','dpc-home-meta','No challenges open for entries.'));
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
            const sec=section('Recent','results');resultsSection=sec;body.prepend(sec);
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
                if(name){
                    const headingContent=titleLink?link(titleLink,'',name):h;
                    headingContent.textContent='';
                    const words=name.trim().split(/\s+/);
                    if(words.length>1){const roman=/^[IVXLCDM]+$/.test(words.at(-1));const split=Math.max(1,words.length-(roman&&words.length>2?2:1));headingContent.append(words.slice(0,split).join(' ')+' ',make('em','',words.slice(split).join(' ')));}else headingContent.textContent=name;
                    if(titleLink)h.append(headingContent);
                }
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
                registerGallery(grid,'Homepage results',()=>records.map(rec=>({href:safe(rec.a),src:rec.full||rec.src,title:rec.title})),name);
                records.forEach(cachedPhoto);
                let serial=0,selected=-1,selectionToken=0;
                const dimensions=()=>{const w=hero.clientWidth;if(!w)return;hero.style.setProperty('--hero-height',Math.min(innerHeight*.6,w)+'px');};
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
                    rec.promise=interactiveFetch(safe(rec.a),{credentials:'same-origin'}).then(r=>r.ok?r.text():'').then(async html=>{
                        const doc=new DOMParser().parseFromString(html,'text/html');
                        const file=new URL(rec.src,location.href).pathname.split('/').pop();
                        const candidates=[...doc.images].filter(x=>{const src=x.getAttribute('src')||'';return src&&!/thumb|ribbon|logo|avatar|banner|spacer/i.test(src);});
                        const same=candidates.filter(x=>{try{return new URL(x.getAttribute('src'),safe(rec.a)).pathname.split('/').pop()===file;}catch{return false;}});
                        const preferred=doc.querySelector('.dpc-vote-primary-image, img#image, img#main_image');
                        const picks=preferred?[preferred]:same.length?same:candidates.filter(x=>/\/(?:image|images|photo|photos)\//i.test(x.getAttribute('src')||'')&&(+x.getAttribute('width')>=400||+x.getAttribute('height')>=400));
                        await Promise.all(picks.slice(0,4).map(candidate=>new Promise(resolve=>{
                            const url=new URL(candidate.getAttribute('src'),safe(rec.a)).href;const probe=new Image();
                            probe.onload=()=>{const area=probe.naturalWidth*probe.naturalHeight;if(photoFilename(url)===file&&area>Math.max(rec.area||0,40000)){rec.area=area;rec.full=url;rec.probe=probe;rec.ratio=probe.naturalHeight/probe.naturalWidth;savePhoto(rec);}resolve();};probe.onerror=resolve;probe.src=url;
                        })));
                    }).catch(()=>{});
                    return rec.promise;
                }
                function composeCredit(){composeEditorialCredit(credits,featureTitle,featureAuthor);}
                async function select(i){
                    if(i<0||i>=records.length)return;
                    const token=++selectionToken,rec=records[i],direction=selected<0?0:Math.sign(i-selected);
                    // Commit the swipe immediately using the already available thumbnail; upgrade asynchronously.
                    if(token!==selectionToken)return;
                    selected=i;hero.href=safe(rec.a);heroImg.src=rec.probe?.complete&&rec.probe.naturalWidth&&rec.full?rec.full:rec.src;heroImg.alt=rec.title;heroImg.onerror=()=>{if(selected===i&&heroImg.src!==rec.src){heroImg.src=rec.src;preload(rec).then(()=>{if(selected===i&&rec.full)heroImg.src=rec.full;});}};
                    centre.querySelector('svg')?.remove();refreshAdjacent();
                    featureTitle.href=hero.href;editorialTypeset(featureTitle,rec.title,direction,false);
                    featureAuthor.hidden=!rec.author;if(rec.author){featureAuthor.href=safe(rec.author);featureAuthor.textContent='by '+clean(rec.author);const award=ribbon(i);if(award){award.classList.add('dpc-caption-ribbon');featureAuthor.prepend(award);}}
                    composeCredit();
                    if(!reducedMotion.matches)featureTitle.querySelectorAll('.dpc-title-part').forEach((part,j)=>part.animate([{opacity:0,transform:'translateX('+(direction*20)+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:420,delay:j*105,fill:'both',easing:'cubic-bezier(.16,1,.3,1)'}));
                    if(!reducedMotion.matches)featureAuthor.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,delay:140,fill:'both'});
                    [...strip.children].forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));
                    
                    preload(rec).then(()=>{if(selected===i&&rec.full&&heroImg.src!==rec.full)heroImg.src=rec.full;});
                }
                function refreshAdjacent(){
                    [[before,selected-1],[after,selected+1]].forEach(([slide,i])=>{
                        slide.replaceChildren();const rec=records[i];if(!rec)return;
                        const img=make('img');img.src=rec.probe?.complete&&rec.probe.naturalWidth&&rec.full?rec.full:rec.src;img.alt=rec.title;img.draggable=false;slide.append(img);
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
                let fittedWidth=0;const init=(force=false)=>{const w=hero.clientWidth;if(!w)return;dimensions();if(!force&&w===fittedWidth)return;fittedWidth=w;editorialTypeset(featureTitle,records[selected<0?0:selected].title,0,false);composeCredit();};
                const ro=new ResizeObserver(()=>init());ro.observe(hero);
                document.fonts?.ready.then(()=>init(true));
                records.forEach(rec=>{if(!rec.img.complete)rec.img.addEventListener('load',dimensions,{once:true});});
                const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){io.disconnect();records.forEach(preload);}},{rootMargin:'700px'});io.observe(card);
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
        if(!resultsSection){resultsSection=section('Recent','results');resultsSection.append(make('p','dpc-home-meta','No recent results available.'));}
        const forum=region(forumHead,a=>/forum.*(?:THREAD_ID|thread)/i.test(safe(a)));
        const forumSection=section('Community','talk');
        if(forum){
            const sec=forumSection,hidden=[],seenThreads=new Set();
            for(const a of forum.querySelectorAll('a[href]')){
                const url=safe(a);if(!/forum.*(?:THREAD_ID|thread)/i.test(url)||!clean(a)||seenThreads.has(url))continue;
                seenThreads.add(url);
                const n=make('article','dpc-home-thread');
                const row=a.closest('tr'),cell=a.closest('td');
                const cells=row?[...row.cells]:[],idx=cells.indexOf(cell);
                const meta=idx>=0?cells.slice(idx+1).map(clean):[];
                const title=link(a,'dpc-thread-title');
                if(meta.length>=3){
                    const category=cells[idx+2]?.querySelector('a[href*="FORUM_SECTION_ID"]');
                    n.append(category?link(category,'dpc-thread-category'):make('span','dpc-thread-category',meta[1]),title);
                    const details=make('span','dpc-thread-details');
                    details.append(make('span','dpc-thread-author',meta[0]),make('span','dpc-thread-time',meta.slice(2).join(' ')));n.append(details);
                }else{
                    n.append(title);if(row)n.append(make('small','',clean(row).replace(clean(a),'').trim()));
                }
                sec.append(n);
                if(seenThreads.size>8){n.hidden=true;hidden.push(n);}
            }
            if(hidden.length){const b=make('button','dpc-home-more','Load more');b.onclick=()=>{hidden.forEach(n=>n.hidden=false);b.remove();};sec.append(b);}
        }
        if(forumSection.children.length===1)forumSection.append(make('p','dpc-home-meta','No recent forum threads available.'));
        const tabs=make('div','dpc-home-challenge-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Challenges');
        tabs.classList.add('dpc-home-main-tabs');
        body.prepend(tabs,resultsSection,votingSection,entrySection,forumSection);
        const panels=[resultsSection,votingSection,entrySection,forumSection],buttons=[];
        const labels=['Results',allVoted?'Comment':'Vote','Enter','Forum'];
        panels.forEach((panel,i)=>{
            panel.id='dpc-home-challenge-panel-'+i;panel.setAttribute('role','tabpanel');
            const button=make('button','dpc-home-challenge-tab');const words=labels[i].split(' ');button.append(words.slice(0,-1).join(' ')+' ',make('em','',words.at(-1)));button.type='button';button.id='dpc-home-challenge-tab-'+i;button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);panel.setAttribute('aria-labelledby',button.id);panel.firstElementChild.hidden=true;
            tabs.append(button);buttons.push(button);button.onclick=()=>selectHomeTab(i);
            button.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?panels.length-1:(i+(e.key==='ArrowLeft'?-1:1)+panels.length)%panels.length;selectHomeTab(next);buttons[next].focus();}};
        });
        const viewport=make('div','dpc-home-carousel'),track=make('div','dpc-home-carousel-track');
        tabs.after(viewport);viewport.append(track);panels.forEach(panel=>{panel.hidden=false;track.append(panel);});
        let selectedTab=0;try{const saved=Number(sessionStorage.getItem('dpc-home-challenge-tab'));if(Number.isInteger(saved)&&saved>=0&&saved<panels.length)selectedTab=saved;}catch{}
        let gesture=null,suppressClickUntil=0,settleTimer=null;
        const motion=matchMedia('(prefers-reduced-motion: reduce)');
        function fitHeight(dragging=false){
            const heights=panels.map(p=>p.getBoundingClientRect().height);
            const height=dragging&&gesture?.axis==='x'?Math.max(heights[selectedTab],heights[Math.max(0,Math.min(panels.length-1,selectedTab+(gesture.dx<0?1:-1))) ]):heights[selectedTab];
            if(height>0)viewport.style.height=Math.ceil(height)+'px';
        }
        function positionHome(dx=0,animate=false){
            track.style.transition=animate&&!motion.matches?'transform 280ms cubic-bezier(.22,.75,.25,1)':'none';
            const w=viewport.clientWidth;
            if(!w)return;
            track.style.width=(w*panels.length)+'px';
            panels.forEach(panel=>{panel.style.width=w+'px';panel.style.minWidth=w+'px';panel.style.maxWidth=w+'px';panel.style.flexBasis=w+'px';});
            track.style.transform='translate3d('+(-selectedTab*w+dx)+'px,0,0)';
        }
        function selectHomeTab(index,animate=true){
            clearTimeout(settleTimer);gesture=null;
            selectedTab=Math.max(0,Math.min(panels.length-1,index));
            panels.forEach((panel,i)=>{panel.hidden=false;panel.inert=i!==selectedTab;panel.setAttribute('aria-hidden',String(i!==selectedTab));buttons[i].classList.toggle('active',i===selectedTab);buttons[i].setAttribute('aria-selected',String(i===selectedTab));buttons[i].tabIndex=i===selectedTab?0:-1;});
            positionHome(0,animate);
            if(animate&&!motion.matches){fitHeight();settleTimer=setTimeout(()=>fitHeight(),290);}else fitHeight();
            try{sessionStorage.setItem('dpc-home-challenge-tab',String(selectedTab));}catch{}
        }
        viewport.addEventListener('touchstart',e=>{
            if(e.touches.length!==1||e.target.closest('.dpc-home-hero,.dpc-results-rail,input,textarea,select,[contenteditable]'))return;
            const t=e.touches[0];gesture={id:t.identifier,x:t.clientX,y:t.clientY,dx:0,axis:null,time:performance.now()};
        },{passive:true});
        viewport.addEventListener('touchmove',e=>{
            if(!gesture||e.touches.length!==1){if(gesture){gesture=null;positionHome(0,true);fitHeight();}return;}
            const t=e.touches[0];if(t.identifier!==gesture.id)return;
            const dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
            if(!gesture.axis){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;gesture.axis=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';}
            if(gesture.axis!=='x')return;
            if(e.cancelable)e.preventDefault();
            gesture.dx=dx;
            const w=viewport.clientWidth;
            const offset=(selectedTab===0&&dx>0||selectedTab===panels.length-1&&dx<0)?dx*.18:Math.max(-w,Math.min(w,dx));
            positionHome(offset);fitHeight(true);
        },{passive:false});
        function finishHomeSwipe(cancel=false){
            if(!gesture)return;
            const g=gesture;gesture=null;
            if(g.axis!=='x')return;
            suppressClickUntil=performance.now()+350;
            const distance=Math.abs(g.dx),speed=distance/Math.max(1,performance.now()-g.time);
            const advance=!cancel&&(distance>viewport.clientWidth*.25||(distance>35&&speed>.45));
            selectHomeTab(selectedTab+(advance?(g.dx<0?1:-1):0));
        }
        viewport.addEventListener('touchend',()=>finishHomeSwipe(),{passive:true});
        viewport.addEventListener('touchcancel',()=>finishHomeSwipe(true),{passive:true});
        viewport.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();} },true);
        let lastHomeWidth=0;
        const homeResize=new ResizeObserver(()=>{
            if(viewport.clientWidth!==lastHomeWidth){lastHomeWidth=viewport.clientWidth;positionHome(gesture?.axis==='x'?gesture.dx:0);}
            fitHeight(!!gesture&&gesture.axis==='x');
        });panels.forEach(p=>homeResize.observe(p));homeResize.observe(viewport);
        selectHomeTab(selectedTab,false);
        requestAnimationFrame(()=>fitHeight());
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
                'a[href*="challenge_vote_list_comment.php"] img[src$="/comment.gif"]'
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

                    const response = await backgroundFetch(url,{
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
                        const comment = cell.querySelector('a[href*="challenge_vote_list_comment.php"] img[src$="/comment.gif"]');

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
                    card.querySelector('.dpc-thumb-comment')?.remove();
                    if(entry.commented){
                        const badge=document.createElement('span');
                        badge.className='dpc-thumb-comment';
                        badge.innerHTML=commentIcon+'<span>Commented</span>';
                        card.append(badge);
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



    function buildChallengeResults(){
        const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
        const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
        const initial=new URL(location.href),challengeId=initial.searchParams.get('CHALLENGE_ID');
        if(!challengeId)return;
        const url=(raw,base)=>{try{const u=new URL(raw,base);return /^https?:$/.test(u.protocol)?u:null;}catch{return null;}};
        function imageID(a,base){const u=url(a.getAttribute('href'),base);return u&&/\/image\.php$/i.test(u.pathname)?u.searchParams.get('IMAGE_ID'):null;}
        function parse(doc,base){
            const entries=[];
            for(const table of doc.querySelectorAll('table.dpc-challenge-results')){
                for(const row of table.rows){
                    const thumb=row.querySelector(':scope > td.dpc-result-thumb');
                    if(!thumb)continue;
                    const photo=thumb.querySelector('img[src]'),link=thumb.querySelector('a[href*="image.php"]');
                    const id=link&&imageID(link,base);
                    if(!id)continue; // Removed images have no public photograph link.
                    const titleLink=[...row.querySelectorAll('a[href*="image.php"]')].find(l=>imageID(l,base)===id&&clean(l.textContent)&&!l.querySelector('img'));
                    const author=row.querySelector('a[href*="profile.php"]');
                    const text=clean(row.textContent);
                    const place=text.match(/\b(\d+(?:st|nd|rd|th))\s+place\b/i)?.[1];
                    const score=text.match(/average\s+vote\s+of\s+(\d+(?:\.\d+)?)/i)?.[1];
                    const photoUrl=photo&&url(photo.getAttribute('src'),base),href=link&&url(link.getAttribute('href'),base),authorUrl=author&&url(author.getAttribute('href'),base);
                    if(!titleLink||!photoUrl||!href)continue;
                    const values={};
                    for(const bold of row.querySelectorAll('b')){
                        const before=clean(bold.previousSibling?.textContent);
                        if(/Your Vote:$/i.test(before))values.own=clean(bold.textContent);
                        if(/Your Comment:$/i.test(before))values.comment=clean(bold.textContent);
                        if(/Average Vote \(Participants\):$/i.test(before))values.participants=clean(bold.textContent);
                        if(/Average Vote \(Non-Participants\):$/i.test(before))values.nonparticipants=clean(bold.textContent);
                    }
                    const views=text.match(/\bViews:\s*([\d,]+)/i)?.[1],during=text.match(/\(([\d,]+)\s+during voting\)/i)?.[1],votes=text.match(/\bVotes:\s*([\d,]+)/i)?.[1];
                    entries.push({id,title:clean(titleLink.textContent),author:clean(author?.textContent),authorUrl:authorUrl?.href,href:href.href,src:photoUrl.href,place,score,views,during,votes,...values});
                }
            }
            return entries;
        }
        const first=parse(document,initial.href);
        // Never hide the original if a different native layout cannot be parsed.
        if(!first.length)return;
        const name=document.title.replace(/\s+Challenge Results.*$/i,'').trim()||'Challenge results';
        const sidebar=document.querySelector('#gallery')?.closest('td');
        const nativeText=clean(sidebar?.textContent||document.body.textContent);
        const rules=nativeText.match(/An?\s+(.+?Challenge)\s+using\s+the\s+(.+?Editing)\s+rules/i);
        const metadata=nativeText.match(/(?:Challenge Description\s*)?Description\s+(.+?)\s+Submission Dates:/i)?.[1];
        const labels=['Submissions','Disqualifications','Votes','Comments','Average Score','Highest Score','Median Score','Lowest Score'];
        const details=labels.map(label=>[label,nativeText.match(new RegExp('\\b'+label+':\\s*([\\d,.]+)','i'))?.[1]]).filter(x=>x[1]);
        const dates=['Submission Dates','Voting Dates'].map(label=>[label,nativeText.match(new RegExp(label+':\\s*(\\w{3}\\s+\\d{1,2}\\s+\\d{4}\\s*-\\s*\\w{3}\\s+\\d{1,2}\\s+\\d{4})','i'))?.[1]]).filter(x=>x[1]);
        const total=details.find(([label])=>label==='Submissions')?.[1];
        const queue=[],queued=new Set(),visited=new Set(),seen=new Set();
        function normalize(u){u.hash='';u.searchParams.sort();return u.href;}
        visited.add(normalize(new URL(initial.href)));
        function enqueue(doc,base){
            for(const a of doc.querySelectorAll('a[href]')){
                const u=url(a.getAttribute('href'),base);
                if(!u||u.origin!==initial.origin||u.pathname!==initial.pathname||u.searchParams.get('CHALLENGE_ID')!==challengeId)continue;
                const pagination=a.querySelector('img[src*="/images/page/"]')||/\b(next|previous|page\s+\d+)\b/i.test(clean(a.textContent))||/^\d+$/.test(clean(a.textContent));
                if(!pagination)continue;
                const key=normalize(u);if(visited.has(key)||queued.has(key))continue;
                queued.add(key);queue.push(key);
            }
            // Native links are normally in ascending page order.
            const pageNumber=u=>{const q=new URL(u).searchParams;return Number(q.get('page')||q.get('PAGE')||q.get('PAGE_ID')||q.get('page_id')||0);};
            queue.sort((a,b)=>pageNumber(a)-pageNumber(b));
        }
        enqueue(document,initial.href);
        app.innerHTML=header;
        const main=make('main','dpc-list-content dpc-results-page');app.append(main);
        const kicker=make('div','dpc-list-edition',rules?rules[1]+' · '+rules[2]:'Challenge results');main.append(kicker);
        const h=make('h1','dpc-list-title');const words=name.split(/\s+/),split=Math.ceil(words.length/2);h.append(words.slice(0,split).join(' '));if(words.length>1)h.append(make('em','',words.slice(split).join(' ')));main.append(h);
        if(metadata&&metadata.length<2000)main.append(make('p','dpc-results-description',metadata));
        const info=make('details','dpc-details dpc-results-details');info.append(make('summary','','Challenge details & statistics'));
        const dl=make('dl','dpc-detail-fields');for(const [label,value] of [...dates,...details])dl.append(make('dt','',label),make('dd','',value));info.append(dl);main.append(info);
        const sort=make('div','dpc-results-sort');
        const byRank=new URL(initial.href);byRank.searchParams.delete('order_by_vote');byRank.searchParams.delete('page');
        const byVote=new URL(byRank.href);byVote.searchParams.set('order_by_vote','1');
        for(const [label,target,active] of [['Overall results',byRank,!initial.searchParams.get('order_by_vote')],['My vote',byVote,!!initial.searchParams.get('order_by_vote')]]){const a=make('a','dpc-results-sort-link'+(active?' active':''),label);a.href=target.href;sort.append(a);}main.append(sort);
        const top=make('div','dpc-group-heading');top.append(make('span','dpc-group-name','Results'));const count=make('span','dpc-group-count');top.append(count);main.append(top);
        const grid=make('div','dpc-challenge-results-grid');main.append(grid);
        const sentinel=make('button','dpc-infinite-sentinel','Load more photographs');sentinel.type='button';main.append(sentinel);
        main.insertAdjacentHTML('beforeend',footer);
        const stateKey='dpc-results-scroll-'+initial.pathname+initial.search;
        const fullQueue=[];let fullActive=0;
        async function upgrade(entry,image){
            const key='dpc-result-full-v3-'+entry.id;
            let cached=sharedPhotoRead(entry.href,entry.src)?.full||null;try{cached=cached||sessionStorage.getItem(key);}catch{}
            const apply=src=>new Promise(resolve=>{
                if(new URL(src,entry.href).pathname.split('/').pop()!==new URL(entry.src,entry.href).pathname.split('/').pop()){resolve(false);return;}
                const probe=new Image();
                probe.onload=()=>{if(image.isConnected){image.src=src;image.width=probe.naturalWidth;image.height=probe.naturalHeight;}try{sessionStorage.setItem(key,src);}catch{}sharedPhotoWrite(entry.href,src,probe.naturalWidth,probe.naturalHeight);resolve(true);};
                probe.onerror=()=>resolve(false);probe.src=src;
            });
            if(cached&&await apply(cached))return;
            const response=await backgroundFetch(entry.href,{credentials:'same-origin'});if(!response.ok)return;
            const template=document.createElement('template');template.innerHTML=await response.text();
            const photo=[...template.content.querySelectorAll('#img_container img[src]')].find(im=>new URL(im.getAttribute('src'),response.url).pathname.split('/').pop()===new URL(entry.src).pathname.split('/').pop());
            if(photo?.getAttribute('src')){const src=url(photo.getAttribute('src'),response.url);if(src)await apply(src.href);}
        }
        function pumpFull(){while(fullActive<1&&fullQueue.length&&!document.hidden&&!backgroundBlocked()){const [entry,image]=fullQueue.shift();fullActive++;upgrade(entry,image).catch(()=>{}).finally(()=>{fullActive--;pumpFull();});}}
        const fullObserver=new IntersectionObserver(records=>{for(const record of records){if(!record.isIntersecting)continue;fullObserver.unobserve(record.target);fullQueue.push([record.target.dpcResultEntry,record.target]);}pumpFull();},{rootMargin:'200px 0px'});
        document.addEventListener('visibilitychange',()=>{if(!document.hidden)pumpFull();});
        let loading=false,failed=false,restore=null;
        try{restore=JSON.parse(sessionStorage.getItem(stateKey)||'null');sessionStorage.removeItem(stateKey);}catch{}
        function remember(){try{sessionStorage.setItem(stateKey,JSON.stringify({count:seen.size,y:scrollY}));}catch{}}
        const resultManifest=[];
        registerGallery(grid,'Challenge results',()=>({entries:resultManifest,queue:queue.slice(),visited:[...visited]}),name);
        function saveManifest(){if(initial.searchParams.has('order_by_vote'))return;try{sessionStorage.setItem('dpc-detail-manifest-v1',JSON.stringify({time:Date.now(),entries:resultManifest.slice(0,500)}));}catch{}}
        function append(entries){
            const fragment=document.createDocumentFragment();
            for(const entry of entries){
                if(seen.has(entry.id))continue;seen.add(entry.id);resultManifest.push({href:entry.href,src:entry.src,title:entry.title});
                const card=make('article','dpc-result-photo-card');const photoLink=make('a','dpc-result-photo-link');photoLink.href=entry.href;photoLink.onclick=remember;
                const image=make('img');image.loading='lazy';image.decoding='async';image.alt=entry.title;image.src=entry.src;image.dpcResultEntry=entry;photoLink.append(image);card.append(photoLink);fullObserver.observe(image);
                const caption=make('div','dpc-result-photo-caption');card.append(caption);
                const titleLink=make('a','dpc-result-photo-title');titleLink.href=entry.href;titleLink.onclick=remember;caption.append(titleLink);
                const titleWords=entry.title.split(/\s+/);if(titleWords.length>1){titleLink.append(titleWords.slice(0,-1).join(' ')+' ');titleLink.append(make('em','',titleWords.at(-1)));}else titleLink.textContent=entry.title;
                const meta=make('div','dpc-result-photo-meta');caption.append(meta);
                const credit=make('div','dpc-result-photo-author');const ribbon=detailRibbon(parseInt(entry.place,10)-1);if(ribbon){ribbon.classList.add('dpc-caption-ribbon');credit.append(ribbon);}
                const author=make(entry.authorUrl?'a':'span','','by '+entry.author);if(entry.authorUrl)author.href=entry.authorUrl;credit.append(author);meta.append(credit);
                const result=make('span','dpc-result-photo-score');if(entry.place)result.append(make('span','dpc-detail-caption-rank',entry.place));if(entry.score){if(entry.place)result.append(make('span','dpc-detail-caption-slash','/'));result.append(make('span','dpc-detail-caption-average',entry.score+' avg'));}caption.append(result);
                const stats=make('dl','dpc-result-row-stats');for(const [label,value] of [['Views',[entry.views,entry.during].filter(Boolean).length? [entry.views,entry.during].filter(Boolean).reduce((sum,n)=>sum+Number(n.replace(/,/g,'')),0).toLocaleString('en-GB'):null],['Votes',entry.votes],['Your vote',entry.own]]){if(value&&value!=='N/A')stats.append(make('dt','',label),make('dd',label==='Your vote'?'dpc-result-own-vote':'',value));}caption.append(stats);
                if(entry.comment&&entry.comment!=='N/A'){const comment=make('div','dpc-result-own-comment');comment.append(make('span','','Your comment'),make('p','',entry.comment));caption.append(comment);}
                fragment.append(card);
            }
            grid.append(fragment);saveManifest();count.textContent=total?total+' photographs':'Challenge photographs';
        }
        function status(){sentinel.hidden=!queue.length&&!loading&&!failed;sentinel.disabled=loading;sentinel.textContent=loading?'Loading more photographs…':failed?'Retry loading photographs':'Load more photographs';}
        async function more(){
            if(loading||!queue.length)return;
            loading=true;failed=false;status();
            const next=queue.shift();queued.delete(next);
            try{
                const response=await backgroundFetch(next,{credentials:'same-origin'});if(!response.ok)throw Error('Results unavailable');
                const doc=new DOMParser().parseFromString(await response.text(),'text/html');
                const records=parse(doc,response.url);if(!records.length)throw Error('No results found');
                visited.add(next);visited.add(normalize(new URL(response.url)));append(records);enqueue(doc,response.url);
            }catch(error){queue.unshift(next);queued.add(next);failed=true;console.warn('DPC challenge results:',error);}
            finally{loading=false;status();}
        }
        sentinel.onclick=more;
        $('#dpc-original').onclick=()=>original();
        mount();append(first);status();
        const observer=new IntersectionObserver(async entries=>{
            if(entries.some(e=>e.isIntersecting)&&!failed&&!restore){await more();if(queue.length&&!failed&&sentinel.getBoundingClientRect().top<innerHeight+500){observer.unobserve(sentinel);observer.observe(sentinel);}}
        },{rootMargin:'500px 0px'});observer.observe(sentinel);
        if(restore){(async()=>{while(queue.length&&seen.size<restore.count&&!failed)await more();const y=restore.y;restore=null;requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'}));})();}
    }

    let detailRibbonSerial=0;
    function detailRibbon(i){
                    if(i<0||i>5)return null;
                    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
                    icon.setAttribute('class','dpc-overlay-ribbon');icon.setAttribute('viewBox','0 0 40 54');icon.setAttribute('aria-label',['First place','Second place','Third place','Fourth place','Fifth place','Brown ribbon'][i]);
                    if(i===3||i===4){icon.setAttribute('viewBox','0 0 40 54');icon.innerHTML='<text x="20" y="37" text-anchor="middle" font-family="Georgia,serif" font-size="40" font-weight="bold" font-style="italic" fill="currentColor">'+(i+1)+'</text><text x="33" y="13" font-family="system-ui" font-size="10" font-weight="600" fill="currentColor">th</text>';icon.style.color='var(--muted)';return icon;}
                    if(i===5){icon.innerHTML='<path d="M8 34 A20.2 20.2 0 0 0 19 40.2 L13 52 L10 46 L3 48 Z M21 40.2 A20.2 20.2 0 0 0 32 34 L37 48 L30 46 L27 52 Z" fill="#95623e"/><circle cx="20" cy="20" r="18.5" fill="#95623e"/><circle cx="20" cy="20" r="13" fill="#d1a17a"/><path d="m11 15 6 3-6 2m18-5-6 3 6 2" fill="none" stroke="#593620" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 23 Q20 36 28 23Z" fill="#593620"/><path d="M18 26 H25 V30 Q25 36 21.5 36 Q18 36 18 30Z" fill="#e98288"/><path d="M21.5 27V31" stroke="#b34b58" stroke-width="1.2" stroke-linecap="round"/></svg>'.replace('</svg>','');return icon;}
                    const id='dpc-detail-award-mask-'+(++detailRibbonSerial);
                    icon.innerHTML='<defs><mask id="'+id+'"><circle cx="20" cy="20" r="18.5" fill="white"/><path d="M20 12 L26.928 16 L26.928 24 L20 28 L13.072 24 L13.072 16 Z" fill="black"/>'+Array.from({length:6},(_,j)=>'<path d="M20 12 L41 24.124" stroke="black" stroke-width="1.7" transform="rotate('+(j*60)+' 20 20)"/>').join('')+'</mask></defs><circle cx="20" cy="20" r="18.5" fill="currentColor" mask="url(#'+id+')"/>';
                    icon.innerHTML+='<path d="M8 34 A20.2 20.2 0 0 0 19 40.2 L13 52 L10 46 L3 48 Z M21 40.2 A20.2 20.2 0 0 0 32 34 L37 48 L30 46 L27 52 Z" fill="currentColor"/>';icon.style.color=['#668cda','#d45a65','#e4c45c'][i];return icon;
                }
    function composeEditorialCredit(credits,featureTitle,featureAuthor){
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
    // Retain a short window of parsed photo pages and decoded images across swipes.
    // A gallery snapshot belongs to the exact photo click, not the photographer or challenge.
    const contextKey='dpc-gallery-context-v3',contextProviders=new WeakMap();
    let activeGallery=null;
    function registerGallery(element,label,provider,subject=''){contextProviders.set(element,{label,provider,subject});}
    function galleryEntries(element){
        return [...element.querySelectorAll('a[href]')].filter(a=>photoCacheId(a.href)).map(a=>{
            const im=a.querySelector('img')||a.closest('article')?.querySelector('img');
            return {href:a.href,src:im?.dataset.src||im?.getAttribute('src')||'',title:im?.alt||a.textContent.trim()};
        });
    }
    function normaliseGallery(entries){
        const seen=new Set(),out=[];
        for(const e of entries||[]){try{const u=new URL(e.href,location.href),id=photoCacheId(u.href);if(u.origin!==location.origin||!id||seen.has(id))continue;seen.add(id);out.push({href:u.href,src:e.src?new URL(e.src,location.href).href:'',title:String(e.title||'')});}catch{}}
        return out;
    }
    function storeGallery(context){try{sessionStorage.setItem(contextKey,JSON.stringify(context));}catch{}}
    function captureGallery(e){
        if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
        const a=e.target.closest?.('a[href]');if(!a||!photoCacheId(a.href)||isPhotoDetail)return;
        let scope=a,def=null;while(scope&&!def){def=contextProviders.get(scope);if(!def)scope=scope.parentElement;}
        if(!def)return;
        const result=def.provider(),entries=normaliseGallery(Array.isArray(result)?result:result.entries);
        const id=photoCacheId(a.href);if(!entries.some(x=>photoCacheId(x.href)===id))return;
        const context={time:Date.now(),token:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),origin:location.href,label:def.label,subject:def.subject,entries,queue:result.queue||[],visited:result.visited||[],entryId:id,y:scrollY};
        storeGallery(context);
        // Carry an explicit context marker across the navigation, independent of referrer policy.
        const target=new URL(a.href);target.hash='dpc-gallery='+context.token;
        a.href=target.href;
        const token={...history.state,dpcGalleryReturn:{label:def.label,y:scrollY,extra:result.extra||null}};
        history.replaceState(token,'',location.href);
    }
    function loadGallery(){
        try{const saved=JSON.parse(sessionStorage.getItem(contextKey)||'null'),id=photoCacheId(location.href);
            if(!saved||Date.now()-saved.time>12*3600000||!saved.entries.some(x=>photoCacheId(x.href)===id))return null;
            if(history.state?.dpcGalleryToken!==saved.token){
                if(saved.entryId!==id||location.hash!=='#dpc-gallery='+saved.token)return null;
                const clean=new URL(location.href);clean.hash='';
                history.replaceState({...history.state,dpcGalleryOrigin:saved.origin,dpcGalleryToken:saved.token},'',clean.href);
            }
            return saved;
        }catch{return null;}
    }
    function contextualLinks(doc){
        if(!activeGallery)return null;
        const index=activeGallery.entries.findIndex(e=>photoCacheId(e.href)===photoCacheId(location.href));if(index<0)return null;
        return [index-1,index+1].map(i=>{
            const entry=activeGallery.entries[i];if(!entry)return null;
            const a=document.createElement('a');a.href=entry.href;if(entry.src){const im=document.createElement('img');im.src=entry.src;im.alt=entry.title;a.append(im);}return a;
        });
    }
    const detailPageCache=new Map();
    function detailNeighbours(doc,base){
        const cells=doc.querySelectorAll('#image_challenge table tr:first-child > td');
        return [cells[0],cells[cells.length-1]].map(cell=>{const a=cell?.querySelector('a[href*="image.php"]');if(!a)return null;const href=new URL(a.getAttribute('href'),base).href;return href===base?null:href;});
    }
    function detailRecord(href,priority=false){
        if(detailPageCache.has(href)){const hit=detailPageCache.get(href);detailPageCache.delete(href);detailPageCache.set(href,hit);return hit;}
        const rec={href,doc:null,decoded:null,probe:null};detailPageCache.set(href,rec);
        rec.promise=interactiveFetch(href,{credentials:'same-origin'},priority).then(async response=>{
            if(!response.ok)throw Error('Photo unavailable');
            const template=document.createElement('template');template.innerHTML=await response.text();
            const page=template.content,photo=page.querySelector('#img_container img:not([src*="pix.gif"])');
            if(!photo||!page.querySelector('.imagetitle'))throw Error('Invalid photo');
            const src=new URL(photo.getAttribute('src'),href).href;
            photo.setAttribute('src',src);photo.removeAttribute('srcset');
            rec.doc=page;rec.src=src;
            const probe=new Image();rec.probe=probe;probe.src=src;
            rec.decoded=probe.decode().then(()=>{rec.ready=true;sharedPhotoWrite(href,src,probe.naturalWidth,probe.naturalHeight);return true;}).catch(()=>false);
            return page;
        }).catch(()=>{if(detailPageCache.get(href)===rec)detailPageCache.delete(href);return null;});
        return rec;
    }
    function buildPhotoDetail(doc=document, mounted=false, direction=0, previewRoot=null, incoming=null){
        const photo=doc.querySelector('#img_container img:not([src*="pix.gif"])');
        const title=doc.querySelector('.imagetitle');
        if(!photo||!title)return;
        if(!previewRoot){const rememberImage=()=>sharedPhotoWrite(location.href,photo.src,photo.naturalWidth,photo.naturalHeight);if(photo.complete)rememberImage();else photo.addEventListener('load',rememberImage,{once:true});}
        const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n;};
        const copy=n=>n.cloneNode(true);
        function actionIcon(el,kind){
            const paths={heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',person:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M19 8v6m-3-3h6"/>',comment:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l2-4a8.5 8.5 0 1 1 15-4.5Z"/><path d="M12 8v7m-3.5-3.5h7"/>',reply:'<path d="m9 10-5 5 5 5M4 15h10a6 6 0 0 0 6-6V5"/>',edit:'<path d="m15 5 4 4M4 20l4-1 12-12-4-4L4 15z"/>',check:'<path d="m5 12 4 4L19 6"/>'};
            const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.innerHTML=paths[kind]||paths.reply;el.prepend(svg);el.classList.add('dpc-detail-icon-action');return el;
        }
        const info=doc.querySelector('.dpc-image-information');
        const stats=doc.querySelector('.dpc-vote-breakdown');
        const thread=doc.querySelector('.dpc-forum-thread');
        if(!mounted&&!previewRoot)app.innerHTML=header+'<div class="dpc-photo-detail"></div>'+footer;
        const body=previewRoot||$('.dpc-photo-detail');
        const previousScroll=mounted&&!previewRoot?window.scrollY:null;
        const oldHeight=body.offsetHeight;
        if(previousScroll!==null)body.style.minHeight=oldHeight+'px';
        body.replaceChildren();
        const current=make('div','dpc-detail-current');body.append(current);
        const swipeArea=make('div','dpc-detail-swipe-area');current.append(swipeArea);
        const challenge=info?.querySelector('a[href*="challenge_results.php"]');
        if(!mounted&&!previewRoot)activeGallery=loadGallery();
        if(!previewRoot){
            let indicator=app.querySelector(':scope > .dpc-gallery-context-label');
            if(!indicator){indicator=make('div','dpc-gallery-context-label');body.before(indicator);}
            const index=activeGallery?.entries.findIndex(e=>photoCacheId(e.href)===photoCacheId(location.href))??-1;
            const photographer=title.nextElementSibling?.matches('a')?title.nextElementSibling.textContent.trim().replace(/^by\s+/i,''):'';
            const challengeName=challenge?.textContent.trim()||'';
            const collection=index>=0?activeGallery.label:'Challenge photographs';
            const subject=activeGallery?.subject||(/^(?:Challenge results|Homepage results|Challenge photographs)$/i.test(collection)?challengeName:photographer);
            const label=(subject?subject+' · ':'')+collection+(index>=0?' · '+(index+1)+' / '+activeGallery.entries.length+(activeGallery.queue?.length?'+':''):'');
            if(indicator.textContent!==label)indicator.textContent=label;
        }
        const stage=make('div','dpc-detail-stage');const image=copy(photo);image.removeAttribute('style');image.removeAttribute('srcset');
        const fullSrc=incoming?.record?.src||photo.getAttribute('src');
        const width=Number(photo.getAttribute('width'))||incoming?.record?.probe?.naturalWidth||photo.naturalWidth;
        const height=Number(photo.getAttribute('height'))||incoming?.record?.probe?.naturalHeight||photo.naturalHeight;
        const ratio=incoming?.ratio||(width>0&&height>0?width/height:null);
        if(ratio>0){stage.style.aspectRatio=String(ratio);stage.classList.add('dpc-fixed-photo-stage');}
        if(incoming?.thumb&&!incoming.record?.ready&&ratio>0){
            image.src=incoming.thumb;
            incoming.record?.decoded?.then(ok=>{if(ok&&image.isConnected)image.src=fullSrc;});
        }else if(fullSrc)image.src=fullSrc;
        stage.append(image);if(!previewRoot){const href=location.href;const rememberImage=()=>sharedPhotoWrite(href,image.src,image.naturalWidth,image.naturalHeight);image.addEventListener('load',rememberImage,{once:true});if(image.complete)rememberImage();}swipeArea.append(stage);
        const gallery=make('div','dpc-detail-gallery');swipeArea.append(gallery);gallery.append(stage);
        const caption=make('div','dpc-editorial-credit dpc-photo-caption');stage.after(caption);const heading=make('h1','dpc-home-feature-title');caption.append(heading);
        const credit=make('div','dpc-detail-credit dpc-home-feature-author');const ribbon=title.querySelector('img[alt]');if(ribbon){const rank=parseInt(ribbon.alt,10);const badge=detailRibbon(rank-1);if(badge){badge.classList.add('dpc-caption-ribbon');credit.append(badge);}}
        const author=title.nextElementSibling;if(author?.matches('a')){const a=copy(author);a.textContent='by '+a.textContent.trim();credit.append(a);}caption.append(credit);

        if((challenge||activeGallery)&&!previewRoot){
            const cells=doc.querySelectorAll('#image_challenge table tr:first-child > td');
            const links=contextualLinks(doc)||[cells[0]?.querySelector('a[href*="image.php"]'),cells[cells.length-1]?.querySelector('a[href*="image.php"]')];
            const slides=[null,null];let busy=false,drag=null,offset=0;
            const distance=()=>body.clientWidth||document.documentElement.clientWidth||innerWidth;
            const move=(x,animate=false)=>{
                offset=x;
                const transition=animate&&!reducedMotion.matches?'transform 260ms cubic-bezier(.2,.75,.25,1)':'none';
                current.style.transition=transition;current.style.transform='translate3d('+x+'px,0,0)';
                if(x===0&&animate&&!reducedMotion.matches){current.addEventListener('transitionend',()=>{if(offset===0&&!drag&&!busy)slides.forEach(rec=>{if(rec)rec.root.style.opacity='0';});},{once:true});}
                slides.forEach((rec,i)=>{
                    if(!rec)return;
                    rec.root.style.opacity=x===0&&(!animate||reducedMotion.matches)?'0':'1';
                    rec.root.style.transition=transition;
                    rec.root.style.transform='translate3d('+((i===0?-1:1)*distance()+x)+'px,0,0)';
                });
            };
            function fallback(rec){
                if(rec.doc||rec.root.childNodes.length)return;
                const shell=current.cloneNode(true);
                shell.querySelectorAll('.dpc-photo-caption,.dpc-detail-photographer,.dpc-detail-section').forEach(el=>el.style.visibility='hidden');
                shell.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
                const old=shell.querySelector('.dpc-detail-stage');
                if(old){old.replaceChildren(rec.preview.cloneNode(true));const w=rec.preview.naturalWidth,h=rec.preview.naturalHeight;if(w&&h){old.style.aspectRatio=String(w/h);old.classList.add('dpc-fixed-photo-stage');}}
                rec.root.append(shell);
            }
            function prepare(i){
                const link=links[i];if(!link)return null;
                const url=new URL(link.getAttribute('href'),location.href).href;
                const thumb=link.querySelector('img');
                const preview=make('img');if(thumb){preview.src=new URL(thumb.getAttribute('src'),location.href).href;const w=Number(thumb.getAttribute('width'))||thumb.naturalWidth,h=Number(thumb.getAttribute('height'))||thumb.naturalHeight;if(w&&h){preview.width=w;preview.height=h;}}
                const root=make('div','dpc-photo-detail dpc-detail-preview');root.inert=true;root.style.opacity='0';root.setAttribute('aria-hidden','true');body.append(root);
                const record=detailRecord(url,true);
                const rec={url,preview,root,record};slides[i]=rec;move(offset);
                rec.promise=record.promise.then(page=>{
                    if(!page)return null;
                    rec.doc=page;
                    if(root.isConnected){
                        const ratio=preview.naturalWidth&&preview.naturalHeight?preview.naturalWidth/preview.naturalHeight:preview.width&&preview.height?preview.width/preview.height:null;
                        buildPhotoDetail(page,true,0,root,{record,thumb:preview.src||null,ratio});
                    }
                    return page;
                });
                return rec;
            }
            prepare(0);prepare(1);move(0);
            const keep=new Set([location.href,...slides.filter(Boolean).map(rec=>rec.url)]);
            if(activeGallery){
                const index=activeGallery.entries.findIndex(e=>photoCacheId(e.href)===photoCacheId(location.href));
                for(const step of [2,-2,3,-3]){const entry=activeGallery.entries[index+step];if(entry){keep.add(entry.href);detailRecord(entry.href);}}
            }else{
                async function lookAhead(rec,index){
                    if(!rec)return;let page=await rec.promise,href=rec.url;
                    for(let depth=0;depth<2&&page&&current.isConnected;depth++){
                        const next=detailNeighbours(page,href)[index];if(!next||keep.has(next))break;
                        keep.add(next);href=next;page=await detailRecord(next).promise;
                    }
                }
                Promise.all(slides.map(lookAhead)).catch(()=>{});
            }
            while(detailPageCache.size>18){const href=[...detailPageCache.keys()].find(key=>!keep.has(key));if(!href)break;detailPageCache.delete(href);}
            // Extend challenge results with the actual next page, preserving its native sorting.
            if(activeGallery&&activeGallery.queue?.length&&!links[1]){
                const ctx=activeGallery;
                (async()=>{
                    const next=ctx.queue[0],response=await interactiveFetch(next,{credentials:'same-origin'},true);
                    if(!response.ok||!current.isConnected||activeGallery!==ctx)return;
                    const page=new DOMParser().parseFromString(await response.text(),'text/html');
                    const added=[...page.querySelectorAll('table.dpc-challenge-results td.dpc-result-thumb')].map(cell=>({href:cell.querySelector('a[href*="image.php"]')?.getAttribute('href'),src:cell.querySelector('img[src]')?.getAttribute('src')})).filter(e=>e.href).map(e=>({href:new URL(e.href,response.url||next).href,src:e.src?new URL(e.src,response.url||next).href:''}));
                    if(!added.length)return;
                    ctx.entries=normaliseGallery([...ctx.entries,...added]);ctx.queue.shift();ctx.visited.push(next);
                    const visited=new Set([...ctx.visited,...ctx.queue]);
                    for(const a of page.querySelectorAll('a[href]')){const u=new URL(a.getAttribute('href'),next),origin=new URL(ctx.origin);u.hash='';u.searchParams.sort();if(u.origin!==origin.origin||u.pathname!==origin.pathname||u.searchParams.get('CHALLENGE_ID')!==origin.searchParams.get('CHALLENGE_ID')||!a.querySelector('img[src*="/images/page/"]')&&!/^\\d+$|next|previous|page\\s+\\d+/i.test(a.textContent.trim())||visited.has(u.href))continue;visited.add(u.href);ctx.queue.push(u.href);}
                    const pageNo=url=>{const q=new URL(url).searchParams;return Number(q.get('page')||q.get('PAGE')||q.get('PAGE_ID')||q.get('page_id')||0);};
                    ctx.queue.sort((a,b)=>pageNo(a)-pageNo(b));storeGallery(ctx);
                    const nextLink=contextualLinks(doc)?.[1];if(nextLink&&!slides[1]&&current.isConnected){links[1]=nextLink;prepare(1);}
                })().catch(()=>{});
            }
            requestAnimationFrame(()=>{if(current.isConnected&&!drag&&!busy)move(0);});
            const resize=new ResizeObserver(()=>{if(!current.isConnected){resize.disconnect();return;}if(!drag&&!busy)move(0);});resize.observe(body);
            async function go(d){
                if(busy)return;const rec=slides[d<0?0:1];if(!rec){move(0,true);return;}
                busy=true;fallback(rec);move(-d*distance(),true);
                const [page]=await Promise.all([rec.promise,new Promise(resolve=>setTimeout(resolve,reducedMotion.matches?0:270))]);
                if(!page){move(0,true);busy=false;location.href=rec.url;return;}
                if(!current.isConnected)return;
                const ratio=rec.preview.naturalWidth&&rec.preview.naturalHeight?rec.preview.naturalWidth/rec.preview.naturalHeight:rec.preview.width&&rec.preview.height?rec.preview.width/rec.preview.height:null;
                history.replaceState(history.state,'',rec.url);buildPhotoDetail(page,true,d,null,{record:rec.record,thumb:rec.preview.src||null,ratio});
            }
            swipeArea.addEventListener('pointerdown',e=>{if(busy||!e.isPrimary||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,axis:null};});
            swipeArea.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.axis&&Math.max(Math.abs(dx),Math.abs(dy))>8){drag.axis=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';if(drag.axis==='x')swipeArea.setPointerCapture(e.pointerId);}if(drag.axis==='x'){const available=slides[dx>0?0:1];if(available)fallback(available);move(Math.max(-distance(),Math.min(distance(),available?dx:dx*.18)));}});
            swipeArea.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const horizontal=drag.axis==='x';drag=null;if(horizontal){if(Math.abs(offset)>Math.min(90,distance()*.22))go(offset<0?1:-1);else move(0,true);}else if(offset)move(0,true);});
            swipeArea.addEventListener('pointercancel',()=>{drag=null;if(!busy)move(0,true);});
            swipeArea.addEventListener('dragstart',e=>{if(drag?.axis==='x')e.preventDefault();});
        }
        function section(name){const sec=make('section','dpc-detail-section');sec.append(make('h2','',name));swipeArea.append(sec);return sec;}
        function fields(source,parent){
            if(!source)return;
            const dl=make('dl','dpc-detail-fields');let dt=null,dd=null;
            for(const node of source.childNodes){
                if(node.nodeType===1&&node.matches('b')){dt=make('dt','',node.textContent.replace(/:\s*$/,''));dd=make('dd');dl.append(dt,dd);}
                else if(node.nodeType===1&&node.matches('br')){dt=dd=null;}
                else if(dd){dd.append(copy(node));}
            }
            if(dl.children.length)parent.append(dl);
        }
        const description=info?.querySelector('.dpc-detail-secondary-content');
        if(description?.textContent.trim()){const sec=make('section','dpc-detail-photographer');sec.append(make('h2','','Photographer’s comments'));const p=make('div','dpc-detail-prose');for(const n of description.childNodes)p.append(copy(n));sec.append(p);gallery.append(sec);}
        const primary=stats?.querySelector('.dpc-detail-primary-content');
        const votes=[...(stats?.querySelectorAll('.breakdown_vote')||[])].map(n=>({score:n.textContent.trim(),bar:n.nextElementSibling,count:Number(n.nextElementSibling?.nextElementSibling?.textContent)||0}));
        if(primary||votes.length){
            const sec=section('Statistics'),layout=make('div','dpc-detail-results-layout');sec.append(layout);
            if(votes.length){
                const chart=make('div','dpc-detail-distribution');layout.append(chart);
                const bars=make('div','dpc-detail-columns');chart.append(bars);
                const max=Math.max(1,...votes.map(v=>v.count));
                let highlighted=false;
                for(const v of votes){
                    const own=/rgb\(173,\s*47,\s*89\)|#ad2f59/i.test(v.bar?.style.backgroundColor||'');
                    highlighted=highlighted||own;
                    const column=make('div','dpc-detail-column'+(own?' own':''));
                    const track=make('div','dpc-detail-column-track'),fill=make('div','dpc-detail-column-fill'),count=make('span','dpc-detail-column-count',String(v.count));
                    const percent=100*v.count/max;fill.style.height=percent+'%';const plot=make('div','dpc-detail-column-plot');plot.append(fill);if(v.count>0){count.style.bottom='calc('+percent+'% + 3px)';plot.append(count);}track.append(plot);column.append(track,make('span','dpc-detail-column-score',v.score));
                    column.setAttribute('aria-label',v.score+': '+v.count+' votes'+(own?' — your vote':''));bars.append(column);
                }
                if(highlighted)chart.append(make('div','dpc-detail-distribution-note','Your vote highlighted'));
            }
            if(primary){const summary=make('div','dpc-detail-summary');layout.append(summary);fields(primary,summary);
                const values=new Map([...summary.querySelectorAll('dt')].map(dt=>[dt.textContent.trim().toLowerCase(),dt.nextElementSibling?.textContent.trim()||'']));
                const rank=parseInt(values.get('place'),10),avg=parseFloat(values.get('avg (all users)'));
                const result=make('div','dpc-detail-caption-result');
                if(Number.isFinite(rank)&&rank>0){const suffix=rank%100>=11&&rank%100<=13?'th':({1:'st',2:'nd',3:'rd'}[rank%10]||'th');result.append(make('span','dpc-detail-caption-rank',rank+suffix));}
                if(Number.isFinite(avg)){if(result.children.length)result.append(make('span','dpc-detail-caption-slash','/'));result.append(make('span','dpc-detail-caption-average',avg.toFixed(3)+' avg'));}
                if(result.children.length){caption.append(result);caption.classList.add('has-result');}
            }
            if(!primary||!votes.length)layout.classList.add('single');
        }
        if(info){const sec=section('Photograph information');const source=info.querySelector('.dpc-detail-primary-content');fields(source,sec);for(const a of source?.querySelectorAll('a[href*="favorites_mgr.php"]')||[]){const link=make('a','dpc-detail-action',a.textContent.trim());link.href=a.href;actionIcon(link,/photographer/i.test(link.textContent)?'person':'heart');sec.append(link);}}
        const comments=section('Community comments');current.append(comments);
        const composer=make('button','dpc-detail-action','Add your comment');composer.type='button';composer.onclick=()=>original(location.href.split('#')[0]+'#post');actionIcon(composer,'comment');comments.append(composer);
        if(thread){let card=null;for(const row of thread.rows){
            const a=row.querySelector('.dpc-forum-author-details a[href*="profile.php"]');
            if(a){card=make('article','dpc-detail-comment');const head=make('div','dpc-detail-comment-head');const avatar=row.querySelector('.forumpic img');if(avatar){const im=copy(avatar);im.removeAttribute('style');im.loading='lazy';head.append(im);}const meta=make('div');meta.append(copy(a));const actions=row.querySelector('.dpc-forum-actions');if(actions){const time=copy(actions);time.querySelectorAll('span,img,a').forEach(n=>n.remove());meta.append(make('small','',time.textContent.trim()));}head.append(meta);card.append(head);comments.append(card);if(actions){const bar=make('div','dpc-detail-comment-actions');for(const link of actions.querySelectorAll('a[href]')){const label=link.querySelector('img')?.title||link.title||link.textContent.trim()||'Reply';if(/report|spam/i.test(label+' '+link.getAttribute('href')))continue;const b=make('a','',label);b.href=link.href;b.onclick=e=>{e.preventDefault();original(b.href);};actionIcon(b,/edit/i.test(label)?'edit':'reply');bar.append(b);}card.append(bar);}}
            const message=row.querySelector('.dpc-forum-message .forum-post td');if(message&&card){const p=make('div','dpc-detail-prose');for(const n of message.childNodes)p.append(copy(n));card.insertBefore(p,card.querySelector('.dpc-detail-comment-actions'));}
            if(row.querySelector('img[src*="ratings/helpful"]')&&card){let bar=card.querySelector('.dpc-detail-comment-actions');if(!bar){bar=make('div','dpc-detail-comment-actions');card.append(bar);}if(!bar.querySelector('.dpc-detail-helpful'))bar.append(actionIcon(make('small','dpc-detail-helpful','Photographer found comment helpful'),'check'));}
            if(!a&&/Comments Made During the Challenge/i.test(row.textContent)){comments.append(make('h3','dpc-detail-divider','Comments made during the challenge'));card=null;}
        }}
        if(!previewRoot)$('#dpc-original').onclick=()=>original();
        if(!mounted&&!previewRoot){mount();}
        const fit=()=>{editorialTypeset(heading,title.textContent.trim(),direction,false);composeEditorialCredit(caption,heading,credit);};
        fit();
        if(previewRoot)return;
        if(!direction)document.fonts?.ready.then(()=>{if(heading.isConnected)fit();});
        if(previousScroll!==null){
            body.style.minHeight='';
            window.scrollTo({top:previousScroll,behavior:'instant'});
        }
        if(direction&&!reducedMotion.matches){
            [...heading.querySelectorAll('.dpc-title-part')].forEach((part,k)=>{
                const italic=part.tagName==='EM';
                part.animate([{opacity:0,transform:'translateX('+(direction*(italic?38:24))+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:italic?720:600,delay:k*125,easing:'cubic-bezier(.28,.08,.18,1)',fill:'both'});
            });
            credit.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:600,delay:220,easing:'cubic-bezier(.28,.08,.18,1)',fill:'both'});
            [...swipeArea.querySelectorAll('.dpc-detail-column')].forEach(column=>{
                const score=parseInt(column.querySelector('.dpc-detail-column-score')?.textContent,10);
                const bar=column.querySelector('.dpc-detail-column-fill'),count=column.querySelector('.dpc-detail-column-count');
                const delay=Math.max(0,(Number.isFinite(score)?score:1)-1)*65;
                if(bar)bar.animate([{transform:'scaleY(0)'},{transform:'scaleY(1)'}],{duration:420,delay,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
                if(count)count.animate([{opacity:0},{opacity:1}],{duration:160,delay:delay+300,fill:'both'});
            });
        }
    }


    function buildProfile(){
        const summary=document.querySelector('.dpc-profile-summary');if(!summary)return;
        const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
        const clean=n=>(n?.textContent||'').replace(/\s+/g,' ').trim();
        const fields=new Map([...summary.querySelectorAll('.profile-heading')].map(n=>[clean(n).replace(/:$/,''),n.nextElementSibling]));
        const value=k=>clean(fields.get(k));
        const side=new Map();
        for(const table of document.querySelectorAll('table')){const rows=table.rows;if(rows.length!==2)continue;const name=clean(rows[0]);if(['Statistics','Favorites','Status','Awards','Honorable Mentions'].includes(name))side.set(name,rows[1].cells[0]);}
        const originalGrids=[...document.querySelectorAll('.dpc-profile-thumbnail-grid')];
        const actions=[...summary.querySelectorAll('a[href]')].filter(a=>/messaging\.php|favorites_mgr\.php|portfolio\.php/.test(a.href));
        const nativeLists=[{name:'Challenge entries',list:window.challengeList,container:document.querySelector('#challengeImageList'),challenge:true,thumb:window.getChallengeImageURL},{name:'Portfolio images',list:window.portfolioList,container:document.querySelector('#portfolioImageList'),challenge:false,thumb:window.getPortfolioImageURL}];
        const forumDivider=[...document.querySelectorAll('.divider')].find(n=>/Forum Threads/i.test(clean(n)));
        const forum=forumDivider?.nextElementSibling;
        const statSource=side.get('Statistics');
        const awards=side.get('Awards'),mentions=side.get('Honorable Mentions');
        const photoRank=new Map();
        function awardRows(source){return [...(source?.querySelectorAll('tr')||[])].map(row=>{const im=row.querySelector('img'),a=row.querySelector('a[href*="image.php"]:not(:has(img))'),challenge=row.querySelector('a[href*="challenge_results.php"]');if(!im||!a)return null;const rank=/ribbon_for_fools/i.test(im.getAttribute('src')||'')?6:Number(im.getAttribute('src')?.match(/ribbig(\d)/)?.[1])||0;photoRank.set(a.href,rank);return {rank,im,a,challenge};}).filter(Boolean);}
        const awardEntries=awardRows(awards),mentionEntries=awardRows(mentions);
        function safeLink(a,label){const n=make('a','',label??clean(a));n.href=a.href;return n;}
        function content(target,source){if(!source)return;for(const child of source.childNodes){const n=child.cloneNode(true);if(n.nodeType===1){for(const el of [n,...n.querySelectorAll('*')]){el.removeAttribute('style');el.removeAttribute('width');el.removeAttribute('height');if(el.tagName==='IMG')el.loading='lazy';}}target.append(n);}}
        function heading(label){const h=make('h2');const words=label.split(' ');h.append(words.slice(0,-1).join(' ')+' ',make('em','',words.at(-1)));return h;}
        app.innerHTML=header+'<main class="dpc-profile-page"></main>'+footer;
        const body=$('.dpc-profile-page');
        const hero=make('section','dpc-profile-hero dpc-profile-card');body.append(hero);
        const identity=make('div','dpc-profile-identity');hero.append(identity);
        const portrait=summary.querySelector('img[src*="images_profile"]');if(portrait){const img=make('img','dpc-profile-avatar');img.src=portrait.src;img.alt=value('Username');identity.append(img);}
        const who=make('div','dpc-profile-who');identity.append(who);
        who.append(make('h1','',value('Username')||value('Name')||'Photographer'));
        if(value('Name')&&value('Name')!==value('Username'))who.append(make('div','dpc-profile-realname',value('Name')));
        who.append(make('div','dpc-profile-meta',[value('Type'),value('Location')].filter(Boolean).join(' · ')));
        if(value('Registered'))who.append(make('div','dpc-profile-meta','Member since '+value('Registered')));
        if(side.has('Status')){const status=make('div','dpc-profile-status',clean(side.get('Status')));who.append(status);}
        const metrics=make('div','dpc-profile-metrics');hero.append(metrics);
        const statText=clean(statSource);
        for(const [label,pattern] of [['Entries',/Challenges Entered:\s*([\d,]+)/i],['Average',/Avg Vote Received:\s*([\d.]+)/i],['Votes cast',/Votes Cast:\s*([\d,]+)/i],['Ribbons',null]]){
            const v=pattern?statText.match(pattern)?.[1]:String(awardEntries.filter(x=>x.rank>=1&&x.rank<=3).length);if(v===undefined)continue;
            const cell=make('div');cell.append(make('strong','',v),make('span','',label));metrics.append(cell);
        }
        const bar=make('div','dpc-profile-actions');hero.append(bar);
        const seen=new Set();for(const a of actions){const kind=/messaging\.php/.test(a.href)?'Message':/favorites_mgr/.test(a.href)?'Add favourite':'Portfolio';if(seen.has(kind))continue;seen.add(kind);bar.append(safeLink(a,kind));}
        const tabs=make('div','dpc-home-challenge-tabs dpc-profile-tabs');body.append(tabs);tabs.setAttribute('role','tablist');
        const panels=[],buttons=[];
        function panel(label){const p=make('div','dpc-profile-panel');const i=panels.length;const b=make('button','dpc-home-challenge-tab');const words=label.split(' ');b.append(words.slice(0,-1).join(' ')+(words.length>1?' ':''),make('em','',words.at(-1)));b.type='button';b.setAttribute('role','tab');b.id='dpc-profile-tab-'+i;p.id='dpc-profile-panel-'+i;b.setAttribute('aria-controls',p.id);p.setAttribute('aria-labelledby',b.id);p.setAttribute('role','tabpanel');tabs.append(b);body.append(p);panels.push(p);buttons.push(b);b.onclick=()=>select(i);return p;}
        function select(i){panels.forEach((p,j)=>{p.hidden=i!==j;buttons[j].classList.toggle('active',i===j);buttons[j].setAttribute('aria-selected',String(i===j));});}
        function section(parent,label){const sec=make('section','dpc-profile-section');sec.append(heading(label));parent.append(sec);return sec;}
        const overview=panel('Overview'),history=panel('Challenge entries'),portfolio=panel('Portfolio'),about=panel('About');
        const profileFullQueue=[],profileFullCache=new Map();let profileFullActive=false;
        const imageIdFromSrc=src=>photoFilename(src).match(/(?:^|_)(\d+)\.[a-z]+$/i)?.[1];
        async function upgradeProfileThumb(im){
            const href=im.dataset.href,thumb=im.dataset.src,id=photoCacheId(href);
            if(!id||imageIdFromSrc(thumb)!==id||!im.isConnected)return;
            const cached=sharedPhotoRead(href);
            if(cached&&imageIdFromSrc(cached.full)===id){im.src=cached.full;return;}
            let pending=profileFullCache.get(id);
            if(!pending){
                pending=(async()=>{
                    const response=await backgroundFetch(href,{credentials:'same-origin'});if(!response.ok)return null;
                    const template=document.createElement('template');template.innerHTML=await response.text();
                    const photo=[...template.content.querySelectorAll('#img_container img[src]')].find(p=>imageIdFromSrc(new URL(p.getAttribute('src'),response.url).href)===id);
                    if(!photo)return null;
                    const src=new URL(photo.getAttribute('src'),response.url).href;
                    const probe=new Image();probe.src=src;await probe.decode();
                    if(!probe.naturalWidth||!probe.naturalHeight)return null;
                    sharedPhotoWrite(href,src,probe.naturalWidth,probe.naturalHeight);return src;
                })().catch(()=>null);
                profileFullCache.set(id,pending);
            }
            const src=await pending;if(src&&im.isConnected)im.src=src;
        }
        function pumpProfileFull(){
            if(profileFullActive||document.hidden||backgroundBlocked())return;
            while(profileFullQueue.length){
                const im=profileFullQueue.shift();if(!im.isConnected||im.closest('[hidden]'))continue;
                profileFullActive=true;upgradeProfileThumb(im).catch(()=>{}).finally(()=>{profileFullActive=false;pumpProfileFull();});break;
            }
        }
        document.addEventListener('visibilitychange',pumpProfileFull);
        const imageObserver=new IntersectionObserver(items=>{for(const item of items){if(!item.isIntersecting)continue;imageObserver.unobserve(item.target);const im=item.target;if(im.dataset.src)im.src=im.dataset.src;if(im.dataset.href)profileFullQueue.push(im);}pumpProfileFull();},{rootMargin:'200px'});
        function thumbnail(im,src,href){if(src){im.dataset.src=src;if(href)im.dataset.href=href;imageObserver.observe(im);}}
        function gallery(source,label){
            if(!source)return;const sec=section(overview,label),grid=make('div','dpc-profile-gallery');sec.append(grid);
            for(const td of source.querySelectorAll('td')){const a=td.querySelector('.dpc-winning-entry-image a[href]'),im=a?.querySelector('img');if(!im)continue;
                const card=make('article','dpc-profile-card dpc-profile-tile');const link=safeLink(a,'');link.className='dpc-profile-photo';const pic=make('img');pic.alt=im.alt||'';pic.loading='lazy';const cached=sharedPhotoRead(a.href,im.src);thumbnail(pic,cached?.full||im.src,a.href);link.append(pic);
                const rank=Number(td.querySelector('img[alt*="Place"]')?.alt.match(/\d+/)?.[0])||photoRank.get(a.href)||0;const ribbon=detailRibbon(rank-1);card.append(link);const caption=make('div','dpc-profile-caption');const title=safeLink(a,im.alt||clean(td.querySelector('a[href*="image.php"]:not(:has(img))')));title.className='dpc-profile-photo-title';if(ribbon)title.prepend(ribbon);caption.append(title);
                const ch=td.querySelector('a[href*="challenge_results.php"]');if(ch)caption.append(safeLink(ch));const avg=clean(td).match(/Average:\s*([\d.]+)/i);if(avg)caption.append(make('strong','dpc-profile-score',avg[1]+' avg'));card.append(caption);grid.append(card);
            }
            registerGallery(grid,label,()=>galleryEntries(grid),value('Username')||value('Name'));
            // Native profile highlights contain nine photos; supplement from the existing local dataset.
            const highest=source===originalGrids[0],def=nativeLists[highest?0:1];
            const existing=new Set([...grid.querySelectorAll('.dpc-profile-photo')].map(a=>photoCacheId(a.href)));
            const candidates=(Array.isArray(def.list?.dataList)?def.list.dataList:[]).filter(r=>Array.isArray(r)&&Number(r[0])>0&&!existing.has(String(r[0]))&&(!highest||(Number(r[13])===0&&Number(r[14])===1&&Number(r[15])!==1&&Number(r[10])!==9999))).slice();
            candidates.sort(highest?(a,b)=>Number(b[9])-Number(a[9]):(a,b)=>Number(b[5])-Number(a[5])||String(b[9]).localeCompare(String(a[9])));
            while(grid.children.length<10&&candidates.length){
                const r=candidates.shift();let src;try{src=def.thumb(r);}catch{continue;}if(!src)continue;
                const decoder=document.createElement('textarea');decoder.innerHTML=String(r[1]);const title=decoder.value;
                const href=new URL('/image.php?IMAGE_ID='+r[0],location.origin).href;
                const card=make('article','dpc-profile-card dpc-profile-tile'),link=make('a','dpc-profile-photo');link.href=href;
                const pic=make('img');pic.alt=title;pic.loading='lazy';thumbnail(pic,sharedPhotoRead(href)?.full||new URL(src,location.href).href,href);link.append(pic);
                const ribbon=highest&&Number(r[10])>=1&&Number(r[10])<=5?detailRibbon(Number(r[10])-1):null;
                const caption=make('div','dpc-profile-caption'),name=make('a','dpc-profile-photo-title',title);name.href=href;if(ribbon)name.prepend(ribbon);caption.append(name);
                if(highest){const ch=make('a','',String(r[6]));ch.href='/challenge_results.php?CHALLENGE_ID='+r[7];caption.append(ch,make('strong','dpc-profile-score',Number(r[9]).toFixed(4)+' avg'));}
                card.append(link,caption);grid.append(card);
            }
        }
        gallery(originalGrids[0],'Highest rated photographs');
        gallery(originalGrids[1],'Selected portfolio photographs');
        if(awardEntries.length||mentionEntries.length){const sec=section(overview,'Awards and honours'),totals=make('div','dpc-profile-medals');sec.append(totals);
            for(let rank=1;rank<=3;rank++){const cell=make('div');cell.append(detailRibbon(rank-1),make('strong','',String(awardEntries.filter(x=>x.rank===rank).length)),make('span','',['First','Second','Third'][rank-1]));totals.append(cell);}
            for(const [label,items] of [['Ribbons',awardEntries],['Honourable mentions',mentionEntries]]){if(!items.length)continue;const details=make('details','dpc-profile-card dpc-profile-fold');details.append(make('summary','',label+' ('+items.length+')'));for(const item of items){const row=make('div','dpc-profile-award-row');const icon=detailRibbon(item.rank-1)||item.im.cloneNode(true);row.append(icon);const text=make('div');text.append(safeLink(item.a));if(item.challenge)text.append(safeLink(item.challenge));row.append(text);details.append(row);}sec.append(details);}
        }
        function listing(parent,def){
            const raw=def.list?.dataList;
            if(!Array.isArray(raw)||!raw.length){const sec=section(parent,def.name);if(def.container){for(const row of def.container.querySelectorAll('tr')){const a=row.querySelector('a[href*="image.php"]');if(a)sec.append(safeLink(a));}sec.append(make('p','dpc-profile-meta','Use the original website for the full listing.'));}else sec.append(make('p','dpc-profile-meta','No photographs available.'));return;}
            const records=raw.filter(r=>Array.isArray(r)&&Number(r[0])>0).slice();
            const controls=make('div','dpc-profile-controls');parent.append(controls);
            const input=make('input');input.type='search';input.placeholder='Search photographs';input.setAttribute('aria-label','Search photographs');
            const sort=make('select');sort.setAttribute('aria-label','Sort photographs');for(const [key,label] of [['recent','Newest first'],['old','Oldest first'],...(def.challenge?[['score','Highest score'],['place','Best place'],['percent','Highest percentile']]:[]),['faves','Most favourites'],['views','Most viewed'],['comments','Most comments'],['title','Title A–Z']]){const o=make('option','',label);o.value=key;sort.append(o);}controls.append(input,sort);
            const count=make('p','dpc-profile-meta'),grid=make('div','dpc-profile-list'),more=make('button','dpc-home-more','Load more photographs');more.type='button';parent.append(count,grid,more);
            let filtered=[],cursor=0;
            registerGallery(grid,def.name,()=>({entries:filtered.filter(r=>!def.challenge||Number(r[13])===0&&Number(r[14])===1&&Number(r[15])!==1).map(r=>{const href=new URL('/image.php?IMAGE_ID='+r[0],location.origin).href;let src='';try{src=def.thumb(r)||'';}catch{}return {href,src,title:decode(r[1])};}),extra:{tab:panels.indexOf(parent),query:input.value,sort:sort.value,count:cursor}}),value('Username')||value('Name'));
            function decode(v){const t=document.createElement('textarea');t.innerHTML=String(v??'');return t.value;}
            function add(){
                const batch=filtered.slice(cursor,cursor+16);cursor+=batch.length;
                for(const r of batch){const title=decode(r[1]),href=new URL('/image.php?IMAGE_ID='+r[0],location.origin).href;const card=make('article','dpc-profile-card dpc-profile-list-card');const a=make('a','dpc-profile-photo');a.href=href;const im=make('img');im.alt=title;im.loading='lazy';
                    let src='';try{if(typeof def.thumb==='function'&&(!def.challenge||r[14]===1||r[15]===1))src=def.thumb(r);}catch{}
                    // Respect the native hidden-image placeholder, and do not request unpublished thumbnails.
                    if(src){const cached=def.challenge&&r[15]===1?null:sharedPhotoRead(href);thumbnail(im,cached?.full||new URL(src,location.href).href,def.challenge&&r[15]===1?null:href);a.append(im);}else a.append(make('span','dpc-profile-meta','View photo'));
                    const rank=Number(r[10]);const ribbon=def.challenge&&r[13]===0&&rank>=1&&rank<=5?detailRibbon(rank-1):null;card.append(a);
                    const cap=make('div','dpc-profile-caption');const name=make('a','dpc-profile-photo-title',title);name.href=href;if(ribbon)name.prepend(ribbon);cap.append(name);
                    const group=make('a','',decode(r[6]));group.href=def.challenge?'/challenge_results.php?CHALLENGE_ID='+r[7]:(()=>{const p=summary.querySelector('a[href*="portfolio.php?USER_ID="]');if(!p)return '#';const u=new URL(p.href);u.searchParams.set('collection_id',String(r[7]));return u.href;})();cap.append(group);
                    if(def.challenge&&r[13]!==1&&rank!==9999){cap.append(make('strong','dpc-profile-score',Number(r[9]).toFixed(4)+' avg · '+rank+'/'+r[11]));}
                    cap.append(make('small','dpc-profile-meta',String(def.challenge?r[2]:r[9])+' · '+r[3]+' comments · '+r[5]+' faves'));card.append(cap);grid.append(card);
                }
                more.hidden=cursor>=filtered.length;
            }
            function refresh(){const q=input.value.toLowerCase().trim();filtered=records.filter(r=>(decode(r[1])+' '+decode(r[6])).toLowerCase().includes(q));const date=r=>String(r[def.challenge?2:9]);const comparators={recent:(a,b)=>date(b).localeCompare(date(a)),old:(a,b)=>date(a).localeCompare(date(b)),score:(a,b)=>b[9]-a[9],place:(a,b)=>a[10]-b[10],percent:(a,b)=>b[12]-a[12],faves:(a,b)=>b[5]-a[5],views:(a,b)=>b[4]-a[4],comments:(a,b)=>b[3]-a[3],title:(a,b)=>decode(a[1]).localeCompare(decode(b[1]))};filtered.sort(comparators[sort.value]);grid.replaceChildren();cursor=0;count.textContent=filtered.length+' photographs';add();}
            input.oninput=refresh;sort.onchange=refresh;more.onclick=add;const io=new IntersectionObserver(items=>{if(!parent.hidden&&items.some(x=>x.isIntersecting)&&!more.hidden)add();},{rootMargin:'350px'});io.observe(more);refresh();
        }
        listing(history,nativeLists[0]);listing(portfolio,nativeLists[1]);
        for(const [label,keys] of [['Biography',['Biography']],['Profile details',['Age','Gender','Type','Location','Registered','Renewal Date','Credit','Referral link','URL']],['Camera equipment',['Cameras','Lenses']],['Signature',['Signature']]]){
            const available=keys.filter(k=>fields.has(k)&&value(k));if(!available.length)continue;const sec=section(about,label),card=make('div','dpc-profile-card dpc-profile-info'+(label==='Profile details'?' dpc-profile-fields-grid':''));sec.append(card);
            for(const key of available){const field=make('div','dpc-profile-field'+(/Referral link|URL/.test(key)?' wide':''));if(available.length>1||key!==label)field.append(make('h3','',key));const p=make('div','dpc-profile-prose');content(p,fields.get(key));field.append(p);card.append(field);}
        }
        for(const [key,label] of [['Statistics','Full statistics'],['Favorites','Favourites']]){if(!side.has(key))continue;const sec=section(about,label),card=make('div','dpc-profile-card dpc-profile-info');const source=side.get(key);const table=make('dl','dpc-profile-stat-grid');let group='';for(const node of source.childNodes){if(node.nodeType===1&&node.tagName==='LI'){const txt=clean(node);const match=txt.match(/^([^:]+):\s*(.*)/);if(match){const dt=make('dt','',match[1]);const dd=make('dd');const link=node.querySelector('a');if(link)dd.append(safeLink(link));else dd.textContent=match[2];table.append(dt,dd);}}else if(node.nodeType===1&&node.tagName==='B'){const label=clean(node).replace(/:$/,'');const next=node.nextSibling;const val=next?.nodeType===3?next.textContent.replace(/^\s*:\s*/,'').trim():'';if(val){table.append(make('dt','',label),make('dd','',val));}else{table.append(make('div','dpc-profile-stat-group',label));}}}if(table.querySelector('dd')&&key==='Statistics'){card.append(table);const full=make('details','dpc-profile-fold');full.append(make('summary','','Original breakdown'));content(full,source);card.append(full);}else content(card,source);sec.append(card);}
        if(forum?.matches('table')){const sec=section(about,'Recent forum activity');for(const row of forum.rows){const a=row.querySelector('a[href*="FORUM_THREAD_ID"]');if(!a)continue;const link=safeLink(a);link.className='dpc-home-thread';link.append(make('small','',[clean(row.cells[1]),clean(row.cells[2])].join(' · ')));sec.append(link);}}
        select(0);$('#dpc-original').onclick=()=>original();mount();
        const back=history.state?.dpcGalleryReturn;if(back){const extra=back.extra;if(extra&&Number.isInteger(extra.tab)&&panels[extra.tab]){select(extra.tab);const p=panels[extra.tab],q=p.querySelector('input[type=search]'),sort=p.querySelector('select');if(q)q.value=extra.query||'';if(sort){sort.value=extra.sort||'recent';sort.dispatchEvent(new Event('change'));}const more=p.querySelector('.dpc-home-more');for(let i=16;i<(extra.count||16)&&more&&!more.hidden;i+=16)more.click();}requestAnimationFrame(()=>scrollTo(0,back.y||0));}
    }


    function buildChallengeIndex(){
        const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
        const clean=n=>(n?.textContent||'').replace(/\s+/g,' ').trim();
        const defs=[{id:'submit',label:'Open for entries',path:'/challenge_submit.php'},{id:'vote',label:'Open for voting',path:'/challenge_vote_list.php'},{id:'view',label:'Recent results',path:'/challenge_results.php'}];
        const records=new Map(defs.map(d=>[d.id,[]]));
        const seen=new Set();
        for(const table of document.querySelectorAll('.dpc-challenge-cards .dpc-mobile-fields')){
            const fields=new Map();let action=null,def=null;
            for(const row of table.rows){
                if(row.cells.length<2)continue;
                const key=clean(row.cells[0]).replace(/:$/,'');
                if(key)fields.set(key,clean(row.cells[1]));
                for(const a of row.cells[1].querySelectorAll('a[href]')){
                    const u=new URL(a.href,location.href);
                    const match=defs.find(d=>d.path===u.pathname&&u.searchParams.has('CHALLENGE_ID'));
                    if(match){action=u.href;def=match;}
                }
            }
            if(!action||!def||!fields.get('Challenge')||seen.has(action))continue;
            seen.add(action);records.get(def.id).push({fields,action});
        }
        if(!seen.size)return;
        app.innerHTML=header+'<main class="dpc-home dpc-challenge-index"></main>'+footer;
        const body=$('.dpc-challenge-index'),tabs=make('div','dpc-home-challenge-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Challenges');body.append(tabs);
        const panels=[],buttons=[];
        function select(id,write=false){
            const index=Math.max(0,defs.findIndex(d=>d.id===id));
            panels.forEach((p,i)=>{p.hidden=i!==index;buttons[i].classList.toggle('active',i===index);buttons[i].setAttribute('aria-selected',String(i===index));buttons[i].tabIndex=i===index?0:-1;});
            if(write&&location.hash!=='#'+defs[index].id)history.replaceState(history.state,'','#'+defs[index].id);
        }
        for(const [i,def] of defs.entries()){
            const b=make('button','dpc-home-challenge-tab');b.type='button';const words=def.label.split(' ');b.append(words.slice(0,-1).join(' ')+' ',make('em','',words.at(-1)));b.id='dpc-index-tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls','dpc-index-panel-'+i);tabs.append(b);buttons.push(b);
            const panel=make('section','dpc-index-panel');panel.id='dpc-index-panel-'+i;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);body.append(panel);panels.push(panel);
            const grid=make('div','dpc-entry-grid');panel.append(grid);
            for(const {fields,action} of records.get(def.id)){
                const card=make('a','dpc-home-card');card.href=action;card.append(make('h3','',fields.get('Challenge')));
                const description=fields.get('Description');card.append(make('div','dpc-home-meta',description&&!/^N\s*\/\s*A$/i.test(description)?description:'No description provided.'));
                if(fields.get('Extra Rules'))card.append(make('div','dpc-index-extra',fields.get('Extra Rules')));
                const details=make('div','dpc-home-detail');
                if(fields.get('Rules'))details.append(make('span','dpc-entry-rules',fields.get('Rules')));
                const deadline=fields.get('Submission Deadline')||fields.get('Voting Deadline');
                if(deadline)details.append(make('span','dpc-entry-deadline',deadline.replace(/^[A-Za-z]+,\s*/,'').replace(/(\d+)(st|nd|rd|th),\s*\d{4}$/,'$1')));
                const count=fields.get('Submissions');if(count!==undefined)details.append(make('span','dpc-entry-count',count+' '+(count==='1'?'entry':'entries')));
                if(fields.get('Type'))details.append(make('span','dpc-index-type',fields.get('Type')));
                card.append(details);grid.append(card);
            }
            if(!grid.children.length)panel.append(make('p','dpc-home-meta','No challenges in this section.'));
            b.onclick=()=>select(def.id,true);
            b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?defs.length-1:(i+(e.key==='ArrowLeft'?-1:1)+defs.length)%defs.length;select(defs[next].id,true);buttons[next].focus();};
        }
        const readTab=()=>location.hash.replace(/^#+/,'').toLowerCase();
        select(readTab());addEventListener('hashchange',()=>select(readTab()));addEventListener('popstate',()=>select(readTab()));
        $('#dpc-original').onclick=()=>original();mount();
    }

    function buildSubmission(){
        const upload=document.getElementById('upload_container'),submit=document.getElementById('submit'),agreement=document.getElementById('agreement_check');
        const uploadSection=upload?.closest('.divider_container');
        const detailHeading=[...document.querySelectorAll('.divider')].find(n=>/^Challenge Details\b/i.test(n.textContent.trim()));
        const detailSection=detailHeading?.nextElementSibling;
        if(!uploadSection||!submit||!agreement||!detailSection)return; // Leave other submission states native until their markup is known.
        const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
        const title=detailHeading.textContent.trim().replace(/^Challenge Details\s*[-–—]?\s*/i,'');
        const fields=new Map();
        for(const row of detailSection.querySelectorAll('tr'))if(row.cells.length===2)fields.set(row.cells[0].textContent.trim().replace(/:$/,''),row.cells[1]);
        const rules=[...document.querySelectorAll('table')].find(t=>t.rows.length===2&&t.rows[0].textContent.trim()==='Rules at a Glance')?.rows[1].cells[0];
        const classic=document.getElementById('classic');
        app.innerHTML=header+'<main class="dpc-home dpc-submit-page"></main>'+footer;
        const body=$('.dpc-submit-page');
        const back=make('a','dpc-submit-back','← Open for entries');back.href='/challenge_index.php#submit';body.append(back);
        const hero=make('section','dpc-profile-card dpc-submit-card');body.append(hero);
        hero.append(make('div','dpc-submit-kicker','Challenge entry'),make('h1','dpc-submit-title',title));
        const description=fields.get('Challenge Details');if(description)hero.append(make('p','dpc-submit-description',description.textContent.trim()));
        const meta=make('dl','dpc-submit-meta');hero.append(meta);
        for(const [key,label] of [['Challenge Type','Type'],['Challenge Rules','Editing rules'],['Submission Deadline','Deadline'],['Voting Dates','Voting'],['Extra Rules','Extra rules']]){
            const cell=fields.get(key);if(!cell)continue;const dt=make('dt','',label),dd=make('dd');const a=cell.querySelector('a[href]');if(a){const link=make('a','',a.textContent.trim());link.href=a.href;dd.append(link);}else dd.textContent=cell.textContent.trim();meta.append(dt,dd);
        }
        const entryForm=document.querySelector('form[name="frmSubmit"]');
        const submitted=fields.get('Your Submission');
        if(entryForm&&entryForm.elements.namedItem('SubmitUpdate')){
            const card=make('section','dpc-profile-card dpc-submit-card dpc-entry-editor');body.append(card);
            const heading=make('h2','','Your entry');card.append(heading);
            const thumb=document.querySelector('a[href*="challenge_submit_preview.php"] img');
            if(thumb){const image=make('img','dpc-entry-preview');const url=new URL(thumb.src,location.href);url.searchParams.delete('TYPE');image.src=url.href;image.alt='Current entry';image.onerror=()=>{image.onerror=null;image.src=thumb.src;};card.append(image);}
            if(submitted){
                card.append(make('p','dpc-entry-status','Entry received. You can edit it until the deadline.'));
                const links=make('div','dpc-entry-links');
                for(const link of [...submitted.querySelectorAll('a[href]')].reverse()){link.classList.add('dpc-entry-link');link.textContent=link.href.includes('unsubmit')?'Unsubmit entry':'Preview entry';links.append(link);}
                card.append(links);
            }
            const originalLink=document.querySelector('a[href*="challenge_submit_original.php"]');
            if(originalLink){const link=originalLink.cloneNode(true);link.textContent='Submit original';link.classList.add('dpc-entry-link');(card.querySelector('.dpc-entry-links')||card).append(link);}
            const heading2=make('h2','','Entry details');card.append(heading2);
            const originalTables=[...entryForm.children].filter(n=>n.tagName==='TABLE');
            // Keep every actual field, hidden input and the original form submission/validation.
            const layout=make('div','dpc-entry-fields');
            const field=(name,label,parent=layout)=>{
                const control=entryForm.elements.namedItem(name);if(!control)return;
                const wrap=make('div','dpc-entry-field');const lab=make('label','',label);
                if(!control.id)control.id='dpc-entry-'+name;lab.htmlFor=control.id;wrap.append(lab);
                if(name==='DETAILS'){
                    const toolbar=make('div','dpc-entry-toolbar');
                    for(const a of [...control.parentElement.querySelectorAll('a[onclick],a[id],input[type=file]')]){
                        if(a.tagName==='A'){const label=a.querySelector('img')?.title||a.textContent.trim();a.title=label;a.setAttribute('aria-label',label);const names=['Bold','Italic','Underline','Strike','Image','Link','Thumbnail','User','Portfolio','Upload'];const short=names[toolbar.querySelectorAll('a').length]||label;a.replaceChildren(make('span','dpc-entry-tool-text',short));}
                        toolbar.append(a);
                    }
                    wrap.append(toolbar);
                }
                wrap.append(control);parent.append(wrap);
            };
            field('TITLE','Title');field('DETAILS','Details');
            const titleInput=entryForm.elements.namedItem('TITLE');if(titleInput&&/^\d{7,}$/.test(titleInput.value)){titleInput.placeholder='Give your entry a title';titleInput.value='';}
            const date=make('div','dpc-entry-field');date.append(make('span','dpc-entry-label','Exposure date'));const dates=make('div','dpc-entry-date');field('day','Day',dates);field('month','Month',dates);field('year','Year',dates);date.append(dates);layout.append(date);
            field('EXPOSURE_LOCATION','Location');field('KEYWORDS','Keywords');field('CAMERA_ID','Camera');field('LENS_ID','Lens');
            const exposure=make('div','dpc-entry-exposure');field('APERTURE','Aperture',exposure);field('ISO','ISO',exposure);field('SHUTTER','Shutter speed',exposure);layout.append(exposure);
            const critique=entryForm.elements.namedItem('chkCritique');if(critique){const label=make('label','dpc-entry-critique');label.append(critique,make('span','','I would like an in-depth critique on my submission.'));layout.append(label);layout.append(make('p','dpc-entry-help','For an in-depth critique, complete the exposure settings and location, and provide at least 50 characters of details.'));}
            const actions=make('div','dpc-upload-actions');const update=entryForm.elements.namedItem('SubmitUpdate'),cancel=entryForm.elements.namedItem('Cancel');actions.append(update);if(cancel)actions.append(cancel);layout.append(actions);
            const faq=entryForm.querySelector('a[href*="#exif"]');if(faq){faq.textContent='Help with exposure settings';layout.append(faq);}
            for(const table of originalTables)table.hidden=true;
            for(const child of [...entryForm.children])if(child.tagName==='BR')child.remove();
            entryForm.append(layout);card.append(entryForm);
        }
        if(rules){const ruleCard=make('section','dpc-profile-card dpc-submit-card');body.append(ruleCard);const h=make('h2');h.append('Before you ',make('em','','upload'));ruleCard.append(h);
            const grid=make('div','dpc-submit-rule-grid');ruleCard.append(grid);
            for(const li of rules.querySelectorAll('li')){const cell=make('div');const label=li.querySelector('b')?.textContent||'';cell.append(make('strong','',label.replace(/:$/,'')),make('span','',li.textContent.replace(label,'').trim()));grid.append(cell);}
            const a=[...rules.querySelectorAll('a')].find(a=>/challenge_rules\.php/.test(a.href));if(a){const link=make('a','dpc-submit-rules-link','Read the full challenge rules →');link.href=a.href;link.target='_blank';link.rel='noopener';ruleCard.append(link);}
        }
        const uploadCard=make('section','dpc-profile-card dpc-submit-card dpc-upload-card');body.append(uploadCard);
        const h=make('h2');h.append(entryForm?'Replace your ':'Upload your ',make('em','','entry'));uploadCard.append(h);
        // Move the original live DOM, never clone or recreate the uploader, hidden inputs, or consent.
        uploadCard.append(uploadSection);
        uploadSection.classList.add('dpc-native-upload');
        const drop=uploadSection.querySelector('#upload_file'),picker=uploadSection.querySelector('#imagePicker');
        if(drop){
            // Hide only the legacy decorative prompt, never the file input or uploader shim.
            for(const child of drop.children){
                if(child.matches('input, .plupload, .moxie-shim')||child.querySelector('input, .plupload, .moxie-shim'))continue;
                if(child.tagName==='IMG'||/^(Upload A File|\.\.\.or drag one here)/i.test(child.textContent.trim()))child.classList.add('dpc-legacy-upload-prompt');
            }
            const caption=make('span','dpc-upload-caption');caption.append(make('strong','','Choose a photo'),make('span','dpc-upload-hint',''));drop.append(caption);drop.setAttribute('aria-label','Choose a photograph to upload');
        }
        if(picker){picker.classList.add('dpc-workshop-picker');picker.parentElement.classList.add('dpc-workshop-button');picker.parentElement.querySelectorAll('img').forEach(im=>im.style.setProperty('display','none','important'));}
        const agreementTable=agreement.closest('table');if(agreementTable)agreementTable.classList.add('dpc-upload-agreement');
        const selection=uploadSection.querySelector('#file_selection');
        // Leave native selection and progress markup visible. A local preview is cosmetic only.
        const caption=drop?.querySelector('.dpc-upload-caption');
        const warnings=make('div','dpc-upload-warnings');warnings.hidden=true;warnings.setAttribute('role','status');drop?.after(warnings);
        const ruleItems=[...(rules?.querySelectorAll('li')||[])];
        const sizeRule=ruleItems.find(li=>/File Size/i.test(li.textContent))?.textContent||'';
        const sizeMatch=sizeRule.match(/([\d,.]+)\s*(kb|mb|bytes)/i);
        const maxBytes=sizeMatch?Number(sizeMatch[1].replace(/,/g,''))*({kb:1024,mb:1048576,bytes:1}[sizeMatch[2].toLowerCase()]):null;
        const dimensionRule=ruleItems.find(li=>/Dimension/i.test(li.textContent))?.textContent||'';
        const dimensions=[...dimensionRule.matchAll(/(\d+)\s*pixels/gi)].map(m=>Number(m[1]));
        let selectedFile=null;
        function checkFile(image){
            const messages=[];if(selectedFile){
                if(maxBytes&&selectedFile.size>maxBytes)messages.push('File is '+(selectedFile.size/1024).toFixed(0)+' kB; the challenge limit is '+sizeMatch[1]+' '+sizeMatch[2]+'. Resize or compress it before uploading.');
                if(!/\.jpe?g$/i.test(selectedFile.name)&&selectedFile.type!=='image/jpeg')messages.push('This challenge requires a JPEG image.');
                if(image&&dimensions.length===2&&(Math.min(image.naturalWidth,image.naturalHeight)<dimensions[0]||Math.max(image.naturalWidth,image.naturalHeight)>dimensions[1]))messages.push('Image dimensions are '+image.naturalWidth+' × '+image.naturalHeight+' px. Allowed range: '+dimensions[0]+'–'+dimensions[1]+' px per side.');
            }
            warnings.replaceChildren(...messages.map(message=>make('p','',message)));warnings.hidden=!messages.length;
        }
        let localURL=null;
        const localPreview=make('img','dpc-local-entry-preview');localPreview.alt='Selected photo';localPreview.hidden=true;
        if(caption)caption.prepend(localPreview);
        document.addEventListener('change',event=>{
            const input=event.target;
            if(!input?.matches?.('input[type=file]')||!upload.contains(input)||!uploadCard.isConnected)return;
            const file=input.files?.[0];if(!file)return;selectedFile=file;checkFile();
            if(localURL)URL.revokeObjectURL(localURL);
            localPreview.hidden=true;localURL=null;uploadCard.classList.remove('dpc-local-preview-ready');
            if(file.type.startsWith('image/')||file.name.toLowerCase().endsWith('.jpg')||file.name.toLowerCase().endsWith('.jpeg')){
                localURL=URL.createObjectURL(file);localPreview.src=localURL;
            }
            if(caption){caption.hidden=false;caption.querySelector('strong').textContent='Choose a different photo';caption.querySelector('.dpc-upload-hint').textContent='';}
        },true);
        localPreview.addEventListener('load',()=>{localPreview.hidden=false;uploadCard.classList.add('dpc-local-preview-ready');checkFile(localPreview);});
        localPreview.addEventListener('error',()=>{localPreview.hidden=true;uploadCard.classList.remove('dpc-local-preview-ready');});
        if(selection){
            selection.classList.add('dpc-upload-selection');
            // Suppress camera-generated numeric filename labels, not upload state or progress.
            const hideNumericNames=()=>{
                const walker=document.createTreeWalker(selection,NodeFilter.SHOW_TEXT);
                const labels=[];
                while(walker.nextNode()){
                    const node=walker.currentNode;
                    if(node.parentElement?.closest('.dpc-numeric-filename,script,style,button,select,textarea'))continue;
                    if(/^\d{7,}(?:\.jpe?g)?$/i.test(node.textContent.trim()))labels.push(node);
                }
                for(const node of labels){
                    const label=make('span','dpc-numeric-filename');label.hidden=true;
                    node.before(label);label.append(node);
                }
            };
            new MutationObserver(hideNumericNames).observe(selection,{subtree:true,childList:true,characterData:true});
            hideNumericNames();
        }
        const fallback=make('a','dpc-submit-rules-link','Use original upload page');fallback.href=location.href;fallback.onclick=e=>{e.preventDefault();original();};uploadCard.append(fallback);
        const cancel=uploadSection.querySelector('input[type=button][value=Cancel]');if(cancel){cancel.onclick=()=>{location.href='/challenge_index.php#submit';};const actions=make('div','dpc-upload-actions');submit.before(actions);actions.append(submit,cancel);}
        for(const node of [...uploadSection.childNodes]){if(node.nodeType===1&&node.tagName==='BR')node.remove();}
        const spacer=upload.nextElementSibling;if(spacer?.tagName==='DIV'&&spacer.style.clear==='both')spacer.remove();
        if(classic){classic.classList.add('dpc-profile-card','dpc-submit-card','dpc-classic-upload');body.append(classic);}
        // Picker plugins may append their overlay directly to body; keep those native nodes visible.
        root.classList.add('dpc-submission');
        $('#dpc-original').onclick=()=>original();
        mount();
        function refreshUploader(){try{window.uploader?.refresh();}catch{}}
        requestAnimationFrame(refreshUploader);addEventListener('load',refreshUploader,{once:true});addEventListener('resize',refreshUploader);
        if(drop&&window.ResizeObserver){const observer=new ResizeObserver(refreshUploader);observer.observe(drop);}
    }

    function buildForum(){
        const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
        const clean=n=>(n?.textContent||'').replace(/\s+/g,' ').trim();
        const href=(a,base=location.href)=>{try{const u=new URL(a.getAttribute('href'),base);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
        const params=new URLSearchParams(location.search),tid=params.get('FORUM_THREAD_ID'),action=params.get('action')||'';
        const originalLinks=[...document.querySelectorAll('a[href]')];
        const label=a=>clean(a)||a.title||a.querySelector('img')?.alt||a.querySelector('img')?.title||'';
        const link=(a,txt,base)=>{const n=make('a','',txt||label(a));n.href=href(a,base);return n;};
        const isThread=a=>/FORUM_THREAD_ID=/i.test(href(a));
        const isSection=a=>/FORUM_SECTION_ID=/i.test(href(a))&&!isThread(a);
        const forms=[...document.forms].filter(f=>f.querySelector('textarea')||/forum/i.test(f.action)&&f.querySelector('input[type=submit],button'));
        const postRows=doc=>[...doc.querySelectorAll('.dpc-forum-author-details')].map(n=>n.closest('tr')).filter((r,i,a)=>r&&a.indexOf(r)===i&&r.querySelector('.dpc-forum-message,.forum-post'));
        const initialPosts=postRows(document);
        const listRows=[...document.querySelectorAll('tr')].filter(r=>[...r.cells].some(c=>[...c.querySelectorAll('a[href]')].some(a=>a.closest('tr')===r&&(isThread(a)||isSection(a))&&clean(a))));
        if(!initialPosts.length&&!listRows.length&&!forms.length)return;
        app.innerHTML=header+'<div class="dpc-forum-page"></div>'+footer;
        const body=$('.dpc-forum-page');
        const css=make('style');css.textContent=
        '#dpc-app .dpc-home-thread a{text-decoration:none;color:inherit}#dpc-app .dpc-home-thread a.dpc-thread-category{color:var(--accent)}'+
        '#dpc-app .dpc-forum-page{max-width:800px;margin:auto;padding:14px 12px 30px;overflow-wrap:anywhere}#dpc-app .dpc-forum-page h1{font:600 23px/1.2 system-ui;margin:14px 0}#dpc-app .dpc-forum-page h2{font:600 13px/1.4 system-ui;border-left:3px solid var(--accent);padding-left:9px;margin:22px 0 9px}#dpc-app .dpc-forum-page a{color:var(--accent);text-decoration:none}#dpc-app .dpc-forum-nav{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0 14px;font-size:12px}#dpc-app .dpc-forum-nav a,#dpc-app .dpc-forum-nav button,#dpc-app .dpc-forum-more{border:1px solid var(--line);background:transparent;color:var(--accent);padding:9px 12px;border-radius:5px;font:500 13px system-ui}#dpc-app .dpc-forum-card{background:#25262e;border:1px solid #ffffff20;border-radius:6px;padding:12px;margin:0 0 8px;min-width:0}html.dpc-light #dpc-app .dpc-forum-card{background:white;border-color:#cdd3df}#dpc-app .dpc-forum-card .dpc-forum-title{font:600 15px/1.35 system-ui;color:inherit;display:block}#dpc-app .dpc-forum-meta{font:400 11px/1.5 system-ui;color:var(--muted);margin-top:6px}#dpc-app .dpc-forum-prose{font:400 14px/1.65 system-ui;margin-top:12px;overflow-wrap:anywhere}#dpc-app .dpc-forum-prose img{max-width:100%;height:auto}#dpc-app .dpc-forum-prose table{max-width:100%;width:100%!important;table-layout:fixed}#dpc-app .dpc-forum-prose blockquote,#dpc-app .dpc-forum-prose .quote{margin:8px 0;padding:10px;border-left:2px solid var(--accent);background:var(--line)}#dpc-app .dpc-forum-page textarea,#dpc-app .dpc-forum-page input:not([type=hidden]):not([type=checkbox]):not([type=radio]),#dpc-app .dpc-forum-page select{font:inherit;max-width:100%;box-sizing:border-box}#dpc-app .dpc-forum-page textarea{width:100%!important;min-height:180px;background:transparent;color:inherit;border:1px solid var(--muted);border-radius:5px;padding:10px}#dpc-app .dpc-forum-page form table{width:100%!important;max-width:100%;table-layout:fixed}#dpc-app .dpc-forum-page form td{white-space:normal!important;overflow-wrap:anywhere}#dpc-app .dpc-forum-page input[type=submit],#dpc-app .dpc-forum-page button{padding:9px 12px;border-radius:5px;cursor:pointer}#dpc-app .dpc-forum-card{scroll-margin-top:90px}#dpc-app .dpc-forum-more{width:100%;margin:10px 0}';
        document.head.append(css);
        const nav=make('nav','dpc-forum-nav');const all=make('a','','All forums');all.href='/forum.php';nav.append(all);
        const section=originalLinks.find(a=>isSection(a)&&clean(a)&&!a.closest('.dpc-forum-message'));
        if(tid&&section)nav.append(link(section));
        const heading=make('h1','',document.title.replace(/\s*-\s*DPChallenge Forums.*$/i,'').replace(/^DPChallenge Forums$/i,'Forums'));
        body.append(heading,nav);
        const controls=make('div','dpc-forum-nav');body.append(controls);
        const actionLinks=originalLinks.filter(a=>/^(?:new (?:thread|topic|post)|create (?:thread|topic)|post (?:a )?reply|reply|subscribe|unsubscribe|search forums|forum search|mark.*read)$/i.test(label(a)));
        const seenActions=new Set();for(const a of actionLinks){const u=href(a);if(!u||seenActions.has(u)||a.closest('.dpc-forum-message'))continue;seenActions.add(u);controls.append(link(a));}
        const feed=make('div','dpc-forum-feed');body.append(feed);
        const stripGraphics=(node,base)=>{for(const im of [...node.querySelectorAll('img')]){const src=im.getAttribute('src')||'';if(/(?:^|\/)(?:images|include|icons)\/|(?:pix|spacer|folder|button|arrow|smil|emoticon|icon)[^/]*\.(?:gif|png)$/i.test(src)&&!/\/(?:image|photo|profile)[^/]*\//i.test(src)){const t=im.alt||im.title||'';im.replaceWith(document.createTextNode(t));}else{try{im.src=new URL(src,base).href;}catch{}im.loading='lazy';im.removeAttribute('width');im.removeAttribute('height');}}for(const el of node.querySelectorAll('[background]'))el.removeAttribute('background');for(const a of node.querySelectorAll('a[href]')){const u=href(a,base);if(u)a.href=u;}};
        const known=new Set();let firstUnread=null;
        function renderPosts(doc,base){
            let count=0;
            for(const row of postRows(doc)){
                const author=row.querySelector('.dpc-forum-author-details'),message=row.querySelector('.dpc-forum-message .forum-post td,.dpc-forum-message .forum-post,.dpc-forum-message');
                if(!message)continue;
                const nativeAnchor=row.querySelector('a[name],a[id]'),act=row.querySelector('.dpc-forum-actions');
                const key=nativeAnchor?.name||nativeAnchor?.id||[clean(author),clean(act),clean(message)].join('|');
                if(known.has(key))continue;known.add(key);count++;
                const card=make('article','dpc-forum-card');if(nativeAnchor&&(nativeAnchor.name||nativeAnchor.id))card.id=nativeAnchor.name||nativeAnchor.id;
                const person=author.querySelector('a[href*="profile.php"]');const head=person?link(person,clean(person),base):make('strong','',clean(author));head.className='dpc-forum-title';card.append(head);
                if(act){const copy=act.cloneNode(true);copy.querySelectorAll('a,img,span').forEach(n=>n.remove());card.append(make('div','dpc-forum-meta',clean(copy)));}
                const prose=make('div','dpc-forum-prose');for(const child of message.childNodes)prose.append(child.cloneNode(true));stripGraphics(prose,base);card.append(prose);
                const actions=make('div','dpc-forum-nav');for(const a of (act||row).querySelectorAll('a[href]')){const t=label(a);if(/reply|quote|edit|report|permalink/i.test(t)&&href(a,base))actions.append(link(a,t,base));}if(actions.children.length)card.append(actions);
                if(!firstUnread&&[row,...row.querySelectorAll('img,a')].some(n=>/\bunread\b|new post/i.test([n.className,n.title,n.alt,n.getAttribute('name')].join(' '))))firstUnread=card;
                feed.append(card);
            }return count;
        }
        if(initialPosts.length){
            renderPosts(document,location.href);
            const unread=make('button','','Jump to unread');unread.type='button';nav.append(unread);
            unread.onclick=()=>{if(firstUnread){firstUnread.scrollIntoView({block:'start'});return;}const a=originalLinks.find(a=>/unread|readrecent|firstnew/i.test(label(a)+' '+href(a)));if(a){location.href=href(a);return;}const u=new URL(location.href);u.searchParams.set('action','readrecent');u.hash='';if(u.href!==location.href)location.href=u.href;else feed.lastElementChild?.scrollIntoView({block:'start'});};
        }else if(!forms.some(f=>f.querySelector('textarea'))){
            let group='';
            for(const row of listRows){
                const anchors=[...row.querySelectorAll('a[href]')].filter(a=>a.closest('tr')===row&&clean(a));
                const a=anchors.find(isThread)||anchors.find(isSection);if(!a)continue;
                const u=href(a);if(known.has(u))continue;known.add(u);
                const card=make('article','dpc-forum-card');const title=link(a);title.className='dpc-forum-title';card.append(title);
                const sec=anchors.find(x=>x!==a&&isSection(x));if(sec)card.append(link(sec));
                const cell=a.closest('td');const desc=clean(cell).replace(clean(a),'').trim();if(desc)card.append(make('div','dpc-forum-prose',desc));
                const meta=[...row.cells].filter(c=>c!==cell).map(clean).filter(Boolean).join(' · ');if(meta)card.append(make('div','dpc-forum-meta',meta));
                card.addEventListener('click',e=>{if(!e.target.closest('a,button,input')&&!getSelection()?.toString())location.href=u;});feed.append(card);
            }
        }
        function nextPage(doc,base){
            const current=new URL(base);const links=[...doc.querySelectorAll('a[href]')].filter(a=>{try{const u=new URL(href(a,base));return u.pathname===current.pathname&&u.searchParams.get('FORUM_THREAD_ID')===tid&&u.href!==current.href;}catch{return false;}});
            const explicit=links.find(a=>/^(?:next(?: page)?|next posts?|>|»|→)$/i.test(label(a).trim())||a.rel==='next');if(explicit)return href(explicit,base);
            const pageKey=['PAGE','page','OFFSET','offset','start','START'].find(k=>links.some(a=>new URL(href(a,base)).searchParams.has(k)));if(!pageKey)return '';
            const here=Number(current.searchParams.get(pageKey)||(/page/i.test(pageKey)?1:0));return links.map(a=>href(a,base)).filter(u=>Number(new URL(u).searchParams.get(pageKey))>here).sort((a,b)=>Number(new URL(a).searchParams.get(pageKey))-Number(new URL(b).searchParams.get(pageKey)))[0]||'';
        }
        if(initialPosts.length){
            let next=nextPage(document,location.href),busy=false;const visited=new Set([location.href]);const more=make('button','dpc-forum-more','Load more posts');more.type='button';body.append(more);
            const nativePages=make('div','dpc-forum-nav');for(const a of originalLinks.filter(a=>isThread(a)&&/^(?:\d+|next|previous|first|last|[<>«»])$/i.test(label(a))))nativePages.append(link(a));if(nativePages.children.length)body.append(nativePages);
            async function load(){if(busy||!next||visited.has(next))return;busy=true;more.disabled=true;more.textContent='Loading posts…';const url=next;try{const response=await backgroundFetch(url,{credentials:'same-origin'});if(!response.ok)throw Error('HTTP '+response.status);const doc=new DOMParser().parseFromString(await response.text(),'text/html');const count=renderPosts(doc,response.url||url);visited.add(url);next=count?nextPage(doc,response.url||url):'';if(visited.has(next))next='';more.textContent=next?'Load more posts':'End of thread';}catch{more.textContent='Retry loading posts';io?.unobserve(more);}finally{busy=false;more.disabled=!next;}}
            more.onclick=load;more.hidden=!next;const io=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))load();},{rootMargin:'250px'}):null;if(next)io?.observe(more);
        }
        for(const form of forms){
            const box=make('section','dpc-forum-card');box.append(make('h2','',form.querySelector('textarea')?(tid?'Reply':'New thread'):'Forum options'));
            for(const im of [...form.querySelectorAll('img,input[type=image]')]){const t=im.alt||im.title||'Action';if(im.matches('input')){const b=make('button','',t);b.type='submit';b.name=im.name;b.value=im.value;im.replaceWith(b);}else if(im.closest('a'))im.replaceWith(document.createTextNode(t));else im.replaceWith(document.createTextNode(t));}
            box.append(form);body.append(box);
        }
        if(!feed.children.length&&!forms.length)return;
        $('#dpc-original').onclick=()=>original();mount();
    }

    document.addEventListener('click',captureGallery,true);
    if (isForum) { buildForum(); return; }
    if (isSubmit) { buildSubmission(); return; }
    if (isChallengeIndex) { buildChallengeIndex(); return; }
    if (isProfile) { buildProfile(); return; }
    if (isResults) { buildChallengeResults(); return; }
    if (isPhotoDetail) { buildPhotoDetail(); return; }
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

    function readPreview(){
        const photo=document.querySelector('#img_container img');
        if(!photo)return null;
        const title=document.querySelector('.imagetitle');
        const challenge=document.querySelector('a[title="Return to the Main Voting Screen"]');
        const edition=[...document.querySelectorAll('a')].find(a=>/Editing$/.test(a.textContent.trim()));
        const challengeId=new URL(location.href).searchParams.get('CHALLENGE_ID');
        return {source:photo.currentSrc||photo.src,title:title?.textContent.trim()||'Your entry',challenge:challenge?.textContent.trim()||'Challenge',edition:edition?.textContent.trim()||'',challengeId,id:'preview',index:NaN,ratings:[],comment:document.getElementById('COMMENT'),prev:null,next:null,progress:null,average:null};
    }
    let current = isPreview?readPreview():read(document,window);
    if (!current) return;

    let mode = !isPreview && localStorage.getItem('dpc-mode') === 'comment'
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

        <label class="dpc-auto-continue"><input type="checkbox" id="dpc-auto-continue"> Auto-continue</label>
    </div>

    <div class="dpc-panel" id="comment-panel">
        <div class="dpc-rating-label">
            <span>YOUR COMMENT</span>
            <span class="dpc-comment-score"></span>
        </div>
        <textarea id="dpc-comment-input"
                  autocomplete="off" placeholder="Share your thoughts…"></textarea>
        <div class="dpc-comment-hint">
            
        </div>
        <button type="button" id="dpc-submit-comment">Submit comment</button>
    </div>

    <div class="dpc-navigation">
        <button class="dpc-nav-button" id="dpc-prev">
            <span>←</span> Previous
        </button>
        <span class="dpc-nav-hint"></span>
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
    const autoContinue=$('#dpc-auto-continue');
    function syncAutoContinue(){
        const preference=localStorage.getItem('dpc-auto-continue');
        autoContinue.checked=preference===null?!current.selected:preference==='1';
    }
    autoContinue.onchange=()=>localStorage.setItem('dpc-auto-continue',autoContinue.checked?'1':'0');
    if(isPreview)autoContinue.closest('label').hidden=true;

    if(isPreview){app.classList.add('dpc-entry-preview-mode');$('.dpc-overview').innerHTML='←';$('.dpc-overview').setAttribute('aria-label','Back to entry');$('.dpc-navigation').hidden=true;$('.dpc-actions').hidden=true;$('#dpc-submit-comment').textContent='Preview only';}

    function status(s='') {
        $('.dpc-gallery-status').textContent = s;
        $('.dpc-gallery-status').hidden = !s;
    }

    function setBusy(v) {
        busy=v;
        if(!v){app.querySelectorAll('.dpc-saving-button').forEach(b=>{b.classList.remove('dpc-saving-button');b.removeAttribute('aria-busy');});}
        scores.forEach(b=>b.disabled=v);
        $('#dpc-prev').disabled=v||!current.prev;
        $('#dpc-next').disabled=v||!current.next;
        input.disabled=v||!current.comment;
        $('#dpc-submit-comment').disabled=v||!current.comment||!dirty||!(current.next||current.prev);
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
            if(!isPreview)localStorage.setItem('dpc-mode',mode);
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

        $('.dpc-challenge').textContent=isPreview?'Entry preview · '+current.edition:current.challenge;

        typeset(direction);

        if (current.challengeId) {
            $('.dpc-challenge').href=isPreview?new URL('/challenge_submit.php?CHALLENGE_ID='+encodeURIComponent(current.challengeId),location.origin).href:listURL(current.challengeId);
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

        const c=current.comment?.defaultValue||'';
        input.name='dpc-comment-'+current.challengeId+'-'+current.id;
        input.defaultValue=/^Enter your comment here/i.test(c)?'':c;

        input.value=/^Enter your comment here/i.test(c)?'':c;

        dirty=false;

        $('.dpc-comment-hint').textContent=current.comment
            ? ''
            : 'Comments unavailable';

        showStats(current);
        syncAutoContinue();
        favourite();

        $('#dpc-report').hidden=!current.report;

        tabs();
        setBusy(false);
    }

    function sync(page=current) {
        if (dirty&&page.comment&&page.id===current.id&&page.challengeId===current.challengeId&&page.frame&&new URL(page.win.location.href).searchParams.get('IMAGE_ID')===current.id) {
            page.comment.value=input.value;

            page.comment.dispatchEvent(
                new page.win.Event('input',{bubbles:true})
            );

            page.comment.dispatchEvent(
                new page.win.Event('change',{bubbles:true})
            );
        }
    }

    input.oninput=e=>{
        if(!e.isTrusted||busy)return;
        dirty=true;
        $('#dpc-submit-comment').disabled=busy||!current.comment||!(current.next||current.prev);

        $('.dpc-comment-hint').textContent=
            isPreview?'Preview only — nothing is submitted':'Unsaved comment';
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
            after=null,
            stay=false
        }=options;

        const p=current;
        const linkIndex=p.ratings.indexOf(link);

        setBusy(true);
        status('Saving…');
        if(score===null&&stay){const button=$('#dpc-submit-comment');button.classList.add('dpc-saving-button');button.setAttribute('aria-busy','true');}

        if (score!==null) {
            const pressed=scores.find(
                b=>b.dataset.score===String(score)
            );

            scores.forEach(b=>b.classList.remove('selected'));
            pressed?.classList.add('pressed','dpc-saving-button');
            pressed?.setAttribute('aria-busy','true');

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

                if (after||stay) {
                    status('Could not save. Please try again.');
                    setBusy(false);
                    return;
                }

                if(dirty){status('Could not safely save comment. Please try again.');setBusy(false);return;}
                if(p.comment)p.comment.value=p.comment.defaultValue;
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

        if(dirty&&(!actionPage.frame||actionPage.id!==p.id||actionPage.challengeId!==p.challengeId||!actionPage.comment||new URL(actionPage.win.location.href).searchParams.get('IMAGE_ID')!==p.id)){status('Comment not saved: photograph mismatch.');setBusy(false);return;}
        if(actionPage.comment&&!dirty)actionPage.comment.value=actionPage.comment.defaultValue;
        sync(actionPage);

        const frame=actionPage.frame;

        ++generation;

        let done=false, returning=false;
        const submittedComment=dirty?input.value:null;
        const savedScroll=scrollY;

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
                    if(stay&&!returning){returning=true;frame.src=imageURL(p.id);return;}
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

                if(stay&&updated.id!==p.id&&!returning){returning=true;frame.src=imageURL(p.id);return;}
                if(stay){
                    if(updated.id!==p.id||(score!==null&&updated.selected!==String(score)))return fail();
                    const saved=updated.comment?.defaultValue||'';
                    if(submittedComment!==null&&saved.replace(/\r\n/g,'\n').trim()!==submittedComment.replace(/\r\n/g,'\n').trim()&&!(submittedComment.trim()===''&&/^Enter your comment here/i.test(saved)))return fail();
                }
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

                if(stay){current=updated;position();slide(1,updated);update();status();neighbours();scrollTo(0,savedScroll);if(submittedComment!==null)$('.dpc-comment-hint').textContent='Comment saved';}
                else commit(updated,actualDirection);

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

    const submitComment=$('#dpc-submit-comment');
    // Prevent focus loss from collapsing the keyboard layout before click.
    submitComment.addEventListener('pointerdown',e=>{if(!submitComment.disabled)e.preventDefault();});
    submitComment.addEventListener('mousedown',e=>{if(!submitComment.disabled)e.preventDefault();});
    submitComment.onclick=()=>{if(!busy&&dirty&&!submitComment.disabled){const direction=current.next?1:-1;const link=current.next||current.prev;if(link){input.blur();nativeAction(link,{direction,stay:true});}}};
    $('#dpc-prev').onclick=()=>navigate(-1);
    $('#dpc-next').onclick=()=>navigate(1);

    scores.forEach(b=>{
        b.onclick=()=>{
            if(isPreview){
                current.selected=b.dataset.score;
                scores.forEach(score=>{const selected=score===b;score.classList.toggle('selected',selected);score.setAttribute('aria-pressed',String(selected));});
                $('.dpc-current-score').textContent=current.selected+' / 10';
                $('.dpc-comment-score').textContent='Rated '+current.selected+'/10';
                return;
            }
            const link=current.ratings.find(a=>
                a.textContent.trim()===b.dataset.score
            );

            nativeAction(link,{
                direction:1,
                score:Number(b.dataset.score),
                stay:!autoContinue.checked
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
        if(isPreview){location.href=$('.dpc-challenge').href;return;}

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


    // Keep the current photograph in view while the mobile keyboard is open.
    const commentInput=document.getElementById('dpc-comment-input');
    const vv=window.visualViewport;
    let keyboardBaseline=vv?.height||innerHeight;
    let keyboardActive=false;
    function syncCommentKeyboard(){
        const focused=document.activeElement===commentInput;
        const h=vv?.height||innerHeight;
        if(!focused&&!keyboardActive)keyboardBaseline=Math.max(h,innerHeight);
        const open=focused&&keyboardBaseline-h>100;
        if(open){root.style.setProperty('--dpc-keyboard-photo',Math.max(64,Math.floor(h-195))+'px');}
        if(open!==keyboardActive){keyboardActive=open;root.classList.toggle('dpc-comment-keyboard',open);if(open){scrollTo(0,0);requestAnimationFrame(()=>scrollTo(0,0));}else if(focused){commentInput.scrollIntoView({block:'nearest'});}}
    }
    commentInput.addEventListener('focus',()=>{keyboardBaseline=Math.max(vv?.height||0,innerHeight);syncCommentKeyboard();});
    commentInput.addEventListener('blur',syncCommentKeyboard);
    vv?.addEventListener('resize',syncCommentKeyboard);
    window.addEventListener('resize',syncCommentKeyboard);
    position();
    slide(1,current);
    update();
    if(!isPreview)neighbours();
    scrollTo(0,0);
}

/* V3.1 — Reliable photograph metadata */
if (isForum || isList || isHome || isPhotoDetail || isResults || isProfile || isChallengeIndex) {
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

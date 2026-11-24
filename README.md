# DPChallenge Mobile Restyle

An unofficial userscript bringing a modern, mobile-first photography magazine experience to [DPChallenge](https://dpchallenge.com/), designed primarily for Firefox on Android with Tampermonkey.

## Features

### Homepage
- Recent challenge results with swipeable full-size photographs, thumbnails, photographer credits and award ribbons.
- Voting cards with photograph backgrounds, challenge descriptions, deadlines, progress information and native voting links.
- All open challenges in a compact two-column grid of clickable cards.
- Community activity and a navigation menu.

### Voting and commenting
- Swipeable voting gallery with adjacent photograph preloading.
- Full-screen photograph viewing with pinch-to-zoom.
- Native voting, commenting, favourites and reporting.
- Compact keyboard-aware commenting layout that keeps the photograph visible while typing.
- Explicit Submit comment button; comments also save when navigating to another photograph. Submission uses the native navigation flow.

### Contact sheets and appearance
- Responsive challenge contact sheets, rating filters and incremental image loading.
- Editorial typography, aperture branding and persistent light/dark themes.
- Early loading protection and an option to view the original website.

## Installation

Install Tampermonkey in a compatible browser, then [install the userscript directly from GitHub](https://raw.githubusercontent.com/Konador/dpc-mobile-restyle/main/dpc-mobile.user.js). Follow the installation prompt. With automatic updates enabled, Tampermonkey can check GitHub for newer versions.

The script restyles the homepage, voting pages and challenge voting contact sheets. Other pages retain their native presentation.

## Current status

Current userscript version: **4.34**. This is a work in progress, not an official DPChallenge app. Recent keyboard/comment submission and loading-flash changes still require live Firefox Android testing. Voting-card background selection currently considers only the fetched page, not every page of a challenge.

Firefox home-screen shortcuts may retain the site's default icon. Custom launcher shortcuts are an optional external workaround; the script does not replace the shortcut icon.

## Development

See [AGENTS.md](AGENTS.md) for design decisions, implementation constraints and regression checks. The project uses a single standalone userscript. Future work includes further community-feed polish and browser compatibility testing.

## Disclaimer

This independent project is not affiliated with or endorsed by DPChallenge. It changes the local presentation of the website rather than replacing its service. Photographs remain the property of their respective copyright holders.

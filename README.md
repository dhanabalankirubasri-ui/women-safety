# 🛡️ Guardian — AI Streetlight Safety System

A browser-based **prototype** for a smart-streetlight women's safety concept. Guardian watches a live camera + microphone feed, scans uploaded evidence files, and simulates instantly dispatching a location-tagged alert (with proof) to a control room the moment it flags risky activity.

> ⚠️ **This is a front-end simulation, not a deployed safety product.** Detection is randomized/keyword-based, GPS is real (your browser's), and alerts are logged in-memory rather than sent via SMS. See [How detection actually works](#how-detection-actually-works) before using this for anything but a demo.

---

## What it does

| Module | Description |
|---|---|
| **Live Monitor** | Turns on your webcam + mic, samples them at intervals, and raises an incident when a "risk" event is simulated — capturing a camera snapshot and mic dB level at that instant. |
| **File Scan** | Upload images, video, or audio "evidence." Each file is scored and flagged as risky or safe, with a confidence percentage. |
| **Auto Alert Dispatch** | Every flagged incident is bundled into a proof package (snapshot, audio level, GPS coordinates + Google Maps link, attached files) and "sent" to control-room contacts — simulating a Twilio SMS + Firebase push. |
| **Real GPS + Reverse Geocoding** | Uses `navigator.geolocation` for your actual coordinates, then reverse-geocodes them via OpenStreetMap Nominatim into a readable place name — no API key required. |
| **Alerts Log / Ignored Log** | Every incident is tracked as active/resolved, with the full evidence trail viewable at any time. |
| **Report Tab** | Rolls everything up into a summary view of incidents vs. safe activity. |

---

## Tech stack

- **React 18** + **Vite 5** — no router, no state library, single-file app (`src/app.jsx`)
- Styling is injected at runtime (no CSS framework) with a dark, HUD-style aesthetic (Orbitron/Rajdhani fonts)
- Browser-native APIs only: `getUserMedia`, `geolocation`, `canvas`, `URL.createObjectURL`
- Zero backend — everything runs client-side in this prototype

---

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL. On first load, allow **camera**, **microphone**, and **location** permissions for the full experience — each feature degrades gracefully if a permission is denied (e.g., alerts still fire without GPS, just marked "NOT AVAILABLE").

```bash
npm run build      # production build
npm run preview    # preview the production build locally
```

---

## How detection actually works

Being upfront about what's real vs. simulated here, since the UI is intentionally built to look production-grade:

- **Real:** camera/mic capture, GPS lat/lng, reverse geocoding, file previews, timestamps, the full incident state machine.
- **Simulated:** the actual "is this dangerous?" judgment. File names are checked against a small keyword list (`scream`, `attack`, `help`, etc.) and otherwise it's a weighted coin flip (`Math.random()`) that decides whether to flag an activity and pick a label like *"Fall Detected"* or *"Normal Pedestrian Movement."* Alert "sending" logs a message object to memory/console rather than calling Twilio or any SMS gateway.

This makes it ideal for demoing the *user experience and alert workflow* of a smart-streetlight system, and a good scaffold to swap in a real model.

---

## Wiring in real detection (suggested path)

1. Replace `analyseFile()` in `src/app.jsx` with a call to an actual vision/audio model (e.g., a pose/action-recognition model for video, a scream/distress classifier for audio).
2. Replace `autoSendAlert()`'s console log with a real POST to a backend (Twilio, Firebase Cloud Messaging, or a police-dispatch API) — the request payload shape is already assembled for you (`incident`, `proof`, `POLICE_CONTACTS`).
3. Swap the hardcoded `POLICE_CONTACTS` array for a config value.
4. Persist incidents somewhere durable (they currently live only in React state and vanish on refresh).

---

## Project structure

```
streetlight-safety/
├── src/
│   ├── app.jsx        # entire application: UI, state, detection, alerting
│   ├── main.jsx        # React entry point
│   ├── app.css / index.css
├── index.html
├── vite.config.js
└── package.json
```

---

## Disclaimer

This project is a UX/engineering concept prototype for public safety infrastructure. It has not been evaluated for accuracy, bias, or reliability, and must not be relied on for real emergency response. Any deployment involving real surveillance, minors, or vulnerable individuals should undergo legal, ethical, and safety review first.

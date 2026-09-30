#Chrome Extension

This folder contains the Chrome extension client for the  project.

## Tech stack

- React
- TypeScript
- Vite
- Chrome Extension Manifest V3
- pnpm

## Project structure

```text
apps/extension/
├── public/
│   └── manifest.json
│
├── src/
│   ├── background/
│   │   └── index.ts
│   │
│   ├── content/
│   │   └── index.ts
│   │
│   └── popup/
│       ├── App.tsx
│       └── main.tsx
│
├── popup.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
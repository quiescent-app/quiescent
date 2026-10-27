# Installing Quiescent

These steps take you from nothing to a working copy of Quiescent on your computer: the Chrome extension loaded in your browser and the web app running locally.

## Prerequisites

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/), current LTS version (includes `npm`)
- [Google Chrome](https://www.google.com/chrome/)
- pnpm, the package manager this project uses:

```bash
npm install -g pnpm
```

If npm warns that pnpm "has install scripts not yet covered by allowScripts," you can ignore it; pnpm still works. Close the terminal and open a new one before continuing.

Check that everything is installed:

```bash
git --version
node --version
pnpm --version
```

## 1. Clone the repository

Run this from the folder where you want the project to live (e.g. `C:\dev`). Git creates the `quiescent` folder for you.

```bash
git clone https://github.com/quiescent-app/quiescent.git
cd quiescent
```

## 2. Install dependencies

```bash
pnpm install
```

This can take a few minutes the first time. Warnings about slow download speed are harmless.

## 3. Build the extension

```bash
pnpm --filter ./apps/extension build
```

This creates the folder `apps/extension/dist`.

## 4. Load the extension in Chrome

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `apps/extension/dist` folder.

After you rebuild the extension, click the reload icon on its card in `chrome://extensions`.

## 5. Run the web app

```bash
pnpm --filter ./apps/web/ui dev
```

Open the address it prints (usually `http://localhost:5173`). Press `Ctrl+C` in the terminal to stop it.

This web app is still early in development and doesn't yet show the full product. To see the intended experience, use the [live prototype](https://readhub-demo.netlify.app/).

## Troubleshooting

- **`'pnpm' is not recognized`**: close the terminal, open a new one, and try again.
- **Chrome says "Manifest file is missing or unreadable"**: you selected the wrong folder. Select `apps/extension/dist`, not `apps/extension`.
- **`make` is not recognized** (Windows): the `make` commands in the README need extra setup on Windows. Use the `pnpm` commands in this guide instead.
- **Database setup**: the database steps under "Local setup" in the README are for API development. You don't need them for the steps above.

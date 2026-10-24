# Quiescent

## What Quiescent is

Quiescent is an extension plus a web app that helps you read more intentionally, thus more efficiently, by acting as your personal library + notebook.

## The problem it solves

"Self-development" people who try to learn new things in their free time get discouraged and distracted by unfiltered learning sources, inconsistent habit, and a fragmented reading space.

We help them:

**P0**

- Quickly save and categorize articles + books into folders
- Highlight and take quick notes with an AI assistant in a built-in e-reader view

**P1**

- Review and customize notes
- Receive routine reminders and recaps
- Create a streak to motivate consistency

## The main concepts and terminology a new contributor should understand

### P0: MVP

#### Extension & account + sync

- **Extension:**
  - The extension copies the full article text from the page, not just the URL, so even paywalled pages work.
  - One click saves the current page, and the reader chooses Read now or Later.
- **Account & sync:**
  - Users need an account to save their reads, either using the **extension** or the manual upload in the **web app**.
  - They can create an account via Google account or their email address.
  - After they save the read, it appears in the library (inside the web app) the next time the page loads. _(Question: should saves appear instantly without a website refresh? Not decided yet.)_

#### Web app

- **Library / home page:** The first page users see after they sign in.
  - **By status:**
    - Users' saves categorized into "In Progress", "Read Later", "Finished".
    - With extension: The saves go to "Read Later" if users click "Later" in the saving process and go to "In Progress" if they click "Read now".
    - With manual upload: The default status is "Read Later".
    - Read Later → In Progress: when users open a save and scroll through 10% or more of the text.
    - Finished: The saves go to "Finished" when users finish 95% of a piece of reading (their last scroll position before they exit is at 95% or more of the text).
    - Users can manually move a save to any status.
  - **By folder:** Saves categorized into customized folders. This view only appears after the user creates a folder through "Create new folder".
  - **Sort and filter:**
    - Sort: Time saved, A→Z, Length (ascending, descending)
    - Filter: By format (link/file), by time (this day/week/month), by platform (Substack, Medium, other websites, local files (PDF, e-pub), etc.)
- **Focused reader view:**
  - Users can open it by either clicking "Most recent read" in the sidebar or the titles of the saves.
  - It opens inside the page with a full-screen option for users.
  - It is incorporated with highlight (mark texts), highlight + notes (mark texts and attach notes), the side panel (shows both), and Q, an AI assistant that opens from a **floating action button (FAB)**.
- **Q:** AI assistant in the focused reader view that can answer users' questions during the reading process.
  - Users can open it by either clicking the FAB or marking the text and choosing the "Ask Q!" option. A text box appears on the screen.
  - Users can turn it on and off in the reader view.
  - It can summarize the article or chapter, and the user's notes on that save.
  - It has web access for external searching.
  - It only remembers conversations in one session. A session lasts until the user closes the web tab.
  - **What happens on each question:**
    1. The reader asks a question.
    2. The web app loads that save's text from our database. This is the copy stored at save time, from either the extension or a manual upload; nothing is re-fetched from the original web page.
    3. The app sends the AI provider (e.g. OpenAI) one request containing: the article or chapter text, the questions and answers so far this session, and the new question.
    4. The model answers. Nothing is kept on the model's side.
- **Manual upload:** A button in the library page that allows users to add more articles/books.
  - Links (URLs) and files (PDF, e-pub) both work. **Scanned PDFs** are images of pages, with no actual text. Highlighting and Q won't work on them, but users will be notified by Q when they try it.
  - There's no limitation on the upload quantity in the MVP.
  - Each manual upload is categorized as "Read Later" by default until the user opens and reads at least 10% of the save or manually changes the status.
  - With URLs, paywalled links may not import fully; Quiescent will notify the user to save the page with the extension instead.
- **Event logging:** records what readers do in Quiescent, never what they read or write. It lets the team calculate every success metric in the PRDs and follow one reader's path from first save to returning the next week.
  - **Event:** a record that one action happened, e.g. `highlight_created`.
  - **Property:** a detail attached to an event, e.g. `content_type = pdf`.
  - **Server-side vs. client-side:** server-side events are recorded by our server when it completes an action (saves, sign-ins, uploads, Q requests) and are the source of truth. Client-side events are recorded by the browser or extension, only for on-screen actions like opening Q, and can be lost or blocked.
  - **Anonymous ID:** a random ID assigned before sign-in, linked to the account when the reader signs in ("identity stitching"), because the first save happens before sign-in.
  - **Not logged:** article text, highlighted passages, notes, Q's answers, or any browsing outside Quiescent. _(Open question: whether to log the text of Q questions.)_
  - **Logging never blocks the reader:** if an event fails to record, the save, highlight, or question still goes through.

### P1: v1 (adjusted MVP) — next steps, not now

- **Landing page:** The page that allows non-account users to have a basic look at the product. They can try manual uploading on this page too, which will navigate them into the sign-in process.
- Notes page with Q incorporated
- Reminder
- Streak
- Weekly review

## Where to find the most important parts of the project

### In this repo

| Path | What it is |
|---|---|
| `apps/extension/` | Chrome extension: saving pages, Read now / Later |
| `apps/web/ui/` | Web app interface: library, focused reader, Q panel |
| `apps/web/api/` | Server: accounts, database (Drizzle ORM + Neon PostgreSQL), requests to the AI provider |
| `docs/` | Team conventions (PR and branch naming) |
| `.github/` | Automated checks on GitHub |
| `Makefile` | Command shortcuts (`make install`, `make build`, `make test`) |

<!-- TODO: confirm with a developer that apps/web/api handles AI requests and what .github/ contains -->

### Outside the repo

- MVP PRD: [Google Doc](https://docs.google.com/document/d/13Hx0XqjFG1XhwYFYgr-cLnXAVKiP9-_Hvx-ECPETC3M)
- Live prototype: [readhub-demo.netlify.app](https://readhub-demo.netlify.app/)

## Local setup

Install the workspace dependencies:

```bash
make install
```

The API uses Drizzle ORM with a Neon PostgreSQL database. Create the local
environment file from the committed example:

```bash
cp apps/web/api/.env.example apps/web/api/.env
```

Then replace the
example `DATABASE_URL` in `apps/web/api/.env` with the Neon connection string.
Apply the committed migrations:

```bash
make db-migrate
```
Environment files and database credentials are ignored by Git. Never expose
`DATABASE_URL` to the web or extension clients.

## Development commands

Run the repository checks with:

```bash
make lint
make test
make build
```

Additional commands:

```bash
make format
```

After making changes to the database schema, generate a migration with a
short, descriptive name, then apply it to the configured database:

```bash
make db-generate NAME=change-name
make db-migrate
```

API database tests apply the committed migrations to a fresh, embedded PGlite
database, so `make test` does not require Neon credentials. The live Neon
health query runs only when `DATABASE_URL` is configured.

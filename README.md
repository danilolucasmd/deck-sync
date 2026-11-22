# DeckSync

A [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) plugin that backs up game saves from your Steam Deck to Google Drive, using [rclone](https://rclone.org) under the hood.

Each game gets its own folder in Drive, with the current save and a short history of what it replaced:

```
Games Save/
└── The Legend of Zelda - Ocarina of Time (Remaster)/
    ├── .decksync.json
    ├── save/                      latest save
    └── history/
        ├── 2026-11-20_19-43-51/   files replaced or deleted by that backup
        └── ...                    newest 30 kept by default
```

## Features

- Sign in to Google Drive from the Deck, no desktop mode needed.
- Pick a game from your library (Steam or non-Steam), its save folder on the Deck, and where it lives in Drive.
- Saves sync automatically when the game launches and exits, or on demand with **Sync**.
- **Two-way sync** (off by default): the newest save wins, so progress made on another device comes back to the Deck. Deck files it overwrites are kept in `history/` first.
- Notifications when files are backed up or restored. Can be turned off.
- Choose how many old saves each game keeps in `history/`: 20, 30, 50, or 100.

## Google Drive rate limits

By default DeckSync signs in through rclone's built-in Google app, which every rclone user shares, so Google often answers with `rateLimitExceeded`. For reliable syncing, create your own OAuth client by following [rclone's guide](https://rclone.org/drive/#making-your-own-client-id), then enter its client ID and secret under **Cloud provider > Use your own app** and sign in again.

## Safety checks

- A Drive folder can only belong to one game. DeckSync writes a small `.decksync.json` into each game folder and refuses to use a folder that belongs to a different game or that already holds files it didn't create.
- Two games can't share or nest Drive folders or Deck save folders.
- Your home folder (or anything above it) can't be used as a save folder.
- With two-way sync off, an empty save folder on the Deck never overwrites what's in Drive.
- In two-way mode the game is paused while saves are pulled at launch.
- Old history entries are removed with rclone's `purge`, which sends them to the Drive trash rather than deleting them outright.

## Installing

Build the plugin zip with the [Decky CLI](https://github.com/SteamDeckHomebrew/cli) and install it from Decky's developer settings, or copy the built folder to `~/homebrew/plugins/` on the Deck.

```bash
pnpm i
pnpm build
decky plugin build .
```

The CLI builds the backend in Docker, which downloads a checksum-verified rclone binary into `bin/`.

## Development

Requires Node.js 16.14+, pnpm 9, and Docker for the backend build. The VS Code tasks from the Decky template are included for building and deploying to a Deck over SSH; set your Deck's address in `.vscode/settings.json`.

Backend tests run against a local rclone remote, so they need rclone and pytest but no cloud account:

```bash
python -m pytest tests
```

## Adding providers

Providers are listed in `py_modules/decksync/providers.py`. Any rclone backend that supports browser sign-in can be added there, and it will show up in the provider list.

## License

BSD-3-Clause. See [LICENSE](LICENSE).

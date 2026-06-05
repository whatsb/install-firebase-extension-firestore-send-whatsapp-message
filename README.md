# whatsb-ext-installer

Simple CLI to install a local Firebase extension from a checked-out repository.

## Usage

Run the CLI with `npx`:

```bash
npx @whatsbox/firebase-whatsapp-extension-installer
```

> Note: `bin/cli.js` currently uses a hardcoded project ID for testing and does not yet parse `--project-id`.

## Prerequisites

- `git`
- `npm`
- `firebase-tools` installed or available via `npx`
- Firebase login (`firebase login`)


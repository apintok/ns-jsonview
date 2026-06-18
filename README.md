# NetSuite JSON View

A Chrome extension that detects JSON stored in NetSuite **Text Area** fields and displays it in a readable, collapsible tree view — without changing the underlying field value.

Built with [WXT](https://wxt.dev) (Manifest V3, TypeScript, vanilla DOM).

## Problem

NetSuite often stores integration payloads, configuration, and API responses in **Text Area** fields. On the UI these are marked with `<span data-field-type="textarea">` inside a parent `<div>`. Minified or deeply nested JSON is hard to read, debug, and validate.

## Solution

When a NetSuite Text Area contains valid JSON (an object or array), the extension **replaces** the raw field UI with a **JSON View** panel — **only while the record is in view mode**.

- **Tree** — collapsible key/value explorer (always shown)
- **Copy** — copies formatted JSON to the clipboard
- **Disable View** — hides the JSON view and restores the original field display (stays off until you reload the page)

### View mode vs edit mode

| Record mode | Extension behavior |
|-------------|-------------------|
| **View** | JSON tree replaces the field (if content is valid JSON) |
| **Edit** | Standard NetSuite textarea — no masking, no JSON panel |

Edit mode is detected when the field's `<textarea>` is not `readonly` and not `disabled`. Clicking **Edit** on a record removes the JSON view automatically; returning to view mode restores it (unless you used **Disable View**).

The underlying `<textarea>` stays in the DOM (visually hidden in view mode) so NetSuite save behavior stays intact.

## How it works

```
Page load on *.netsuite.com
        │
        ▼
Scan for div span[data-field-type="textarea"]
        │
        ▼
Read value from span text or inner <textarea> in parent div
        │
        ▼
Valid JSON object/array? ──no──► Leave field unchanged
        │
       yes
        ▼
Record in view mode? ──no (edit)──► Leave standard NetSuite field
        │
       yes
        ▼
Replace field with JSON View panel
        │
        ▼
Watch for edit mode (textarea becomes editable) → remove JSON view
```

### Detection rules

| Condition | Result |
|-----------|--------|
| `div` contains `span[data-field-type="textarea"]` | Candidate |
| Span text or inner `<textarea>` contains `{...}` or `[...]` | Parsed |
| Content is valid JSON object or array | Candidate |
| Textarea is `readonly` or `disabled` (view mode) | JSON panel shown |
| Textarea is editable (edit mode) | Standard NetSuite field only |

## Permissions

The extension follows a **least-privilege** model:

| Permission | Why |
|------------|-----|
| `host_permissions: *://*.netsuite.com/*` | Run the content script only on NetSuite pages |

No `storage`, `tabs`, or other Chrome permissions are required. The extension does not collect, transmit, or store user data.

## Project structure

```
ns-jsonview/
├── entrypoints/
│   └── netsuite.content/
│       ├── index.ts          # Content script — scan, detect, inject UI
│       └── style.css         # Panel and tree styles
├── utils/
│   ├── json.ts               # JSON detection and formatting
│   └── json-tree.ts          # Collapsible tree renderer
├── wxt.config.ts             # Manifest and host permissions
├── package.json
└── tsconfig.json
```

WXT auto-generates the manifest from `entrypoints/` and outputs builds to `.output/`.

### Icon

The extension icon is **`{NS}`** in monospace on a blue rounded square — NetSuite + JSON curly-bracket motif.

| File | Purpose |
|------|---------|
| `icon.svg` | Source artwork (edit this) |
| `public/icon/*.png` | Generated sizes (16, 32, 48, 96, 128) |

Regenerate PNGs after editing the SVG:

```bash
npm run icons
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- Google Chrome

### Install

```bash
npm install
```

### Dev mode (hot reload)

```bash
npm run dev
```

Load the unpacked extension from `.output/chrome-mv3-dev`:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3-dev` folder

**Keep `npm run dev` running** in a terminal while you use the dev build. WXT uses a WebSocket on `ws://localhost:3000/` for hot reload. If the dev server is stopped, Chrome will log:

```
WebSocket connection to 'ws://localhost:3000/' failed: net::ERR_CONNECTION_REFUSED
```

The extension may still work, but you will see that error on every page (including NetSuite). To avoid it, use a production build for testing (below).

### Production build (recommended for NetSuite testing)

```bash
npm run build
```

Output: `.output/chrome-mv3/`

Load `.output/chrome-mv3` as unpacked instead of `chrome-mv3-dev`. Production builds have **no WebSocket** and no dev-server dependency.

### Package for Chrome Web Store

```bash
npm run zip
```

Produces a store-ready `.zip` in `.output/`.

## “Chrome can't verify where this extension comes from”

This warning is **expected** when you load the extension via **Load unpacked** in Developer mode. Chrome only fully trusts extensions installed from the [Chrome Web Store](https://chrome.google.com/webstore) or deployed through enterprise policy.

It does **not** mean the extension is broken or malicious — it means Chrome cannot cryptographically verify the publisher because you are running a local development build.

### Safe to use during development

If you built this project yourself from source, you can keep using it:

1. Open `chrome://extensions`
2. Confirm **Developer mode** is on
3. Leave the extension **enabled**
4. Dismiss or ignore the review prompt — Chrome may show it again on startup

The extension only runs on `*.netsuite.com` and does not send data anywhere.

### How to remove the warning permanently

| Approach | Best for |
|----------|----------|
| **Publish to Chrome Web Store** (public or unlisted) | Individual users, wider distribution |
| **Chrome Enterprise policy** (`ExtensionInstallAllowlist`) | Company-internal NetSuite teams |
| **Private Chrome Web Store** (Google Workspace) | Org-only distribution |

For internal company use, an IT admin can allowlist the extension ID from `chrome://extensions` after the first unpacked install.

Publishing to the Web Store is the only way regular users get a verified, warning-free install without enterprise tooling.

## Troubleshooting: nothing appears on the page

After reloading the extension, check these steps on your NetSuite page:

1. **Reload the extension** at `chrome://extensions` (click the refresh icon on NetSuite JSON View), then hard-refresh the NetSuite tab.
2. **Confirm the content script loaded** — open DevTools → Console and run:
   ```js
   document.documentElement.dataset.nsJsonview
   ```
   It should return `"active"`. If `undefined`, the extension is not running on that URL.
3. **Run the built-in diagnostic** in the NetSuite tab console:
   ```js
   __nsJsonviewDiagnose()
   ```
   This prints a table with every candidate field: `fieldType`, `fieldId`, `valueLength`, `valuePreview`, and `isValidJson`.
4. **Enable debug logging** in the NetSuite tab console:
   ```js
   localStorage.setItem('ns-jsonview-debug', '1')
   ```
   Reload the page and look for `[ns-jsonview]` messages showing `fields`, `textareas`, and `enhanced` counts.
5. **Check the correct frame** — NetSuite often renders forms inside iframes. In the console, check:
   ```js
   document.documentElement.dataset.nsJsonviewFrame
   ```
   If it says `iframe`, run `__nsJsonviewDiagnose()` in that frame's console context (DevTools → top dropdown → pick the NetSuite iframe).
6. **Confirm the field contains valid JSON** — must start with `{` or `[` and parse successfully. Plain text will not trigger the panel.
7. **Account URLs** — NetSuite account pages use `https://ACCOUNT_ID.app.netsuite.com/...`. The extension matches both `*.netsuite.com` and `*.app.netsuite.com`.

## Testing on NetSuite

1. Load the extension (dev or production build).
2. Open a NetSuite record that has a **Text Area** field containing JSON, for example:

   ```json
   {"customer":{"id":12345,"name":"Acme Corp"},"items":[{"sku":"WIDGET-01","qty":2}]}
   ```

3. Confirm a **JSON View** panel appears below the field.
4. Use **Copy** and **Disable View** to verify behavior.
5. Edit the textarea — the panel should refresh or disappear if the content is no longer valid JSON.

## Known limitations

- **Plain `<textarea>` only** — Rich-text or custom NetSuite editors may need additional selectors.
- **Top-level objects and arrays** — JSON primitives (e.g. `"hello"`, `42`) are not enhanced.
- **Strict JSON** — Trailing commas, single-quoted keys, and other non-JSON syntax are ignored.
- **Iframes** — Fields inside iframes are not scanned unless `all_frames` support is added.

## Roadmap ideas

- [ ] Support for iframe-embedded NetSuite fields
- [ ] Optional prettify-on-blur for the textarea itself
- [ ] Extension popup toggle to enable/disable per session
- [ ] Chrome Web Store listing assets (screenshots, promo tiles)

## License

ISC

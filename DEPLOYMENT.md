# EatFirst deployment

Repository: https://github.com/amaijulianson-source/EatFirst

Public Pages target: https://amaijulianson-source.github.io/EatFirst/

## Configuration

- Public repository, existing default branch `main`. Its initial `.gitattributes` and commit history were preserved by merging, without force-pushing.
- GitHub Pages source: GitHub Actions. `.github/workflows/deploy.yml` validates and publishes default-branch updates automatically; manual dispatch is also available.
- CI runs lint, typecheck, unit tests, desktop/mobile browser tests and a production build. `BASE_PATH` derives from the exact repository name, generating `/EatFirst/` URLs for assets, manifest identity, launch URL, scope and service worker.
- HTTPS is provided by GitHub Pages. No custom domain, paid service or backend is used.
- PWA includes standalone mode, 192/512 PNG icons, a maskable icon, 180px Apple touch icon, iOS metadata, safe-area layout, offline app cache and local IndexedDB.

## Verification

```sh
PLAYWRIGHT_BASE_URL=https://amaijulianson-source.github.io/EatFirst/ npm run test:e2e
EATFIRST_URL=https://amaijulianson-source.github.io/EatFirst/ node tests/pwa-check.mjs
```

These commands use isolated browser profiles; grocery data stays in their own local browser storage. See VERIFICATION.md for actual results. The test suite checks normal food/recipe/shopping/waste flows and persistence. The PWA check validates icons, scopes, offline launch and refresh, page errors and phone-width overflow. Device installation is checked separately on an actual phone.

## Install

**iPhone:** Open the public URL in Safari, not the ChatGPT in-app browser. Share → Add to Home Screen → Open as Web App if offered → Add.

**Android:** Open the public URL in Chrome. ⋮ menu → Install app or Add to Home screen → Install.

Open the new home-screen icon and allow the initial online load to finish before trying offline mode. Browser/device labels vary. iOS can give the installed app its own storage context, so enter real groceries after installation or transfer a JSON backup. No automatic background expiry notifications or cross-device sync are provided.

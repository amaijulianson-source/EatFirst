# Deployment handoff

The complete EatFirst app is prepared and locally committed. Public publication was requested by the owner, but is currently blocked by access to the target GitHub repository.

## Required access

Connected GitHub login: **amaijulianson-source**. Access to `amaijulianson-source/Eatfirst` returns HTTP 404 via both the GitHub connector and CLI. This can mean the new repository belongs to another account or is private and has not been granted to the GitHub App. Its existence, capitalization and default branch cannot yet be confirmed.

On your phone:

1. Open your Eatfirst repository in GitHub and copy its exact URL into this conversation.
2. Open GitHub → your profile menu → Settings → Applications → Installed GitHub Apps → Configure for the ChatGPT/Codex connection. Under Repository access, include Eatfirst and save. If the app is installed under another owner/organization, configure that installation instead. Reconnect the GitHub connection in ChatGPT if the repository list still does not update. Do not share a password or token in chat.
3. Once access is available, the agent can inspect the actual default branch and existing files, integrate the app without force-pushing, configure Pages using Actions if permitted, and verify the live HTTPS deployment.

If Pages settings cannot be changed through the connection: open the repository → Settings (possibly under the ⋯ menu on a phone) → Pages → Build and deployment → Source → GitHub Actions. For free GitHub Pages on GitHub Free the repository needs to be public; the source code will be public. Do not change any unrelated repository settings.

## Ready configuration

- Automatic deployment is limited to the existing default branch, determined from the GitHub push event. Manual workflow dispatch remains available on that branch.
- GitHub Actions sets `BASE_PATH` to `/<actual repository name>/`; manifest identity, launch URL, scope, icons and service-worker scope follow it.
- All changes are confined to this project. The local initial branch is provisionally named `main`; it must be integrated with the target's verified existing branch/history before any push. No remote is guessed or configured while the target is inaccessible.
- CI executes lint, typecheck, unit tests, Chromium desktop/mobile browser tests, and a final Pages-path production build.
- Manifest, 192/512 icons, maskable icon and 180px Apple touch icon are present. PWA support uses standalone mode, local IndexedDB, a cached offline app shell and safe-area layout.

## Public verification still required

After deployment reports success, use the URL reported by GitHub Pages. Run both commands from README with that exact URL: the full browser suite and `tests/pwa-check.mjs`. Confirm HTTPS, homepage/assets, inventory/expiry, recipes, shopping, database persistence after refresh, offline reload and correct manifest/service-worker scopes. Physical iPhone/Safari and Android/Chrome installation must still be checked on-device.

No public URL is reported here because deployment has not happened. A guessed URL must not be presented as a working app.

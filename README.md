# DiffWeb for Windows

A real Windows app (`DiffWeb-Setup.exe`) with an installer, Start menu and desktop shortcuts,
a tray icon, "Start with Windows", and notifications. Inside, it opens https://diffweb.com in its app
layout, so every website update reaches the app automatically.

## Download

https://github.com/ayandiproy-cloud/diffweb-desktop/releases/latest/download/DiffWeb-Setup.exe

## How it is built

Every push to `main` (or **Actions → Build Windows app → Run workflow**) builds `DiffWeb-Setup.exe` on GitHub's
Windows machine and publishes it as a new release, version `1.0.<build number>`.

## Updates (automatic)

- Website changes: nothing to do. The app shows the website.
- App changes (icon, window, tray): push the change. Installed apps check every 6 hours and when opened, download
  the update in the background, and install it when DiffWeb restarts.
- People can also check by hand: **Me → Windows app → Check for updates** inside the app, or right-click the
  tray icon → **Check for updates**. Both show the installed version.
- This repository must stay **public**: the app downloads updates from its Releases page.

## Build on a Windows PC instead

```
npm install
npm run dist
```
The installer is in the `dist` folder.

## Windows SmartScreen

Windows shows "Windows protected your PC" for new apps that are not code-signed. People can click
**More info → Run anyway**. To remove the warning, sign the installer with a code-signing certificate,
or publish through the Microsoft Store, which signs it for you.

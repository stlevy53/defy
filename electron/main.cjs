const { app, BrowserWindow, Menu, screen, shell } = require('electron');
const fs = require('fs');
const path = require('path');

// No application menu. Beyond hiding chrome the app never uses, this releases Electron's default
// accelerators — Ctrl +/-/0 among them — so they reach the renderer's own board-size setting instead
// of also driving Electron's zoom and scaling the board twice per keypress.
Menu.setApplicationMenu(null);

// Remembered window geometry. The app used to open at a fixed 1440x900 every launch, which wastes a
// large monitor and matters more now that the Board size setting can make the board taller than the
// window: a player who maximizes to stop scrolling shouldn't have to do it again next time.
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
const DEFAULT_STATE = { width: 1440, height: 900, maximized: true };

/** Saved geometry, or the defaults. A position that no longer lands on a connected display (a laptop
 *  undocked from its second monitor) is dropped so the window can't open off-screen. */
function readState() {
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const size = {
      width: Number.isFinite(saved.width) ? saved.width : DEFAULT_STATE.width,
      height: Number.isFinite(saved.height) ? saved.height : DEFAULT_STATE.height,
      maximized: !!saved.maximized,
    };
    const visible = screen.getAllDisplays().some(({ workArea: a }) =>
      saved.x >= a.x && saved.y >= a.y && saved.x < a.x + a.width && saved.y < a.y + a.height);
    return visible ? { ...size, x: saved.x, y: saved.y } : size;
  } catch {
    return { ...DEFAULT_STATE }; // no state yet, or unreadable — first launch behaviour
  }
}

function saveState(win) {
  try {
    // getNormalBounds is the un-maximized geometry, so restoring down lands where it did before.
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
  } catch {
    /* geometry is a convenience — never block closing over it */
  }
}

function createWindow() {
  const state = readState();
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#1a140d',
    autoHideMenuBar: true,
    title: 'DEFY!',
    show: false, // revealed once laid out, so maximizing isn't a visible jump
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (state.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', () => saveState(win));

  // Open any external links in the user's real browser, not a new app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

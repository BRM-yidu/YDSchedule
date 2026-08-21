/* YDSchedule 桌面端主进程（Windows / macOS 共用） */
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function resolveIndex() {
  const dev = path.join(__dirname, '..', 'ydschedule-web', 'index.html');
  if (fs.existsSync(dev)) return dev;
  return path.join(process.resourcesPath, 'ydschedule-web', 'index.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    title: '极简日程表 · YDSchedule',
    backgroundColor: '#F3F0E9',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(resolveIndex());
  /* 外部链接一律交给系统浏览器 */
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
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

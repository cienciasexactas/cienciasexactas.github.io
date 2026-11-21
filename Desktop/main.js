const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, 'icon.ico');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Determina o caminho correto da pasta www:
  // Se estiver empacotado (app.isPackaged), lê de extraResources. Se for desenvolvimento, lê de ../www
  const indexPath = app.isPackaged
    ? path.join(process.resourcesPath, 'www', 'index.html')
    : path.join(__dirname, '..', 'www', 'index.html');

  win.loadFile(indexPath);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
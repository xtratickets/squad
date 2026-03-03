import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { fork } from 'child_process';

let mainWindow: BrowserWindow | null;
let serverProcess: any;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: "SQUAD POS",
    });

    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../public/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function startBackend() {
    // Start the Express server as a child process
    const serverPath = path.join(__dirname, 'server.js');
    serverProcess = fork(serverPath, [], {
        env: { ...process.env, NODE_ENV: 'production' }
    });

    serverProcess.on('message', (msg: any) => {
        console.log('Backend message:', msg);
    });

    serverProcess.on('error', (err: any) => {
        console.error('Backend error:', err);
    });
}

// IPC Handlers
ipcMain.on('print-receipt', (event, content) => {
    let workerWindow: BrowserWindow | null = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);

    workerWindow.webContents.on('did-finish-load', () => {
        workerWindow?.webContents.print({ silent: true, printBackground: true }, (success, failureReason) => {
            console.log('Print result:', success, failureReason);
            workerWindow = null;
        });
    });
});

app.on('ready', () => {
    startBackend();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Expose any specific IPC methods here
    send: (channel: string, data: any) => ipcRenderer.send(channel, data),
    on: (channel: string, func: (...args: any[]) => void) => {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    printReceipt: (content: string) => ipcRenderer.send('print-receipt', content),
});

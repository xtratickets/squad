import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (url: string, onUpdate?: (type: string, data: unknown) => void) => {
    const socketRef = useRef<Socket | null>(null);
    const callbackRef = useRef(onUpdate);

    // Keep callbackRef up-to-date without causing reconnects
    useEffect(() => {
        callbackRef.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        const socket = io(url, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 30000,
            timeout: 10000,
        });
        socketRef.current = socket;

        socket.on('room_update', (data: unknown) => callbackRef.current?.('room', data));
        socket.on('order_update', (data: unknown) => callbackRef.current?.('order', data));
        socket.on('shift_update', (data: unknown) => callbackRef.current?.('shift', data));
        socket.on('reservation_update', (data: unknown) => callbackRef.current?.('reservation_update', data));
        socket.on('reservation', (data: unknown) => callbackRef.current?.('reservation', data));

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
        // Only reconnect if the URL changes — not the callback
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);
};

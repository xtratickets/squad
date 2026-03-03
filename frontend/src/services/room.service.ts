import api from './api';
import type { Room, Session, ShiftStats, RoomStateResponse, SessionDetail, SessionBilling, Shift } from '../types';

export const roomService = {
    getRooms: () => api.get<Room[]>('/rooms/active'),
    getRoomState: (id: string) => api.get<RoomStateResponse>(`/rooms/${id}/state`),
    getSession: (sessionId: string) => api.get<{ session: SessionDetail; billing: SessionBilling }>(`/sessions/${sessionId}`),
    startSession: (roomId: string, shiftId: string) =>
        api.post<Session>('/sessions/start', { roomId, openedShiftId: shiftId }),
    endSession: (sessionId: string, closedShiftId: string, promoCode?: string, tip?: number) =>
        api.post(`/sessions/${sessionId}/end`, { closedShiftId, promoCode, tip }),
    pauseSession: (sessionId: string) => api.post(`/sessions/${sessionId}/pause`),
    resumeSession: (sessionId: string) => api.post(`/sessions/${sessionId}/resume`),

    // Shifts
    getActiveShift: () => api.get<Shift>('/shifts/active'),
    openShift: (openingCash: number) =>
        api.post('/shifts/open', { openingCash }),
    closeShift: (shiftId: string, cashPhysical: number) =>
        api.post(`/shifts/${shiftId}/close`, { cashPhysical }),
    getShiftStats: (shiftId: string) =>
        api.get<ShiftStats>(`/shifts/${shiftId}/stats`),
};

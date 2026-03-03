import api from './api';
import type { SystemSettings } from '../types';

export const systemService = {
    getSettings: () => api.get<SystemSettings>('/system/settings'),
};

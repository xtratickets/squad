import type { User } from '../types';
import api from './api';

const TOKEN_KEY = 'squad_token';
const USER_KEY = 'squad_user';

interface LoginCredentials {
    username: string;
    password: string;
}

interface LoginResponse {
    token: string;
    user: User;
}

export const authService = {
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        const response = await api.post<LoginResponse>('/auth/login', credentials);
        const { token, user } = response.data;

        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));

        return { token, user };
    },

    logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    },

    getToken() {
        return localStorage.getItem(TOKEN_KEY);
    },

    getUser(): User | null {
        const user = localStorage.getItem(USER_KEY);
        return user ? (JSON.parse(user) as User) : null;
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    isAdmin() {
        const user = this.getUser();
        return user?.role?.name === 'ADMIN';
    }
};

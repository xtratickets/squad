import type { User, Room, Product, Category, PromoCode, FeeConfig, Expense, Salary, Reservation, Payment, StockMovement, Shift, PaymentMode, GlobalStats } from '../types';
import api from './api';

interface CreateUserData { username: string; password: string; roleId: string; }
interface CreateRoomData { name: string; category: string; pricePerHour: number; minMinutes: number; status: string; }
interface CreateProductData { name: string; categoryId: string; price: number; cost: number; stockQty: number; }
interface CreateCategoryData { name: string; parentId?: string; }
interface CreateExpenseData { amount: number; category: string; shiftId: string; }
interface CreateSalaryData { staffId: string; amount: number; period: string; shiftId?: string; }
interface CreateReservationData { roomId: string; startTime: string; endTime?: string; guestName?: string; guestPhone?: string; note?: string; }
interface CreatePromoCodeData { code: string; type: 'percent' | 'fixed'; value: number; }
interface CreatePaymentModeData { name: string; active: boolean; allowSplit: boolean; }
interface CloseShiftData { cashPhysical: number; }
interface CreateOrderData { type: string; shiftId: string; items: { productId: string; qty: number }[]; roomId?: string; sessionId?: string; ownerUserId?: string; promoCode?: string; }
interface OrderItemSummary { id: string; productId: string; qty: number; unitPrice: number; total: number; product?: { id: string; name: string; price: number }; }
interface OrderSummary { id: string; type: string; status: string; shiftId: string; roomId?: string; sessionId?: string; items: OrderItemSummary[]; orderCharge?: { finalTotal: number } | null; createdAt: string; }

interface PaginatedOrders {
    data: OrderSummary[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export const adminService = {
    // Users
    getUsers: (opts?: { page?: number; pageSize?: number }) => {
        const params = new URLSearchParams();
        if (opts?.page !== undefined) params.append('page', String(opts.page));
        if (opts?.pageSize !== undefined) params.append('pageSize', String(opts.pageSize));
        const q = params.toString();
        return api.get<{ data: User[]; total: number; page: number; pageSize: number; totalPages: number }>(`/users${q ? `?${q}` : ''}`);
    },
    getRoles: () => api.get<Array<{ id: string; name: string }>>('/users/roles'),
    createUser: (data: CreateUserData) => api.post<User>('/users', data),
    updateUser: (id: string, data: Partial<CreateUserData>) => api.patch<User>(`/users/${id}`, data),
    deleteUser: (id: string) => api.delete(`/users/${id}`),

    // Rooms
    getRooms: (opts?: { page?: number; pageSize?: number }) => {
        const params = new URLSearchParams();
        if (opts?.page !== undefined) params.append('page', String(opts.page));
        if (opts?.pageSize !== undefined) params.append('pageSize', String(opts.pageSize));
        const q = params.toString();
        return api.get<{ data: Room[]; total: number; page: number; pageSize: number; totalPages: number }>(`/rooms${q ? `?${q}` : ''}`);
    },
    createRoom: (data: CreateRoomData) => api.post<Room>('/rooms', data),
    updateRoom: (id: string, data: Partial<CreateRoomData>) => api.patch<Room>(`/rooms/${id}`, data),
    deleteRoom: (id: string) => api.delete(`/rooms/${id}`),

    // Products & Categories
    getProducts: (opts?: { page?: number; pageSize?: number; search?: string; categoryId?: string }) => {
        const params = new URLSearchParams();
        if (opts?.page !== undefined) params.append('page', String(opts.page));
        if (opts?.pageSize !== undefined) params.append('pageSize', String(opts.pageSize));
        if (opts?.search) params.append('search', opts.search);
        if (opts?.categoryId) params.append('categoryId', opts.categoryId);
        const q = params.toString();
        return api.get<{ data: Product[]; total: number; page: number; pageSize: number; totalPages: number }>(`/products${q ? `?${q}` : ''}`);
    },
    createProduct: (data: CreateProductData | FormData) => api.post<Product>('/products', data),
    updateProduct: (id: string, data: Partial<CreateProductData> | FormData) => api.patch<Product>(`/products/${id}`, data),
    deleteProduct: (id: string) => api.delete(`/products/${id}`),
    getCategories: () => api.get<Category[]>('/products/categories'),
    createCategory: (data: CreateCategoryData) => api.post<Category>('/products/categories', data),
    deleteCategory: (id: string) => api.delete(`/products/categories/${id}`),
    addStock: (id: string, qty: number, type: string, reference: string) =>
        api.post(`/products/${id}/stock`, { qty, type, reference }),
    endSession: (sessionId: string, closedShiftId: string, promoCode?: string) =>
        api.post(`/sessions/${sessionId}/end`, { closedShiftId, promoCode }),

    // Settings / Fees
    getFees: () => api.get<FeeConfig>('/fees'),
    updateFees: (data: Partial<FeeConfig>) => api.patch<FeeConfig>('/fees', data),
    getPromoCodes: () => api.get<PromoCode[]>('/promocodes'),
    createPromoCode: (data: CreatePromoCodeData) => api.post<PromoCode>('/promocodes', data),
    deletePromoCode: (id: string) => api.delete(`/promocodes/${id}`),
    updateSystemSettings: (data: { systemName?: string; systemLogo?: string }) => api.put<{ systemName: string; systemLogo: string; version: string }>('/system/settings', data),

    // Payment Modes
    getPaymentModes: () => api.get<PaymentMode[]>('/payments/modes'),
    createPaymentMode: (data: CreatePaymentModeData) => api.post<PaymentMode>('/payments/modes', data),
    updatePaymentMode: (id: string, data: Partial<CreatePaymentModeData>) => api.patch<PaymentMode>(`/payments/modes/${id}`, data),
    deletePaymentMode: (id: string) => api.delete(`/payments/modes/${id}`),

    // Operations
    getExpenses: () => api.get<Expense[]>('/expenses'),
    createExpense: (data: CreateExpenseData) => api.post<Expense>('/expenses', data),
    deleteExpense: (id: string) => api.delete(`/expenses/${id}`),
    getSalaries: (opts?: { staffId?: string; page?: number; pageSize?: number; fromDate?: string; toDate?: string }) => {
        const params = new URLSearchParams();
        if (opts?.staffId) params.append('staffId', opts.staffId);
        if (opts?.page !== undefined) params.append('page', String(opts.page));
        if (opts?.pageSize !== undefined) params.append('pageSize', String(opts.pageSize));
        if (opts?.fromDate) params.append('fromDate', opts.fromDate);
        if (opts?.toDate) params.append('toDate', opts.toDate);
        const q = params.toString();
        return api.get<{ data: Salary[]; total: number; page: number; pageSize: number; totalPages: number }>(`/salaries${q ? `?${q}` : ''}`);
    },
    createSalary: (data: CreateSalaryData) => api.post<Salary>('/salaries', data),
    deleteSalary: (id: string) => api.delete(`/salaries/${id}`),
    getReservations: () => api.get<Reservation[]>('/reservations'),
    createReservation: (data: CreateReservationData) => api.post<Reservation>('/reservations', data),
    deleteReservation: (id: string) => api.delete(`/reservations/${id}`),
    getPayments: (opts?: { page?: number; pageSize?: number; startDate?: string; endDate?: string }) => {
        const params = new URLSearchParams();
        if (opts?.page !== undefined) params.append('page', String(opts.page));
        if (opts?.pageSize !== undefined) params.append('pageSize', String(opts.pageSize));
        if (opts?.startDate) params.append('startDate', opts.startDate);
        if (opts?.endDate) params.append('endDate', opts.endDate);
        const q = params.toString();
        return api.get<{ data: Payment[]; total: number; page: number; pageSize: number; totalPages: number }>(`/payments${q ? `?${q}` : ''}`);
    },
    getStockMovements: (opts?: { page?: number; pageSize?: number }) => {
        const params = new URLSearchParams();
        if (opts?.page !== undefined) params.append('page', String(opts.page));
        if (opts?.pageSize !== undefined) params.append('pageSize', String(opts.pageSize));
        const q = params.toString();
        return api.get<{ data: StockMovement[]; total: number; page: number; pageSize: number; totalPages: number }>(`/products/stock-movements${q ? `?${q}` : ''}`);
    },

    // Shifts
    getShifts: (opts?: { page?: number; pageSize?: number }) => {
        const params = new URLSearchParams();
        if (opts?.page !== undefined) params.append('page', String(opts.page));
        if (opts?.pageSize !== undefined) params.append('pageSize', String(opts.pageSize));
        const q = params.toString();
        return api.get<{ data: Shift[]; total: number; page: number; pageSize: number; totalPages: number }>(`/shifts${q ? `?${q}` : ''}`);
    },
    closeShift: (id: string, data: CloseShiftData) => api.post<Shift>(`/shifts/${id}/close`, data),
    getShiftHistory: () => api.get<Shift[]>('/shifts/history'),

    // Analytics
    getGlobalStats: () => api.get<GlobalStats>('/reports/global'),
    exportReport: (type: string, startDate?: string, endDate?: string) => {
        const params = new URLSearchParams({ type });
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        return api.get(`/reports/export?${params.toString()}`, { responseType: 'blob' });
    },

    // Orders (walk-in / owner)
    getOrders: (shiftId: string, opts?: { status?: string; type?: string; page?: number; pageSize?: number }) => {
        const params = new URLSearchParams({ shiftId });
        if (opts?.status) params.append('status', opts.status);
        if (opts?.type) params.append('type', opts.type);
        if (opts?.page !== undefined) params.append('page', String(opts.page));
        if (opts?.pageSize !== undefined) params.append('pageSize', String(opts.pageSize));
        return api.get<PaginatedOrders | OrderSummary[]>(`/orders?${params.toString()}`);
    },
    createOrder: (data: CreateOrderData) => api.post<OrderSummary>('/orders', data),
    approveOrder: (id: string) => api.post<OrderSummary>(`/orders/${id}/approve`, {}),
    checkoutOrder: (id: string, data: { payments: { modeId: string; amount: number }[]; shiftId: string }) => api.post(`/orders/${id}/checkout`, data),
    cancelOrder: (id: string) => api.patch<OrderSummary>(`/orders/${id}`, { status: 'cancelled' }),

    // Staff-accessible users list (for owner selector in orders)
    getUsersList: () => api.get<{ id: string; username: string; walletBalance: number }[]>('/users/list'),

    // Wallet
    getWallet: (userId: string) => api.get<{ user: { id: string; username: string; walletBalance: number }; transactions: { id: string; amount: number; note?: string; createdAt: string }[] }>(`/wallet/${userId}`),
    topUpWallet: (userId: string, data: { amount: number; note?: string; shiftId: string }) => api.post(`/wallet/${userId}/topup`, data),

    // Owners management
    getOwners: () => api.get<{ id: string; username: string; walletBalance: number; role: { name: string } }[]>('/owners'),
    payOwner: (ownerId: string, data: { amount: number; note?: string; shiftId?: string; modeId?: string }) => api.post(`/owners/${ownerId}/pay`, data),
    getOwnerWallet: (ownerId: string) => api.get<{ user: { id: string; username: string; walletBalance: number }; transactions: { id: string; amount: number; note?: string; createdAt: string }[] }>(`/wallet/${ownerId}`),
};

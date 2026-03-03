export interface User {
    id: string;
    username: string;
    role: Role;
}

export interface Role {
    id: string;
    name: string;
}

export interface PaymentMode {
    id: string;
    name: string;
    active: boolean;
}

export interface Room {
    id: string;
    name: string;
    category: string;
    pricePerHour: number;
    minMinutes: number;
    status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
}

export interface Product {
    id: string;
    name: string;
    categoryId: string;
    category?: { id: string; name: string };
    price: number;
    cost: number;
    stockQty: number;
    imageUrl?: string;
}

export interface Category {
    id: string;
    name: string;
    parentId?: string;
    products?: Product[];
}

export interface Session {
    id: string;
    roomId: string;
    room?: Room;
    startTime: string;
    endTime?: string;
    status: 'active' | 'closed' | 'cancelled';
    isPaused?: boolean;
    lastPausedAt?: string | null;
    totalPausedMs?: number;
}

export interface RoomState {
    room: Room;
    activeSession?: {
        id: string;
        startTime: string;
        orderCount?: number;
    };
}

export interface PaymentMode {
    id: string;
    name: string;
    active: boolean;
    allowSplit: boolean;
}

export interface Payment {
    id: string;
    modeId: string;
    mode: PaymentMode;
    amount: number;
    referenceType: 'session' | 'order';
    referenceId: string;
    shiftId: string;
    receiptUrl?: string;
    createdAt: string;
    shift?: {
        staff?: { username: string };
    };
}

export interface Expense {
    id: string;
    amount: number;
    category: string;
    createdAt: string;
    createdBy?: { username: string };
}

export interface Salary {
    id: string;
    staffId: string;
    amount: number;
    period: string;
    createdAt: string;
    staff?: { username: string };
}

export interface Reservation {
    id: string;
    roomId: string;
    room?: Room;
    startTime: string;
    endTime?: string;
    status: 'pending' | 'confirmed' | 'checked_in' | 'cancelled';
    guestName?: string;
    guestPhone?: string;
    note?: string;
    createdBy?: { username: string };
}

export interface StockMovement {
    id: string;
    productId: string;
    product?: Product;
    qty: number;
    type: 'add' | 'deduct' | 'restock' | 'sale' | 'adjustment';
    reference?: string;
    createdAt: string;
}

export interface PromoCode {
    id: string;
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    active: boolean;
    expiry?: string;
    usageLimit?: number;
}

export interface FeeConfig {
    id: string;
    serviceFeePercent: number;
    taxPercent: number;
}

export interface Shift {
    id: string;
    staffId: string;
    staff?: { username: string };
    openingCash?: number;
    cashPhysical?: number;
    status: 'open' | 'closed';
    startTime: string;
    endTime?: string;
    stats?: ShiftStats;
    paymentsByMode?: { name: string; amount: number }[];
    openedSessions?: SessionDetail[];
    orders?: SessionOrder[];
}

export interface ShiftStats {
    shiftId: string;
    openingCash: number;
    cashPhysical?: number;
    cashDifference?: number;
    paymentsCash: number;
    paymentsCard: number;
    paymentsWallet: number;
    paymentsByMode?: { name: string; amount: number }[];
    expensesTotal?: number;
    totalRevenue?: number;
    expenses?: any[];
}

export interface GlobalStats {
    totalSessions: number;
    totalOrders: number;
    totalRevenue: number;
    activeRooms: number;
    revenueByMode: Array<{ modeId: string; _sum: { amount: number | null } }>;
}

export interface SessionOrderItem {
    id: string;
    productId: string;
    qty: number;
    unitPrice: number;
    total: number;
    product?: { id: string; name: string; price: number };
}

export interface SessionOrder {
    id: string;
    status: string;
    type: string;
    createdAt: string;
    ownerUserId?: string | null;
    items: SessionOrderItem[];
    orderCharge?: { finalTotal: number };
}

export interface SessionBilling {
    durationMinutes: number;
    billableMinutes: number;
    hourlyPrice: number;
    roomAmount: number;
    ordersAmount: number;
    discount: number;
    serviceFee: number;
    tax: number;
    tip: number;
    finalTotal: number;
}

export interface SessionDetail {
    id: string;
    roomId: string;
    room: Room;
    startTime: string;
    endTime?: string;
    status: string;
    isPaused?: boolean;
    lastPausedAt?: string | null;
    totalPausedMs?: number;
    orders: SessionOrder[];
    sessionCharge?: SessionBilling;
    payments?: Payment[];
}

export interface RoomStateResponse {
    roomId: string;
    activeSessionId: string | null;
    startTime: string | null;
    runningTotal: number;
    unpaidTotal: number;
    ordersOpen: number;
}

export interface SystemSettings {
    systemName: string;
    systemLogo: string;
    version: string;
}

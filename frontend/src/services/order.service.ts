import api from './api';
import type { Product, Category } from '../types';

export const orderService = {
    getProducts: () => api.get<Product[]>('/products'),
    getCategories: () => api.get<Category[]>('/products/categories'),
    placeOrder: (sessionId: string, items: { productId: string, qty: number }[]) =>
        api.post('/orders', { sessionId, items }),
};

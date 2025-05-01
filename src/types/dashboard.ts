export type DashPage = "admin" | "customers" | "home" | "wallet" | "settings" | 'transections';

export const DashPages = {
    ADMIN: "admin" as DashPage,
    CUSTOMERS: "customers" as DashPage,
    HOME: "home" as DashPage,
    WALLET: "wallet" as DashPage,
    SETTINGS: "settings" as DashPage,
    TRANSACTIONS: "Transections" as DashPage,
} as const; 

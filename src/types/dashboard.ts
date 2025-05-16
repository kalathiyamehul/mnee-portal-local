export type DashPage = "admin" | "customers" | "home" | "wallet" | "settings" | 'transactions';

export const DashPages = {
    ADMIN: "admin" as DashPage,
    CUSTOMERS: "customers" as DashPage,
    HOME: "home" as DashPage,
    WALLET: "wallet" as DashPage,
    SETTINGS: "settings" as DashPage,
    TRANSACTIONS: "transactions" as DashPage,
    SUPER_ADMIN: "superadmin" as DashPage,
} as const; 

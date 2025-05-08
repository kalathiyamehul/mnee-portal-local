export type DashPage = "admin" | "customers" | "home" | "wallet" | "settings" | 'transections';

export const DashPages = {
    ADMIN: "admin" as DashPage,
    CUSTOMERS: "customers" as DashPage,
    HOME: "home" as DashPage,
    WALLET: "wallet" as DashPage,
    SETTINGS: "settings" as DashPage,
    TRANSACTIONS: "transections" as DashPage,
    SUPER_ADMIN: "superadmin" as DashPage,
} as const; 

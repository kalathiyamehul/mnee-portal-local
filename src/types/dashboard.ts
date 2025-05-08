export type DashPage = "admin" | "customers" | "users" | "home" | "wallet" | "settings" | 'transections' | 'activity';

export const DashPages = {
    ADMIN: "admin" as DashPage,
    CUSTOMERS: "customers" as DashPage,
    USERS: "users" as DashPage,
    HOME: "home" as DashPage,
    WALLET: "wallet" as DashPage,
    SETTINGS: "settings" as DashPage,
    TRANSACTIONS: "transections" as DashPage,
    ACTIVITY: "activity" as DashPage,
    SUPER_ADMIN: "superadmin" as DashPage,
} as const; 

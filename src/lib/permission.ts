export enum Resource {
    SUPER_ADMIN = "SUPER_ADMIN",
    WALLET = "WALLET",
    CUSTOMER = "CUSTOMER",
    USER = "USER",
    MINT = "MINT",
    BURN = "BURN",
    FREEZE = "FREEZE",
    BLACKLIST = "BLACKLIST",
    REFUND = "REFUND",
    CONFIG = "CONFIG",
    ACTIVITY_LOGS = "ACTIVITY_LOGS",
    TRANSACTIONS = "TRANSACTIONS",
    SYSTEM = "SYSTEM",
}

export enum Action {
    MANAGE = "MANAGE",
    CREATE = "CREATE",
    READ = "READ",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
    REJECT = "REJECT",
    APPROVE = "APPROVE",
}

export interface ResourcePermission {
    name: Resource;
    permissions: Action[];
}

export const RESOURCE_PERMISSIONS: ResourcePermission[] = [
    {
        name: Resource.WALLET,
        permissions: [Action.READ, Action.CREATE, Action.UPDATE, Action.DELETE]
    },
    {
        name: Resource.CUSTOMER,
        permissions: [Action.READ, Action.CREATE, Action.UPDATE, Action.DELETE, Action.APPROVE]
    },
    {
        name: Resource.MINT,
        permissions: [Action.READ, Action.CREATE, Action.APPROVE, Action.REJECT]
    },
    {
        name: Resource.BURN,
        permissions: [Action.READ, Action.CREATE, Action.APPROVE, Action.REJECT]
    },
    {
        name: Resource.FREEZE,
        permissions: [Action.READ, Action.CREATE, Action.APPROVE]
    },
    {
        name: Resource.BLACKLIST,
        permissions: [Action.READ, Action.CREATE, Action.APPROVE]
    },
    {
        name: Resource.REFUND,
        permissions: [Action.READ, Action.CREATE, Action.APPROVE]
    },
    {
        name: Resource.CONFIG,
        permissions: [Action.READ, Action.UPDATE, Action.CREATE]
    },
    {
        name: Resource.ACTIVITY_LOGS,
        permissions: [Action.READ]
    },
    {
        name: Resource.TRANSACTIONS,
        permissions: [Action.READ]
    },
    {
        name: Resource.SYSTEM,
        permissions: [Action.READ, Action.MANAGE]
    }
]
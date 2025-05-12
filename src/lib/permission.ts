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
        name: Resource.SUPER_ADMIN,
        permissions: [Action.MANAGE]
    },
    {
        name: Resource.WALLET,
        permissions: [Action.MANAGE, Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE]
    },
    {
        name: Resource.CUSTOMER,
        permissions: [Action.MANAGE, Action.CREATE, Action.UPDATE, Action.DELETE, Action.APPROVE, Action.REJECT]
    },
    {
        name: Resource.MINT,
        permissions: [Action.MANAGE, Action.CREATE, Action.APPROVE, Action.REJECT]
    },
    {
        name: Resource.BURN,
        permissions: [Action.MANAGE, Action.CREATE, Action.APPROVE, Action.REJECT]
    },
    {
        name: Resource.FREEZE,
        permissions: [Action.MANAGE, Action.CREATE, Action.APPROVE, Action.REJECT]
    },
    {
        name: Resource.BLACKLIST,
        permissions: [Action.MANAGE, Action.CREATE, Action.APPROVE, Action.REJECT]
    },
    {
        name: Resource.REFUND,
        permissions: [Action.MANAGE, Action.CREATE, Action.APPROVE, Action.REJECT]
    }
]
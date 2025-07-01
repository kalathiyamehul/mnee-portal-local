import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { withCSRF } from "@/lib/csrf";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
import { TransactionType } from "@prisma/client";

export const GET = withCSRF(async function(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Get pagination and filter parameters from URL
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        
        // Get filter types from query params
        const typesParam = searchParams.get('types');
        let typeFilters: TransactionType[] = [];
        
        if (typesParam) {
            // Parse the types parameter (comma-separated values) and cast to TransactionType
            typeFilters = typesParam.split(',')
                .map(type => type.toUpperCase() as TransactionType)
                .filter(type => 
                    Object.values(TransactionType).includes(type)
                );
        }

        // If page and limit are -1, return all records
        const shouldReturnAll = page === -1 && limit === -1;

        // Build the where clause for filtering
        // If no filters are provided, return all records (empty where clause)
        // If filters are provided, only return records matching those types
        const whereClause = typeFilters.length > 0 ? {
            type: {
                in: typeFilters
            }
        } : {}; // Empty object means no filtering - return all records

        // Get total count and paginated activity logs with filters
        const [totalCount, transactionRecords] = await Promise.all([
            prisma.transactionRecords.count({
                where: whereClause
            }),
            prisma.transactionRecords.findMany({
                where: whereClause,
                skip: shouldReturnAll ? 0 : (page - 1) * limit,
                take: shouldReturnAll ? undefined : limit,
                orderBy: { createdAt: "desc" },
            })
        ]);

        return NextResponse.json({
            transactionRecords,
            pagination: {
                total: totalCount,
                page: shouldReturnAll ? 1 : page,
                limit: shouldReturnAll ? totalCount : limit,
                totalPages: shouldReturnAll ? 1 : Math.ceil(totalCount / limit)
            },
            appliedFilters: {
                types: typeFilters
            }
        });
    } catch (error) {
        console.error("Error fetching transaction records:", error);
        return NextResponse.json(
            { error: "Failed to fetch transaction records" },
            { status: 500 }
        );
    }
}, createAPIRateLimit())
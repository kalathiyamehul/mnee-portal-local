import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { subDays } from 'date-fns';
import { withCSRF } from "@/lib/csrf";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";

export const GET = withCSRF(async function(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const days = Number.parseInt(searchParams.get('days') || '30');

  if (!type) {
    return NextResponse.json({ error: 'Type parameter is required' }, { status: 400 });
  }

  const endDate = new Date();
  const startDate = subDays(endDate, days);

  try {
    const chartData = [];
    const totals = {
      mintVolume: 0,
      burnVolume: 0,
      mintCount: 0,
      burnCount: 0,
      customerCount: 0,
      restrictionCount: 0
    };

    switch (type) {
      case 'volume':
      case 'count': {
        // Get mint data
        const mintRequests = await prisma.mintRequest.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            },
            status: 'DONE'
          },
          select: {
            amount: true,
            createdAt: true
          }
        });

        // Get burn data
        const burnRequests = await prisma.burnRequest.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            },
            status: 'DONE'
          },
          select: {
            amount: true,
            createdAt: true
          }
        });

        // Create daily data points
        for (let d = 0; d < days; d++) {
          const date = subDays(endDate, d);
          const dateStr = date.toISOString().split('T')[0];

          const dayMints = mintRequests.filter(m => 
            m.createdAt.toISOString().startsWith(dateStr)
          );
          const dayBurns = burnRequests.filter(b => 
            b.createdAt.toISOString().startsWith(dateStr)
          );

          const mintVolume = dayMints.reduce((sum, m) => sum + Number(m.amount), 0);
          const burnVolume = dayBurns.reduce((sum, b) => sum + Number(b.amount), 0);

          totals.mintVolume += mintVolume;
          totals.burnVolume += burnVolume;
          totals.mintCount += dayMints.length;
          totals.burnCount += dayBurns.length;

          chartData.push({
            date: dateStr,
            mintVolume,
            burnVolume,
            mintCount: dayMints.length,
            burnCount: dayBurns.length
          });
        }
        break;
      }

      case 'customers': {
        const customers = await prisma.customer.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          select: {
            createdAt: true
          }
        });

        for (let d = 0; d < days; d++) {
          const date = subDays(endDate, d);
          const dateStr = date.toISOString().split('T')[0];

          const dayCustomers = customers.filter(c => 
            c.createdAt.toISOString().startsWith(dateStr)
          );

          totals.customerCount += dayCustomers.length;

          chartData.push({
            date: dateStr,
            customerCount: dayCustomers.length,
            totalCustomers: totals.customerCount
          });
        }
        break;
      }

      case 'restrictions': {
        const restrictions = await prisma.blacklistRequest.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          select: {
            createdAt: true,
            status: true
          }
        });

        for (let d = 0; d < days; d++) {
          const date = subDays(endDate, d);
          const dateStr = date.toISOString().split('T')[0];

          const dayRestrictions = restrictions.filter(r => 
            r.createdAt.toISOString().startsWith(dateStr)
          );

          totals.restrictionCount += dayRestrictions.length;

          chartData.push({
            date: dateStr,
            restrictionCount: dayRestrictions.length,
            totalRestrictions: totals.restrictionCount
          });
        }
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }

    // Sort data chronologically
    chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      chartData,
      totals,
      period: {
        days,
        start: startDate,
        end: endDate
      }
    });

  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}, createAPIRateLimit())
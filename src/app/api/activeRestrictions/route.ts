import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get active freezes
    const activeFreezes = await prisma.freezeRequest.findMany({
      where: {
        status: 'APPROVED',
        action: 'FREEZE',
      },
      select: {
        id: true,
        address: true,
        createdAt: true,
        requester: {
          select: {
            name: true,
            email: true,
          },
        },
        approvals: {
          include: {
            approver: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get active blacklists
    const activeBlacklists = await prisma.blacklist.findMany({
      where: {
        status: 'APPROVED',
        action: 'BLACKLIST',
      },
      select: {
        id: true,
        address: true,
        createdAt: true,
        requester: {
          select: {
            name: true,
            email: true,
          },
        },
        approvals: {
          include: {
            approver: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      activeFreezes: activeFreezes.map(freeze => ({
        id: freeze.id,
        address: freeze.address,
        createdAt: freeze.createdAt,
        requester: freeze.requester,
        approvers: freeze.approvals.map(a => a.approver),
      })),
      activeBlacklists: activeBlacklists.map(blacklist => ({
        id: blacklist.id,
        address: blacklist.address,
        createdAt: blacklist.createdAt,
        requester: blacklist.requester,
        approvers: blacklist.approvals.map(a => a.approver),
      })),
    });
  } catch (error) {
    console.error('Error fetching active restrictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active restrictions' },
      { status: 500 }
    );
  }
} 
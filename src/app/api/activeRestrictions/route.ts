import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get active freezes
    const allApprovedFreezes = await prisma.freezeRequest.findMany({
      where: {
        status: 'APPROVED',
      },
      select: {
        id: true,
        address: true,
        action: true,
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

    // Group by address and get most recent approved action
    const addressMap = new Map<string, typeof allApprovedFreezes[0]>();
    for (const freeze of allApprovedFreezes) {
      const existing = addressMap.get(freeze.address);
      if (!existing || freeze.createdAt > existing.createdAt) {
        addressMap.set(freeze.address, freeze);
      }
    }

    // Only include addresses where most recent action is FREEZE
    const activeFreezes = Array.from(addressMap.values())
      .filter(freeze => freeze.action === 'FREEZE');

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
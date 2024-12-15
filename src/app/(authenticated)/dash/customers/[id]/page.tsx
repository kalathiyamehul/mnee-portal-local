// src/app/(authenticated)/dash/customers/[id]/page.tsx
import CustomerViewContent from "@/components/pages/dash/content/customers/view";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const id = (await params).id;

  // Fetch customer details with creator info
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      creator: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!customer) {
    return <div className="p-4">
      <div className="alert alert-error">Customer not found</div>
    </div>;
  }

  // Fetch customer's mint requests
  const mintRequests = await prisma.mintRequest.findMany({
    where: { address: customer.address },
    orderBy: { createdAt: 'desc' },
    include: {
      requester: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  // Fetch customer's burn requests
  const burnRequests = await prisma.burnRequest.findMany({
    where: { refundAddress: customer.address },
    orderBy: { createdAt: 'desc' },
    include: {
      requester: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  const data = {
    customer: {
      ...customer,
      createdAt: customer.createdAt.toISOString(),
    },
    activity: {
      mints: mintRequests.map(req => ({
        id: req.id,
        amount: req.amount.toString(),
        status: req.status,
        createdAt: req.createdAt.toISOString(),
        txid: req.txid || null,
        address: req.address,
        requester: {
          name: req.requester.name,
          email: req.requester.email,
        },
      })),
      burns: burnRequests.map(req => ({
        id: req.id,
        amount: req.amount.toString(),
        status: req.status,
        createdAt: req.createdAt.toISOString(),
        txid: req.outpoint || null,
        refundAddress: req.refundAddress || '',
        requester: {
          name: req.requester.name,
          email: req.requester.email,
        },
      })),
    },
  };

  return <CustomerViewContent initialData={data} />;
}
import { useState } from 'react';
import { FaCheck, FaCoins, FaXmark } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';
import { useSystemStatus } from "@/contexts/SystemStatusContext";
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { MdOutlineOpenInNew } from 'react-icons/md';

const statusColors = {
  PENDING: "badge-warning",
  APPROVED: "badge-success",
  REJECTED: "badge-error",
  CANCELLED: "badge-neutral",
  DONE: "badge-success"
};

interface MintsTabProps {
  showModal: (id: string) => void;
}

export function MintsTab({ showModal }: MintsTabProps) {
  const [filter, setFilter] = useState<"all" | "pending">("pending");
  const { statusData, initialLoading } = useSystemStatus();
  const mintRequests = statusData?.mintRequests || [];

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch("/api/approveMint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mintRequestId: id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve mint request");
      }

      toast.success("Mint request approved");
    } catch (error) {
      console.error("Failed to approve mint request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to approve mint request");
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch("/api/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mintRequestId: id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reject mint request");
      }

      toast.success("Mint request rejected");
    } catch (error) {
      console.error("Failed to reject mint request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reject mint request");
    }
  };

  const filteredRequests = mintRequests.filter(request => 
    filter === "all" || request.status === "PENDING"
  );

  if (initialLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button 
            className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter("all")}
          >
            All Requests
          </button>
          <button 
            className={`btn btn-sm ${filter === "pending" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter("pending")}
          >
            Pending
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => showModal('mint_modal')}
          >
            <FaCoins className="mr-1" />
            <span className="text-sm">Mint</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Address</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Transaction</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((request) => (
              <tr key={request.id} className="hover">
                <td>
                  {request.customer ? (
                    <Link
                      href={`/dash/customers?id=${request.customer.email}`}
                      className="hover:underline"
                    >
                      {request.customer.name}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                </td>
                <td className="font-mono text-sm">{request.address}</td>
                <td>{Number(request.amount).toLocaleString()}</td>
                <td>
                  <span className={`badge ${statusColors[request.status]}`}>
                    {request.status}
                  </span>
                </td>
                <td>{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}</td>
                <td>
                  {request.txid ? (
                    <a
                      href={`https://whatsonchain.com/tx/${request.txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm link link-hover flex items-center gap-1"
                    >
                      {request.txid.slice(0, 8)}...{request.txid.slice(-8)}
                      <MdOutlineOpenInNew className="w-3 h-3" />
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  {request.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(request.id)}
                        className="btn btn-square btn-ghost btn-sm text-success"
                        title="Approve"
                      >
                        <FaCheck />
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        className="btn btn-square btn-ghost btn-sm text-error"
                        title="Reject"
                      >
                        <FaXmark />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 
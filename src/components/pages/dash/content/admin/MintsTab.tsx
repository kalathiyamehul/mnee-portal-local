import { useState } from 'react';
import { FaCheck, FaCoins, FaXmark } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';
import { useSystemStatus } from "@/contexts/SystemStatusContext";
import { formatDistanceToNow } from 'date-fns';
import { MdOutlineOpenInNew } from 'react-icons/md';
import md5 from 'md5';

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

  const getGravatarUrl = (email: string) => {
    const hash = md5(email.toLowerCase().trim());
    return `https://www.gravatar.com/avatar/${hash}?d=mp&s=40`;
  };

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

  const getRowBorderClass = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'border-l-4 border-l-warning';
      case 'APPROVED':
      case 'DONE':
        return 'border-l-4 border-l-success';
      case 'REJECTED':
      case 'CANCELLED':
        return 'border-l-4 border-l-error';
      default:
        return '';
    }
  };

  if (initialLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <button
          className="btn btn-primary btn-xs"
          onClick={() => showModal('mint_modal')}
        >
          <FaCoins className="mr-1" />
          <span className="text-sm">Mint</span>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <label className="label cursor-pointer gap-2 px-2">
            <span className="label-text text-sm mr-2">Pending Only</span>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm sm:toggle-md"
              checked={filter === "pending"}
              onChange={(e) => setFilter(e.target.checked ? "pending" : "all")}
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Address</th>
              <th>Amount</th>
              <th>Transaction</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((request) => (
              <tr key={request.id} className={`hover ${getRowBorderClass(request.status)}`}>
                <td>
                  {request.customer ? (
                    <div className="flex items-center gap-3">
                      <div className="avatar">
                        <div className="mask mask-squircle w-10 h-10">
                          <img
                            src={getGravatarUrl(request.customer.email)}
                            alt="Customer avatar"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">{request.customer.name}</div>
                        <div className="text-sm opacity-50">
                          {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="avatar">
                        <div className="mask mask-squircle w-10 h-10">
                          <img
                            src={getGravatarUrl("")}
                            alt="Unknown customer"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Unknown</div>
                        <div className="text-sm opacity-50">
                          {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  )}
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-sm">{request.address}</span>
                    <span className={`badge badge-sm ${statusColors[request.status]}`}>
                      {request.status}
                    </span>
                  </div>
                </td>
                <td>{Number(request.amount).toLocaleString()}</td>
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
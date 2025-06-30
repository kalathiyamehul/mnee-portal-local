"use client";

import { apiFetch } from "@/utils/api";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FaFilter } from "react-icons/fa6";

type Transaction = {
  txid: string;
  timestamp: string;
  status: string;
  requestedBy: string;
  type: "MINT" | "BURN" | "REFUND";
};

export default function DashboardTransactionsContent() {
  // Add type to dummy data
  const [transactions, setTransections] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<Record<string, boolean>>({
    MINT: true,
    BURN: true,
    REFUND: true,
  });
  const [showDropdown, setShowDropdown] = useState(false);

  // Handle filter change
  const handleFilterChange = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  useEffect(() => {
    const fetchTransections = async (page: number, limit: number) => {
      try {
        setLoading(true);
        const response = await apiFetch(
          `/api/transactionRecords?page=${page}&limit=${limit}`
        );
        const data = await response.json();
        console.log("Transaction Data:", data)
        setTransections(data.transactionRecords);
      } catch (error) {
        // console.error("Error fetching Transaction Records:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Error fetching activity logs"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTransections(1, 10);
  }, []);

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => filters[tx.type]);

  return (
    <div className="p-4 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold mb-4">Transaction Ledger</h1>
        {/* Dropdown Filter Button */}
        <div className="relative mb-4">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowDropdown((prev) => !prev)}
          >
            <FaFilter /> Filters
            <svg
              className={`ml-2 w-4 h-4 transition-transform ${
                showDropdown ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {showDropdown && (
            <div className="absolute z-10 mt-2 w-fit bg-base-100 border border-base-300 rounded-lg shadow-lg p-3">
              {["MINT", "BURN", "REFUND"].map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 py-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters[type]}
                    onChange={() => handleFilterChange(type)}
                    className="checkbox checkbox-xs"
                  />
                  <span className="text-sm">{type}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>TxID</th>
              <th>Request ID</th>
              <th>Timestamp</th>
              <th>Type</th>
              <th>Approvers</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-4">
                  No transactions found.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr key={tx.txid}>
                  <td className="font-mono text-xs">
                    {tx.txid.slice(0, 8)}...{tx.txid.slice(-8)}
                  </td>
                  <td>{new Date(tx.timestamp).toLocaleString()}</td>
                  <td>
                    <span
                      className={
                        tx.status === "Done"
                          ? "badge badge-success"
                          : "badge badge-error"
                      }
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-outline">{tx.type}</span>
                  </td>
                  <td>
                    <a
                      href={`https://whatsonchain.com/tx/${tx.txid}?tab=m8eqcrbs`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-link btn-xs"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

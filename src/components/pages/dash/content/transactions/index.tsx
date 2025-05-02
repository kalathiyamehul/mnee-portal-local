"use client";

import { useEffect, useState } from "react";
import { FaFilter } from "react-icons/fa6";

type Transaction = {
  txid: string;
  outpoint: string;
  blockHeight: number;
  timestamp: string;
  status: string;
  type: "MINT" | "BURN" | "FREEZE" | "BLACKLIST" | "REFUND";
};

export default function DashboardTransactionsContent() {
  // Add type to dummy data
  const [transactions] = useState<Transaction[]>([
    {
      txid: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
      outpoint: "a1b2c3d4e5f6g7h8i9j0k1ls9t0u1v2w3x4y5z6a7b8c9d0e1f2_0",
      blockHeight: 789123,
      timestamp: new Date().toISOString(),
      status: "Done",
      type: "MINT",
    },
    {
      txid: "f2e1d0c9b8a7z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1",
      outpoint:
        "f2e1d0c9b8a7z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1_1",
      blockHeight: 789124,
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      status: "Done",
      type: "BURN",
    },
    {
      txid: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
      outpoint: "a1b2c3d4e5f6g7h8i9j0k1ls0u1v2w3x4y5z6a7b8c9d0e1f2_0",
      blockHeight: 759123,
      timestamp: new Date().toISOString(),
      status: "Done",
      type: "MINT",
    },
    // Add more dummy transactions with different types as needed
  ]);
  const [loading] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<Record<string, boolean>>({
    MINT: true,
    BURN: true,
    FREEZE: true,
    BLACKLIST: true,
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
              {["MINT", "BURN", "FREEZE", "BLACKLIST", "REFUND"].map((type) => (
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
              <th>Outpoint</th>
              <th>Block Height</th>
              <th>Timestamp</th>
              <th>Status</th>
              <th>Type</th>
              <th>Explorer</th>
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
                <tr key={tx.outpoint}>
                  <td className="font-mono text-xs">
                    {tx.txid.slice(0, 8)}...{tx.txid.slice(-8)}
                  </td>
                  <td className="font-mono text-xs">
                    {tx.outpoint.slice(0, 10)}...{tx.outpoint.slice(-10)}
                  </td>
                  <td>{tx.blockHeight}</td>
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
                      href={`https://whatsonchain.com/tx/${tx.txid}`}
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

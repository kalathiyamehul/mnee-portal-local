"use client";

import { useEffect, useState } from "react";

type Transaction = {
  txid: string;
  outpoint: string;
  blockHeight: number;
  timestamp: string;
  status: string;
};

export default function DashboardTransactionsContent() {
  // Provide static dummy data for now
  const [transactions] = useState<Transaction[]>([
    {
      txid: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
      outpoint: "a1b2c3d4e5f6g7h8i9j0k1ls9t0u1v2w3x4y5z6a7b8c9d0e1f2_0",
      blockHeight: 789123,
      timestamp: new Date().toISOString(),
      status: "Done",
    },
    {
      txid: "f2e1d0c9b8a7z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1",
      outpoint: "f2e1d0c9b8a7z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1_1",
      blockHeight: 789124,
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      status: "Done",
    },
  ]);
  const [loading] = useState(false);

//   useEffect(() => {
//     // Replace this with your real API call
//     async function fetchTransactions() {
//       setLoading(true);
//       // Example: fetch from /api/transactions
//       const res = await fetch("/api/transactions");
//       const data = await res.json();
//       setTransactions(data.transactions || []);
//       setLoading(false);
//     }
//     fetchTransactions();
//   }, []);

  return (
    <div className="p-4 space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold mb-4">Transaction Ledger</h1>
      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>TxID</th>
              <th>Outpoint</th>
              <th>Block Height</th>
              <th>Timestamp</th>
              <th>Status</th>
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
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-4">
                  No transactions found.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.outpoint}>
                  <td className="font-mono text-xs">
                    {tx.txid.slice(0, 8)}...{tx.txid.slice(-8)}
                  </td>
                  <td className="font-mono text-xs">{tx.outpoint.slice(0, 10)}...{tx.outpoint.slice(-10)}</td>
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
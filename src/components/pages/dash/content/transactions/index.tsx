"use client";

import { Pagination } from "@/components/common/Pagination";
import { apiFetch } from "@/utils/api";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FaFilter } from "react-icons/fa6";

type Transaction = {
  txid: string;
  requestId: string;
  timestamp: string;
  status: string;
  requestedBy: string;
  type: "MINT" | "BURN" | "REFUND";
};

export default function DashboardTransactionsContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter state - NO filters selected by default (empty object means show all)
  const [filters, setFilters] = useState<Record<string, boolean>>({
    MINT: false,
    BURN: false,
    REFUND: false,
  });
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Handle pagination change
  const handlePageChange = (newPage: number) => {
    setPagination({
      ...pagination,
      page: newPage,
    });
    // Fetch transactions with new page number
    fetchTransactions(newPage, pagination.limit, buildFilterQuery(filters));
  };


  // Build query string for enabled filters
  const buildFilterQuery = (currentFilters: Record<string, boolean>) => {
    const enabledTypes = Object.entries(currentFilters)
      .filter(([_, enabled]) => enabled)
      .map(([type, _]) => type);
    
    // If no filters are selected, return empty string (API will return all records)
    // If filters are selected, return comma-separated list
    return enabledTypes.length > 0 ? enabledTypes.join(',') : '';
  };

  // Fetch transactions with filters
  const fetchTransactions = async (page: number, limit: number, filterTypes?: string) => {
    try {
      setLoading(true);
      
      // Build URL with pagination and filter parameters
      let url = `/api/transactionRecords?page=${page}&limit=${limit}`;
      
      // Only add types parameter if filters are actually selected
      if (filterTypes && filterTypes.length > 0) {
        url += `&types=${encodeURIComponent(filterTypes)}`;
      }
      // If no filterTypes or empty string, API will return all records by default
      
      const response = await apiFetch(url);
      const data = await response.json();
      // console.log("Transaction Data:", data);
      setTransactions(data.transactionRecords);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching Transaction Records:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error fetching transaction records"
      );
    } finally {
      setLoading(false);
    }
  };


  // Handle filter change
  const handleFilterChange = (type: string) => {
    const newFilters = {
      ...filters,
      [type]: !filters[type],
    };
    setFilters(newFilters);
    pagination.page = 1;
    
    // Fetch data with new filters
    const filterQuery = buildFilterQuery(newFilters);
    fetchTransactions(pagination.page, pagination.limit, filterQuery);
  };

  // Initial data fetch - no filters applied initially (shows all transactions)
  useEffect(() => {
    // On initial load, don't pass any filter query (empty string = show all)
    fetchTransactions(pagination.page, pagination.limit, '');
  }, []); // Empty dependency array for initial load only

  // Count of active filters
  const activeFiltersCount = Object.values(filters).filter(Boolean).length;
  const totalFiltersCount = Object.keys(filters).length;

  return (
    <div className="p-4 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold mb-4">Transaction Ledger</h1>
        
        {/* Enhanced Filter Button with Badge */}
        <div className="relative mb-4">
          <button
            type="button"
            className={`btn btn-outline btn-sm ${
              activeFiltersCount > 0 ? 'btn-primary' : ''
            }`}
            onClick={() => setShowDropdown((prev) => !prev)}
          >
            <FaFilter />
            Filters
            {activeFiltersCount > 0 && (
              <p className="badge badge-xs badge-primary rounded-full pt-0.5 ml-1">
                {activeFiltersCount}
              </p>
            )}
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
            <div className="absolute z-10 mt-2 w-fit bg-base-100 border border-base-300 rounded-lg shadow-lg p-3 right-0">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Transaction Types</span>
              </div>
              
              {["MINT", "BURN", "REFUND"].map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 py-1 cursor-pointer hover:bg-base-200 rounded px-2"
                >
                  <input
                    type="checkbox"
                    checked={filters[type]}
                    onChange={() => handleFilterChange(type)}
                    className="checkbox checkbox-xs"
                  />
                  <span className="text-sm">{type}</span>
                  <span className={`badge badge-xs ${
                    type === 'MINT' ? 'badge-success' :
                    type === 'BURN' ? 'badge-error' :
                    'badge-warning'
                  }`}>
                    {type.toLowerCase()}
                  </span>
                </label>
              ))}
              
              {activeFiltersCount === 0 && (
                <div className="text-xs text-success mt-2 px-2 py-1 bg-success/10 rounded">
                  ✓ No filters applied - showing all transaction types
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Active Filters Display - only show when filters are actually applied */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-secondary">Active filters:</span>
          {Object.entries(filters)
            .filter(([_, enabled]) => enabled)
            .map(([type, _]) => (
              <span
                key={type}
                className={`badge badge-sm ${
                  type === 'MINT' ? 'badge-success' :
                  type === 'BURN' ? 'badge-error' :
                  'badge-warning'
                }`}
              >
                {type}
                <button
                  type="button"
                  className="ml-1 hover:bg-black/20 rounded-full p-0.5 text-sm"
                  onClick={() => handleFilterChange(type)}
                >
                  ×
                </button>
              </span>
            ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>TxID</th>
              <th>Request ID</th>
              <th>Timestamp</th>
              <th>Type</th>
              <th>Explore</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-4">
                  <span className="loading loading-spinner loading-sm"></span>
                  Loading transactions...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4">
                  No transactions found
                  {activeFiltersCount > 0 && " for the selected filters"}.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.txid}>
                  <td className="font-mono text-xs">
                    {tx.txid.slice(0, 8)}...{tx.txid.slice(-8)}
                  </td>
                  <td className="font-mono text-xs">
                    {tx.requestId}
                  </td>
                  <td>{new Date(tx.timestamp).toLocaleString()}</td>
                  <td>
                    <span className={`badge badge-outline ${
                      tx.type === 'MINT' ? 'badge-success' :
                      tx.type === 'BURN' ? 'badge-error' :
                      'badge-warning'
                    }`}>
                      {tx.type}
                    </span>
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
      
      {/* Pagination Component */}
      {transactions.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          itemsPerPage={pagination.limit}
          totalItems={pagination.total}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
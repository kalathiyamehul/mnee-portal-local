"use client";

import { useEffect, useState } from "react";
import { ActivityLog } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { Pagination } from "@/components/common/Pagination";

interface ActivityContentProps {
  initialActivityLogs: ActivityLog[];
  initialPagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function DashboardActivityContent({
  initialActivityLogs,
  initialPagination,
}: ActivityContentProps) {
  const [activityLogs, setActivityLogs] = useState(initialActivityLogs);
  const [pagination, setPagination] = useState(initialPagination);
  const [loading, setLoading] = useState(false);

  const fetchActivityLogs = async (page: number, limit: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/activity?page=${page}&limit=${limit}`);
      const data = await response.json();
      setActivityLogs(data.activityLogs);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    fetchActivityLogs(page, pagination.limit);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen animate-fade-in">
        <div className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Activity Logs</h1>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Action</th>
              <th>Description</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {activityLogs.map((log) => (
              <tr key={log.id}>
                <td>{log.name || "-"}</td>
                <td>{log.action || "-"}</td>
                <td>{log.description || "-"}</td>
                <td>
                  {formatDistanceToNow(new Date(log.createdAt), {
                    addSuffix: true,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activityLogs.length > 0 && (
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

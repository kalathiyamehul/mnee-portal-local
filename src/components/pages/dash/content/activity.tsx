"use client";

import { useEffect, useState } from "react";
import { ActivityLog } from "@prisma/client";
import { format, formatDistanceToNow } from "date-fns";
import { Pagination } from "@/components/common/Pagination";
import { ExportButtons } from "@/components/common/ExportButtons";
import { apiFetch } from "@/utils/api";
import { MdOutlineOpenInNew } from "react-icons/md";
import CustomToast from "@/components/common/CustomToast";

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
      const response = await apiFetch(`/api/activity?page=${page}&limit=${limit}`);
      const data = await response.json();
      setActivityLogs(data.activityLogs);
      setPagination(data.pagination);
    } catch (error) {
      // console.error("Error fetching activity logs:", error);
      CustomToast.error(
        error instanceof Error ? error.message : "Error fetching activity logs"
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    fetchActivityLogs(page, pagination.limit);
  };

  // Handler for exporting activity logs
  const handleExport = async () => {
    const response = await apiFetch("/api/activity?page=-1&limit=-1");
    if (!response.ok) {
      throw new Error("Failed to fetch customers for export");
    }
    const data = await response.json();
    return data.activityLogs.map((log: any) => ({
      Name: log.name || "-",
      Action: log.action || "-",
      Description: log.description || "-",
      Time: new Date(log.createdAt).toLocaleString(),
    }));
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
      <ExportButtons filename="activity-logs" onExport={handleExport} />
      <h1 className="text-2xl font-bold">Activity Logs</h1>
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Action</th>
              <th style={{ maxWidth: '600px' }}>Description</th>
              <th>Time</th>
              <th>Track</th>
            </tr>
          </thead>
          <tbody>
            {activityLogs.map((log) => (
              <tr key={log.id}>
                <td>{log.action || "-"}</td>
                <td style={{ maxWidth: '600px' }}>{log.description || "-"}</td>
                <td>
                  {format(new Date(log.createdAt), "dd/MM/yyyy, HH:mm:ss")}
                </td>
                <td>{log.redirectUrl && <a href={log.redirectUrl} className="btn btn-link btn-sm">View <MdOutlineOpenInNew className="w-3 h-3" /></a>}</td>
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

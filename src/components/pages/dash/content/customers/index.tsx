"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CustomerModal } from "../modals/CustomerModal";
import { formatDistanceToNow } from "date-fns";
import { FaUserPlus, FaEdit } from "react-icons/fa";
import {
  MdOutlineArrowBack,
  MdOutlineArrowForward,
  MdOutlineOpenInNew,
} from "react-icons/md";
import { useCustomer } from "@/contexts/CustomerContext";
import { useBalance } from "@/contexts/BalanceContext";
import { getGravatarUrl } from "@/utils/gravatar";
import { getConfig } from "@/lib/config";
import { toToken } from "satoshi-token";
import type { Config, Customer } from "@prisma/client";
import { FetchStatus } from "@/types/common";
import toast, { ErrorIcon } from "react-hot-toast";
import { Pagination } from "@/components/common/Pagination";
import { ExportButtons } from "@/components/common/ExportButtons";
import { usePermission } from "@/hooks/usePermission";
import { Resource, Action } from "@/lib/permission";
import { apiFetch } from "@/utils/api";

export default function DashboardCustomersContent() {
  const router = useRouter();
  const { customers, loading, error, fetchCustomers, pagination } =
    useCustomer();
  const { balances, fetchBalances, balancesLoading } = useBalance();
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [config, setConfig] = useState<Config | null>(null);
  const { hasPermission } = usePermission();
  const isSuperAdmin = hasPermission(Resource.SUPER_ADMIN, Action.MANAGE);
  useEffect(() => {
    const init = async () => {
      try {
        const configData = await getConfig();
        setConfig(configData);
      } catch (error) {
        // console.error("Error loading config:", error);
        toast.error("Failed to load config");
      }
    };
    init();
  }, []);

  useEffect(() => {
    fetchCustomers(pagination.page, pagination.limit);
  }, [fetchCustomers, pagination.page, pagination.limit]);

  useEffect(() => {
    if (loading) return;

    const addresses = customers?.map((c) => c.address).filter(Boolean);
    if (addresses?.length && balancesLoading === FetchStatus.IDLE) {
      fetchBalances(addresses);
    }
  }, [customers, fetchBalances, balancesLoading, loading]);

  if (loading || !config) {
    return (
      <div className="flex justify-center items-center min-h-screen animate-fade-in">
        <div className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="alert alert-error">{error.message}</div>
      </div>
    );
  }

  const handleEdit = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomer(customer);
    setShowModal(true);
  };

  const handlePageChange = (page: number) => {
    fetchCustomers(page, pagination.limit);
  };

  const handleExport = async () => {
    try {
      const response = await apiFetch("/api/customers?page=-1&limit=-1");
      if (!response.ok) {
        throw new Error("Failed to fetch customers for export");
      }
      const data = await response.json();

      return data.customers.map((customer: any) => ({
        ID: customer.id,
        Name: customer.name,
        Email: customer.email,
        Address: customer.address,
        "Created By": customer.creator.email,
        "Created At": new Date(customer.createdAt).toLocaleDateString(),
      }));
    } catch (error) {
      // console.error("Error exporting customers:", error);
      toast.error("Failed to export customers");
      throw error;
    }
  };

  return (
    <div className="p-4 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="flex gap-2">
          <ExportButtons filename="customers" onExport={handleExport} />
          {(hasPermission(Resource.CUSTOMER, Action.CREATE) || isSuperAdmin) && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="btn btn-primary btn-sm gap-2"
            >
              <FaUserPlus className="w-4 h-4" />
              Add Customer
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr className="text-base-content/70 text-sm border-b border-base-200">
              <th className="bg-base-100">Customer</th>
              <th className="bg-base-100">MNEE Address</th>
              <th className="bg-base-100">Created By</th>
              <th className="bg-base-100 w-[180px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((customer) => (
              <tr
                key={customer.id}
                className="hover border-l-4 border-l-transparent hover:border-l-primary cursor-pointer"
                onClick={() => router.push(`/dash/customers/${customer.id}`)}
              >
                <td>
                  <div className="flex items-center gap-3">
                    <div className="avatar">
                      <div className="mask mask-squircle w-10 h-10">
                        <img
                          src={getGravatarUrl(customer.email)}
                          alt="Customer avatar"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-base-content/70">
                        {customer.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm">
                        {customer.address}
                      </div>
                      <a
                        href={`https://whatsonchain.com/address/${customer.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs btn-square"
                        onClick={(e) => e.stopPropagation()}
                        title="View on WhatsOnChain"
                      >
                        <MdOutlineOpenInNew className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-sm text-base-content/70">
                      Balance:{" "}
                      {balancesLoading === FetchStatus.LOADING ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : balancesLoading === FetchStatus.ERROR ? (
                        "X MNEE"
                      ) : balances[customer.address] !== undefined ? (
                        `${toToken(
                          balances[customer.address].toString(),
                          config.decimals
                        )} MNEE`
                      ) : (
                        "0 MNEE"
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="avatar">
                      <div className="mask mask-squircle w-10 h-10">
                        <img
                          src={getGravatarUrl(customer.creator.email)}
                          alt="Creator avatar"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">
                        {customer.creator.email}
                      </div>
                      <div className="text-sm text-base-content/70">
                        {formatDistanceToNow(new Date(customer.createdAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex gap-2">
                    {(hasPermission(Resource.CUSTOMER, Action.UPDATE) ||
                      isSuperAdmin) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(
                            {
                              id: customer.id,
                              name: customer.name,
                              email: customer.email,
                              address: customer.address,
                              no_of_approvals: customer.noOfApprovals,
                              createdBy: customer.creator.email,
                              createdAt: new Date(customer.createdAt),
                              updatedAt: new Date(customer.createdAt),
                            },
                            e
                          );
                        }}
                        className="btn btn-ghost btn-sm gap-2"
                        title="Edit customer"
                      >
                        <FaEdit className="w-4 h-4" />
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dash/customers/${customer.id}`);
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!customers?.length && (
              <tr>
                <td
                  colSpan={4}
                  className="text-center py-4 text-base-content/70"
                >
                  No customers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {customers && customers.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          itemsPerPage={pagination.limit}
          totalItems={pagination.total}
          onPageChange={handlePageChange}
        />
      )}

      {showModal && (
        <CustomerModal
          customer={
            selectedCustomer
              ? {
                  ...selectedCustomer,
                  noOfApproval: selectedCustomer.no_of_approvals ?? 0,
                }
              : undefined
          }
          onClose={() => {
            setShowModal(false);
            setSelectedCustomer(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setSelectedCustomer(null);
            fetchCustomers(pagination.page, pagination.limit);
          }}
        />
      )}
    </div>
  );
}
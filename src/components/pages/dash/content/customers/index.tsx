"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { CustomerModal } from "../modals/CustomerModal";
import { FaEdit, FaUserPlus, FaPaperPlane } from "react-icons/fa";
import { MdOutlineOpenInNew } from "react-icons/md";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { getGravatarUrl } from "@/utils/gravatar";

interface Customer {
  id: string;
  name: string;
  email: string;
  address: string;
  createdAt: string;
  createdBy: string;
  creator: {
    name: string | null;
    email: string;
  };
}

export default function DashboardCustomersContent() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const router = useRouter();

  const fetchCustomers = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      const response = await fetch('/api/customers');
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchCustomers();
    }
  }, [session, fetchCustomers]);

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCustomer(null);
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard');
  };

  const handleSend = (address: string) => {
    router.push(`/dash/wallet?showTransfer=true&address=${address}`);
  };

  const handleRowClick = (customerId: string) => {
    router.push(`/dash/customers/${customerId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen animate-fade-in">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Customers</h1>
        <button
          className="btn btn-primary btn-sm gap-2"
          onClick={() => setShowModal(true)}
        >
          <FaUserPlus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr className="text-base-content/70 text-sm border-b border-base-200">
              <th className="bg-base-100">Customer</th>
              <th className="bg-base-100">Address</th>
              <th className="bg-base-100">Created By</th>
              <th className="bg-base-100 w-[180px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr 
                key={customer.id} 
                className="hover border-l-4 border-l-transparent hover:border-l-primary cursor-pointer"
                onClick={(e) => {
                  // Don't navigate if clicking on action buttons
                  if ((e.target as HTMLElement).closest('.actions')) {
                    return;
                  }
                  handleRowClick(customer.id);
                }}
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
                      <div className="text-sm text-base-content/70">{customer.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyAddress(customer.address);
                      }}
                      className="font-mono text-sm hover:text-primary transition-colors"
                    >
                      {customer.address}
                    </button>
                    <a
                      href={`https://whatsonchain.com/address/${customer.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-xs btn-square"
                      title="View on WhatsOnChain"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MdOutlineOpenInNew className="w-3 h-3" />
                    </a>
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
                      <div className="font-medium">{customer.creator.email}</div>
                      <div className="text-sm text-base-content/70">
                        {formatDistanceToNow(new Date(customer.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex gap-2 actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(customer);
                      }}
                      className="btn btn-ghost btn-sm gap-2"
                      title="Edit customer"
                    >
                      <FaEdit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSend(customer.address);
                      }}
                      className="btn btn-ghost btn-sm gap-2"
                      title="Send MNEE"
                    >
                      <FaPaperPlane className="w-4 h-4" />
                      Send
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-4 text-base-content/70">
                  No customers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CustomerModal
          onClose={handleCloseModal}
          onSuccess={fetchCustomers}
          customer={selectedCustomer || undefined}
        />
      )}
    </div>
  );
} 
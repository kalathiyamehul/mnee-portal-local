"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { CustomerModal } from "../modals/CustomerModal";
import { FaEdit, FaUserPlus, FaPaperPlane } from "react-icons/fa";
import { MdOutlineOpenInNew } from "react-icons/md";
import { formatDistanceToNow } from "date-fns";
import md5 from "md5";
import { useRouter } from "next/navigation";

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

  const getGravatarUrl = (email: string) => {
    const hash = md5(email.toLowerCase().trim());
    return `https://www.gravatar.com/avatar/${hash}?d=mp&s=40`;
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard');
  };

  const handleSend = (address: string) => {
    router.push(`/dash/wallet?showTransfer=true&address=${address}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <button
          className="btn btn-primary btn-xs"
          onClick={() => setShowModal(true)}
        >
          <FaUserPlus className="mr-1" />
          <span className="text-sm">Add Customer</span>
        </button>
      </div>

      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Address</th>
              <th>Created By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="hover border-l-4 border-l-base-200">
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
                      <div className="text-sm opacity-50">{customer.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => handleCopyAddress(customer.address)}
                      className="font-mono text-sm hover:text-primary transition-colors"
                    >
                      {customer.address}
                    </button>
                    <a
                      href={`https://whatsonchain.com/address/${customer.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm link link-hover flex items-center gap-1"
                    >
                      View Activity
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
                      <div className="text-sm opacity-50">
                        {formatDistanceToNow(new Date(customer.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(customer)}
                      className="btn btn-ghost btn-sm gap-2"
                      title="Edit customer"
                    >
                      <FaEdit className="text-base-content/70" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleSend(customer.address)}
                      className="btn btn-ghost btn-sm gap-2"
                      title="Send MNEE"
                    >
                      <FaPaperPlane className="text-base-content/70" />
                      <span>Send</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-4">
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
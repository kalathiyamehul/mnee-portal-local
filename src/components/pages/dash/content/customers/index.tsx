"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { CustomerModal } from "../modals/CustomerModal";

interface Customer {
  id: string;
  name: string;
  email: string;
  address: string;
  createdAt: string;
}

export default function DashboardCustomersContent() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchCustomers = async () => {
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
  };

  useEffect(() => {
    fetchCustomers();
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Customers</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
        >
          Add Customer
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Address</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.email}</td>
                <td className="font-mono">
                  {customer.address.slice(0, 8)}...{customer.address.slice(-8)}
                </td>
                <td>{new Date(customer.createdAt).toLocaleDateString()}</td>
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

      {showAddModal && (
        <CustomerModal
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchCustomers}
        />
      )}
    </div>
  );
} 
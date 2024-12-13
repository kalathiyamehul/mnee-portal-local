"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { CustomerModal } from "../modals/CustomerModal";
import { FaEdit } from "react-icons/fa";

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
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

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

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCustomer(null);
  };

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
          onClick={() => setShowModal(true)}
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
              <th>Actions</th>
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
                <td>
                  <button
                    onClick={() => handleEdit(customer)}
                    className="btn btn-ghost btn-sm"
                    title="Edit customer"
                  >
                    <FaEdit className="text-base-content/70" />
                  </button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-4">
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
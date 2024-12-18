"use client";

import { useState } from "react";
import { FaSpinner } from "react-icons/fa6";
import { toast } from "react-hot-toast";
import { useCustomer } from "@/contexts/CustomerContext";

interface CustomerModalProps {
  customer?: {
    id: string;
    name: string;
    email: string;
    address: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function CustomerModal({ customer, onClose, onSuccess }: CustomerModalProps) {
  const { createCustomer, updateCustomer } = useCustomer();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: customer?.name || "",
    email: customer?.email || "",
    address: customer?.address || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (customer) {
        await updateCustomer(customer.id, formData);
        toast.success("Customer updated successfully");
      } else {
        await createCustomer(formData);
        toast.success("Customer created successfully");
      }
      onSuccess();
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog id="customer_modal" className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold mb-6">{customer ? 'Edit' : 'Add New'} Customer</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <label className="form-control w-full mb-4">
              <div className="label">
                <span className="label-text">Customer Name</span>
              </div>
              <input
                type="text"
                className="input input-bordered w-full max-w-md"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter customer name"
                required
              />
            </label>

            <label className="form-control w-full mb-4">
              <div className="label">
                <span className="label-text">Email Address</span>
              </div>
              <input
                type="email"
                className="input input-bordered w-full max-w-md"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter customer email"
                required
              />
            </label>

            <label className="form-control w-full mb-4">
              <div className="label">
                <span className="label-text">Bitcoin SV Address</span>
              </div>
              <input
                type="text"
                className="input input-bordered w-full max-w-md font-mono"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter Bitcoin SV address"
                required
              />
            </label>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin mr-2" />
                  {customer ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                customer ? 'Update Customer' : 'Create Customer'
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </dialog>
  );
} 
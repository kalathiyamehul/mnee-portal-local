"use client";

import { useState } from "react";
import { FaSpinner } from "react-icons/fa6";
import { toast } from "react-hot-toast";

interface CustomerModalProps {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const CustomerModal = ({ onClose, onSuccess }: CustomerModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !address) return;

    try {
      setLoading(true);
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          address,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create customer");
      }

      await onSuccess();
      onClose();
      toast.success("Customer created successfully");
    } catch (error) {
      console.error("Error creating customer:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog id="customer_modal" className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold mb-6">Add New Customer</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <label className="form-control w-full mb-4">
              <div className="label">
                <span className="label-text">Customer Name</span>
              </div>
              <input
                type="text"
                className="input input-bordered w-full max-w-md"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                value={address}
                onChange={(e) => setAddress(e.target.value)}
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
              disabled={loading || !name || !email || !address}
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Create Customer"
              )}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}; 
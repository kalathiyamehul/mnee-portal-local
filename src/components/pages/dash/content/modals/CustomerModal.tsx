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
  // Add validation states
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    address: ''
  });
  
  const [formData, setFormData] = useState({
    name: customer?.name || "",
    email: customer?.email || "",
    address: customer?.address || "",
  });

  // Validation functions
  const validateName = (name: string) => {
    if (name.length < 2) return "Name must be at least 2 characters long";
    if (name.length > 50) return "Name must be less than 50 characters";
    if (!/^[a-zA-Z\s'-]+$/.test(name)) return "Name can only contain letters, spaces, hyphens and apostrophes";
    return "";
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
    // Fix email validation logic
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    if (email.length > 255) return "Email is too long";
    return "";
  };

  const validateAddress = (address: string) => {
    // Bitcoin address validation
    if (/\s/.test(address)) return "Address cannot contain spaces";
    if (/[^A-Za-z0-9]/.test(address.slice(1))) return "Address can only contain letters and numbers";
    if (!address.startsWith('1')) return "Invalid Ordinals Address";
    if (!/^1[A-Za-z0-9]{34}$/.test(address)) {
      return "Address Length must be 35 characters";
    }
    return "";
  };

  // Handle input changes with validation
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    let error = '';
    switch (field) {
      case 'name':
        error = validateName(value);
        break;
      case 'email':
        error = validateEmail(value);
        break;
      case 'address':
        error = validateAddress(value);
        break;
    }
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields before submission
    const nameError = validateName(formData.name);
    const emailError = validateEmail(formData.email);
    const addressError = validateAddress(formData.address);

    setErrors({
      name: nameError,
      email: emailError,
      address: addressError
    });

    // Improved error feedback
    if (nameError || emailError || addressError) {
      const firstError = [nameError, emailError, addressError].find(e => e);
      toast.error(firstError || "Please fix the form errors");
      return;
    }

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

  // Update form inputs to include error messages
  return (
    <dialog id="customer_modal" className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold mb-6">{customer ? 'Edit' : 'Add New'} Customer</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="form-control w-full mb-4">
              <label className="label label-text">
                Customer Name
              </label>
              <input
                type="text"
                className={`input input-bordered w-full max-w-md ${errors.name ? 'input-error' : ''}`}
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter customer name"
                required
              />
              {errors.name && <div className="label mt-1">
                <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">{errors.name}</span>
              </div>}
            </div>

            <div className="form-control w-full mb-4">
              <label className="label label-text">
                Email Address
              </label>
              <input
                type="email"
                className={`input input-bordered w-full max-w-md ${errors.email ? 'input-error' : ''}`}
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter customer email"
                required
              />
              {errors.email && <div className="label mt-1">
                <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">{errors.email}</span>
              </div>}
            </div>

            <div className="form-control w-full mb-4">
              <label className="label label-text">
                Ordinals Address
              </label>
              <input
                type="text"
                className={`input input-bordered w-full max-w-md font-mono ${errors.address ? 'input-error' : ''}`}
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                maxLength={35}
                placeholder="Enter 1Sat Ordinals address"
                required
              />
              {errors.address && <div className="label mt-1">
                <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">{errors.address}</span>
              </div>}
            </div>
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
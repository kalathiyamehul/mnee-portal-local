"use client";

import { useEffect, useState } from "react";
import { FaSpinner } from "react-icons/fa6";
import { toast } from "react-hot-toast";
import { useCustomer } from "@/contexts/CustomerContext";
import { apiFetch } from "@/utils/api";

interface CustomerModalProps {
  customer?: {
    id: string;
    name: string;
    email: string;
    address: string;
    noOfApproval: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function CustomerModal({
  customer,
  onClose,
  onSuccess,
}: CustomerModalProps) {
  const { createCustomer, updateCustomer } = useCustomer();
  const [no_of_approvals, setnoOfApprovals] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<{
    minNoOfApproval: number;
    maxNoOfApproval: number;
  } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await apiFetch("/api/config");
        if (!response.ok) {
          throw new Error("Failed to fetch configuration");
        }
        const data = await response.json();
        setConfig({
          minNoOfApproval: data.minNoOfApproval,
          maxNoOfApproval: data.maxNoOfApproval,
        });
      } catch (error) {
        // console.error("Error fetching config:", error);
        toast.error("Failed to fetch configuration");
      }
    };

    fetchConfig();
  }, []);

  // Add validation states
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    address: "",
    noOfApproval: "",
  });

  const [formData, setFormData] = useState({
    name: customer?.name || "",
    email: customer?.email || "",
    address: customer?.address || "",
    noOfApproval: customer?.noOfApproval || 2, // Add noOfApproval field with default
  });

  // Validation functions
  const validateName = (name: string) => {
    if (name.length < 2) return "Name must be at least 2 characters long";
    if (name.length > 50) return "Name must be less than 50 characters";
    // Unicode letters, marks, spaces, hyphens, apostrophes
    if (!/^[\p{L}\p{M}\s'-]+$/u.test(name)) return "Name can only contain letters, spaces, hyphens and apostrophes";
    return "";
  };

  const validateEmail = (email: string) => {
    // Allow Unicode letters, numbers, ., _, and - before @
    if (!/^[\p{L}\p{N}._-]+@[a-zA-Z0-9.]+\.[a-zA-Z]{2,}$/u.test(email)) return "Please enter a valid email address";
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

  const validateApproval = (value: number) => {
    if (value < 1) return "Minimum 1 approval required";
    if (value > 10) return "Maximum 10 approvals allowed";
    return ""; // Add empty string return for valid cases
  };

  // Handle input changes with validation
  const handleInputChange = (
    field: keyof typeof formData,
    value: string | number
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    let error = "";
    switch (field) {
      case "name":
        error = validateName(value.toString());
        break;
      case "email":
        error = validateEmail(value.toString());
        break;
      case "address":
        error = validateAddress(value.toString());
        break;
      case "noOfApproval":
        const approvalError = validateApproval(Number(value));
        error = approvalError ? approvalError.toString() : "";
        break;
    }
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields before submission
    const nameError = validateName(formData.name);
    const emailError = validateEmail(formData.email);
    const addressError = validateAddress(formData.address);

    // Update the error state setting to handle string returns
    setErrors({
      name: nameError,
      email: emailError,
      address: addressError,
      noOfApproval: validateApproval(formData.noOfApproval) || "", // Ensure string type
    });

    // Improved error feedback
    if (nameError || emailError || addressError) {
      const firstError = [nameError, emailError, addressError].find((e) => e);
      toast.error(firstError || "Please fix the form errors");
      return;
    }

    setLoading(true);
    try {
      let response;
      if (customer) {
        // Update customer
        response = await apiFetch(`/api/customers/${customer.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            address: formData.address,
          }),
        });
      } else {
        // Create customer
        response = await apiFetch("/api/customerRequest", {
          method: "POST",
          body: JSON.stringify({
            ...formData,
            action: "CREATE",
          }),
        });
      }

      if (!response.ok) throw new Error("Failed to submit request");

      toast.success(
        customer
          ? "Customer updated successfully"
          : "Customer request submitted for approval"
      );
      onSuccess();
    } catch (error) {
      // console.error("Error saving customer request:", error);
      toast.error(
        customer
          ? "Failed to update customer"
          : "Failed to submit customer request"
      );
    } finally {
      setLoading(false);
    }
  };

  // Update form inputs to include error messages
  return (
    <dialog id="customer_modal" className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold mb-6">
          {customer ? "Edit" : "Add New"} Customer
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="form-control w-full mb-4">
              <label className="label label-text">Customer Name</label>
              <input
                type="text"
                className={`input input-bordered w-full max-w-md ${
                  errors.name ? "input-error" : ""
                }`}
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter customer name"
                required
              />
              {errors.name && <div className="label mt-1">
                <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">{errors.name}</span>
              </div>}
            </div>

            <div className="form-control w-full mb-4">
              <label className="label label-text">Email Address</label>
              <input
                type="email"
                className={`input input-bordered w-full max-w-md ${
                  errors.email ? "input-error" : ""
                }`}
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="Enter customer email"
                required
              />
              {errors.email && <div className="label mt-1">
                <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">{errors.email}</span>
              </div>}
            </div>

            <div className="form-control w-full mb-4">
              <label className="label label-text">Ordinals Address</label>
              <input
                type="text"
                className={`input input-bordered w-full max-w-md font-mono ${
                  errors.address ? "input-error" : ""
                }`}
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
            {customer ? (
              ""
            ) : (
              <div className="form-control w-full block">
                <label className="label my-2">
                  <span className="label-text">No of Approvals</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered w-full max-w-md"
                  value={no_of_approvals}
                  onChange={(e) => {
                    let value = e.target.value;
                    // Only allow non-negative integers
                    if (/^\d*$/.test(value)) {
                      let num = parseInt(value, 10);
                      if (
                        isNaN(num) ||
                        (config && num < config.minNoOfApproval)
                      ) {
                        setnoOfApprovals(
                          config?.minNoOfApproval?.toString() || ""
                        );
                      } else if (
                        config?.maxNoOfApproval &&
                        num > config.maxNoOfApproval
                      ) {
                        toast.error(
                          `No of Approvals must be less than or equal to ${config?.maxNoOfApproval}`
                        );
                      } else {
                        setnoOfApprovals(value);
                      }
                    }
                  }}
                  placeholder={`Enter no_of_approvals value (between ${config?.minNoOfApproval} and ${config?.maxNoOfApproval})`}
                  min={config?.minNoOfApproval}
                  max={config?.maxNoOfApproval}
                  required
                />
              </div>
            )}
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
                  {customer ? "Updating..." : "Creating..."}
                </>
              ) : customer ? (
                "Update Customer"
              ) : (
                "Create Customer"
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </dialog>
  );
}

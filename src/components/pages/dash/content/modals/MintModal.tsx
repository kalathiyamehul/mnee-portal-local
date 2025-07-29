import { useEffect, useState } from 'react';
import { FaSpinner } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/utils/api';

interface Customer {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
}

interface MintModalProps {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

// Using a conservative max value to ensure safe BigInt conversion
const MAX_TOKEN_VALUE = 10_000_000_000; // 1 billion tokens

export const MintModal = ({ onClose, onSuccess }: MintModalProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [amount, setAmount] = useState("");
  const [no_of_approvals, setnoOfApprovals] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
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

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await apiFetch("/api/customers?page=-1&limit=-1");
        if (!response.ok) {
          throw new Error("Failed to fetch customers");
        }
        const data = await response.json();
        const filteredCustomers = data.customers.filter((customer: Customer) => customer.isActive);// Ensure we only include active customers
        setCustomers(filteredCustomers || []);
      } catch (error) {
        // console.error("Error fetching customers:", error);
        toast.error("Failed to fetch customers");
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer?.address || !amount || !config) return;

    if (Number(amount) <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    const uproarValue = parseInt(no_of_approvals);
    if (
      isNaN(uproarValue) ||
      uproarValue < config.minNoOfApproval ||
      uproarValue > config.maxNoOfApproval
    ) {
      toast.error(
        `No of Approvals must be between ${config.minNoOfApproval} and ${config.maxNoOfApproval}`
      );
      return;
    }

    try {
      setLoading(true);
      const response = await apiFetch("/api/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          customerId: selectedCustomer.id,
          no_of_approvals: uproarValue,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to create mint request");
      }

      await onSuccess();
      onClose();
      toast.success("Mint request created");
    } catch (error) {
      // console.error("Error creating mint request:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create mint request"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loadingCustomers || !config) {
    return (
      <dialog id="mint_modal" className="modal modal-open">
        <div className="modal-box max-w-lg flex items-center justify-center">
          <FaSpinner className="animate-spin text-2xl" />
        </div>
      </dialog>
    );
  }

  if (customers.length === 0) {
    return (
      <dialog id="mint_modal" className="modal modal-open">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold mb-4">No Customers Available</h3>
          <p className="text-sm opacity-70 mb-6">
            Please add customers before creating mint requests.
          </p>
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </dialog>
    );
  }

  return (
    <dialog id="mint_modal" className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold mb-6">Create Mint Request</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <label className="form-control w-full block">
              <div className="label">
                <span className="label-text">Select Customer</span>
              </div>
              <select
                className="select select-bordered w-full max-w-md"
                value={selectedCustomer?.id || ""}
                onChange={(e) => {
                  const customer = customers.find(
                    (c) => c.id === e.target.value
                  );
                  setSelectedCustomer(customer || null);
                }}
                required
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.address.slice(0, 8)}...
                    {customer.address.slice(-8)}
                  </option>
                ))}
              </select>
            </label>

            {selectedCustomer && (
              <div className="text-sm opacity-70 -mt-2 mb-2">
                <p>
                  Selected address:{" "}
                  <span className="font-mono">{selectedCustomer.address}</span>
                </p>
              </div>
            )}

            <label className="form-control w-full block">
              <div className="label my-2">
                <span className="label-text">Amount</span>
              </div>
              <input
                type="text"
                className="input input-bordered w-full max-w-md"
                value={amount}
                onChange={(e) => {
                  // Allow numbers and decimals only
                  if (/^\d*\.?\d*$/.test(e.target.value)) {
                    // make sure its less than MAX_TOKEN_VALUE
                    if (Number(e.target.value) > MAX_TOKEN_VALUE) {
                      toast.error("Amount must be less than 1 billion");
                      return;
                    }
                    setAmount(e.target.value);
                  }
                }}
                placeholder="Enter amount to mint"
                required
              />
              <div className="label my-2">
                <span className="label-text-alt text-sm text-base-content/70">
                  Amount must be greater than 0
                </span>
              </div>
            </label>

            <label className="form-control w-full block">
              <div className="label my-2">
                <span className="label-text">No of Approvals</span>
              </div>
              <input
                type="number"
                className="input input-bordered w-full max-w-md"
                value={no_of_approvals}
                onChange={(e) => {
                  let value = e.target.value;
                  // Only allow non-negative integers
                  if (/^\d*$/.test(value)) {
                    let num = parseInt(value, 10);
                    if (isNaN(num) || num < config.minNoOfApproval) {
                      setnoOfApprovals(config.minNoOfApproval.toString());
                    } else if (num > config.maxNoOfApproval) {
                      setnoOfApprovals(config.maxNoOfApproval.toString());
                    } else {
                      setnoOfApprovals(value);
                    }
                  }
                }}
                placeholder={`Enter no_of_approvals value (between ${config.minNoOfApproval} and ${config.maxNoOfApproval})`}
                min={config.minNoOfApproval}
                max={config.maxNoOfApproval}
                required
              />
              <div className="label my-2">
                <span className="label-text-alt text-sm text-base-content/70">
                  No of Approvals must be between {config.minNoOfApproval} and{" "}
                  {config.maxNoOfApproval}
                </span>
              </div>
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
              disabled={loading || !selectedCustomer || !amount}
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Create Request"
              )}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};
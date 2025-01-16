import { useEffect, useState } from 'react';
import { FaSpinner } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';

interface Customer {
  id: string;
  name: string;
  email: string;
  address: string;
}

interface MintModalProps {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

// Using a conservative max value to ensure safe BigInt conversion
const MAX_TOKEN_VALUE = 10_000_000_000; // 1 billion tokens

export const MintModal = ({
  onClose,
  onSuccess
}: MintModalProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
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
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer?.address || !amount) return;

    if (Number(amount) <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          customerId: selectedCustomer.id,
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
      console.error("Error creating mint request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create mint request");
    } finally {
      setLoading(false);
    }
  };

  if (loadingCustomers) {
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
          <p className="text-sm opacity-70 mb-6">Please add customers before creating mint requests.</p>
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
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const customer = customers.find(c => c.id === e.target.value);
                  setSelectedCustomer(customer || null);
                }}
                required
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.address.slice(0, 8)}...{customer.address.slice(-8)}
                  </option>
                ))}
              </select>
            </label>

            {selectedCustomer && (
              <div className="text-sm opacity-70 -mt-2 mb-2">
                <p>Selected address: <span className="font-mono">{selectedCustomer.address}</span></p>
              </div>
            )}

            <label className="form-control w-full block">
              <div className="label">
                <span className="label-text">Amount</span>
              </div>
              <input
                type="text"
                className="input input-bordered w-full max-w-md"
                value={amount}
                onChange={(e) => {
                  // Allow numbers and decimals only
                  if (/^\d*\.?\d*$/.test(e.target.value)) {
                    setAmount(e.target.value);
                  }
                }}
                placeholder="Enter amount to mint"
                required
              />
              <div className="label">
                <span className="label-text-alt text-base-content/70">Amount must be greater than 0</span>
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
                'Create Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}; 
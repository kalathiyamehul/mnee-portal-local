import { FaSpinner, FaArrowRotateLeft } from 'react-icons/fa6';
import { toToken } from 'satoshi-token';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import CustomToast from '@/components/common/CustomToast';
import { parseTx } from '@/new-cosiner/src/services/helper.refund';

interface RefundModalProps {
  onClose: () => void;
  onSuccess: () => void;
  amount: number;
  decimals: number;
  utxo: {
    txid: string;
    vout: number;
  };
  customerName?: string;
}

export const RefundModal = ({
  onClose,
  onSuccess,
  amount,
  decimals,
  utxo,
  customerName = "the customer",
}: RefundModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  // const [refundAddress, setRefundAddress] = useState("");
  const [numApprovals, setNumApprovals] = useState("");
  const [errors, setErrors] = useState({
    refundAddressError: "",
    numApprovalsError: "",
  });
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
        setNumApprovals(`${data.minNoOfApproval}`);
      } catch (error) {
        // console.error("Error fetching config:", error);
        CustomToast.error("Failed to fetch configuration");
      }
    };

    fetchConfig();
  }, []);

  const validateAddress = (address: string) => {
    // Bitcoin address validation
    if (/\s/.test(address)) return "Address cannot contain spaces";
    if (/[^A-Za-z0-9]/.test(address.slice(1)))
      return "Address can only contain letters and numbers";
    if (!address.startsWith("1")) return "Invalid Ordinals Address";
    if (!/^1[A-Za-z0-9]{33,34}$/.test(address)) {
      return "Address Length must be 35 characters";
    }
    return "";
  };

  const validateApproval = (value: number) => {
    if (config?.minNoOfApproval && value < config.minNoOfApproval)
      return `Minimum ${config.minNoOfApproval} approval required`;
    if (config?.maxNoOfApproval && value > config.maxNoOfApproval)
      return `Maximum ${config.maxNoOfApproval} approvals allowed`;
    return ""; // Add empty string return for valid cases
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    const numApprovalsError = validateApproval(Number(numApprovals));
    setErrors({
      refundAddressError: "",
      numApprovalsError: numApprovalsError,
    });
    if (numApprovalsError) {
      CustomToast.error(numApprovalsError || "Please fix the form errors");
      return;
    }
    setIsLoading(true);
    const result = await parseTx(utxo.txid);
    const refundAddress = result?.cosigners?.[1]?.address;
    try {
      const outpoint = `${utxo.txid}_${utxo.vout}`;
      // console.log('Creating refund request:', { outpoint, refundAddress });

      const response = await apiFetch("/api/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outpoint,
          refundAddress,
          no_of_approvals: Number(numApprovals),
          amount: amount,
        }), // Add approvals to payload
      });

      // console.log('Refund response:', { status: response.status });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create refund request");
      }

      if (!data.requestId) {
        throw new Error("No request ID returned from server");
      }

      CustomToast.success("Refund request created (pending approval)");
      onSuccess();
      onClose();
    } catch (error) {
      // console.error('Error creating refund request:', error);
      CustomToast.error(error instanceof Error ? error.message : 'Failed to create refund request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <dialog id="refund_modal" className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg flex items-center gap-2 text-primary">
          <FaArrowRotateLeft className="w-4 h-4" /> Confirm Refund
        </h3>

        <div className="py-4 space-y-4">
          <div className="bg-base-200 p-4 rounded-lg">
            <div className="text-sm opacity-70 mb-1">Amount to refund</div>
            <div className="text-2xl font-bold">
              {toToken(amount, decimals)} MNEE
            </div>
            <div className="text-xs opacity-50 mt-1 break-all">
              UTXO: {utxo.txid}:{utxo.vout}
            </div>
            {/* New Field: Number of Approvals */}
            <div className="mt-4">
              <label
                className="text-sm opacity-70 mb-1 block"
                htmlFor="num-approvals"
              >
                Number of Approvals
              </label>
              <input
                id="num-approvals"
                type="number"
                className="input input-bordered w-full"
                value={numApprovals}
                onChange={(e) => {
                  let value = e.target.value;
                  // Only allow non-negative integers
                  if (/^\d*$/.test(value)) {
                    let num = parseInt(value, 10);
                    if (
                      isNaN(num) ||
                      (config && num < config.minNoOfApproval)
                    ) {
                      setNumApprovals(
                        config?.minNoOfApproval?.toString() || ""
                      );
                    } else if (
                      config?.maxNoOfApproval &&
                      num > config.maxNoOfApproval
                    ) {
                      CustomToast.error(
                        `No of Approvals must be less than or equal to ${config?.maxNoOfApproval}`
                      );
                    } else {
                      setNumApprovals(value);
                    }
                  }
                }}
                disabled={isLoading}
              />
              {errors && (
                <div className="label mt-1">
                  <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">
                    {errors.numApprovalsError}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* <div className="form-control w-full">
            <label htmlFor="refundAddress" className="label">
              <span className="label-text">Refund Address</span>
              <span className="label-text-alt opacity-70">
                Where to send the refunded tokens
              </span>
            </label>
            <input
              id="refundAddress"
              type="text"
              className="input input-bordered w-full"
              value={refundAddress}
              onChange={(e) => {
                setRefundAddress(e.target.value);
                setErrors({
                  ...errors,
                  refundAddressError: validateAddress(e.target.value),
                });
              }}
              maxLength={35}
              placeholder="Enter refund address"
              required
            />
            {errors && (
              <div className="label mt-1">
                <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">
                  {errors.refundAddressError}
                </span>
              </div>
            )}
          </div> */}

          <div className="alert alert-info">
            <div className="flex flex-col items-start gap-1">
              <div className="font-semibold">Note</div>
              <p className="text-sm">
                This request will require approval from {numApprovals}{" "}
                administrators before the MNEE tokens are returned to the
                specified address. The transaction cannot be reversed once
                confirmed.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-action">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRefund}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Processing...
              </>
            ) : (
              "Request Refund"
            )}
          </button>
        </div>
      </div>
      <form
        method="dialog"
        className="modal-backdrop"
        onClick={onClose}
        onKeyDown={onClose}
      >
        <button type="button">close</button>
      </form>
    </dialog>
  );
};

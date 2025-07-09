import { FaSpinner, FaArrowRotateLeft, FaShield } from "react-icons/fa6";
import { toToken } from "satoshi-token";
import { useState, useEffect } from "react";
import { apiFetch, fetchTxo } from "@/utils/api";
import type { MNEEUtxo } from "@/types";
import CustomToast from "@/components/common/CustomToast";

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
  const [refundAddress, setRefundAddress] = useState("");
  const [numApprovals, setNumApprovals] = useState(2);
  const [utxoData, setUtxoData] = useState<MNEEUtxo | null>(null);
  const [loadingUtxo, setLoadingUtxo] = useState(true);

  // Fetch UTXO data to get the original owners
  useEffect(() => {
    const fetchUtxoData = async () => {
      try {
        setLoadingUtxo(true);
        const outpoint = `${utxo.txid}_${utxo.vout}`;
        const data = await fetchTxo(outpoint);
        setUtxoData(data);

        // Auto-select the first owner if there's only one
        if (data.owners && data.owners.length === 1) {
          setRefundAddress(data.owners[0]);
        }
      } catch (error) {
        // console.error("Error fetching UTXO data:", error);
        CustomToast.error("Failed to load UTXO data");
      } finally {
        setLoadingUtxo(false);
      }
    };

    fetchUtxoData();
  }, [utxo.txid, utxo.vout]);

  const handleRefund = async () => {
    setIsLoading(true);
    try {
      const outpoint = `${utxo.txid}_${utxo.vout}`;
      // console.log('Creating refund request:', { outpoint, refundAddress });

      const response = await apiFetch("/api/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outpoint,
          refundAddress,
          no_of_approvals: numApprovals,
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
      CustomToast.error(
        error instanceof Error
          ? error.message
          : "Failed to create refund request"
      );
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
                min={2}
                className="input input-bordered w-full"
                value={numApprovals}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val < 2) {
                    setNumApprovals(2);
                  } else {
                    setNumApprovals(val);
                  }
                }}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-control w-full">
            <label htmlFor="refundAddress" className="label">
              <span className="label-text flex items-center gap-2">
                <FaShield className="w-3 h-3" />
                Refund Address
              </span>
              <span className="label-text-alt opacity-70">
                Must be an original owner
              </span>
            </label>

            {loadingUtxo ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <FaSpinner className="animate-spin" />
                <span>Loading available addresses...</span>
              </div>
            ) : utxoData?.owners && utxoData.owners.length > 0 ? (
              <select
                id="refundAddress"
                className="select select-bordered w-full"
                value={refundAddress}
                onChange={(e) => setRefundAddress(e.target.value)}
                required
              >
                <option value="">Select an original owner address</option>
                {utxoData.owners.map((owner, index) => (
                  <option key={owner} value={owner}>
                    {owner}{" "}
                    {utxoData.owners.length > 1 && `(Owner ${index + 1})`}
                  </option>
                ))}
              </select>
            ) : (
              <div className="alert alert-error">
                <span>No owner addresses found for this UTXO</span>
              </div>
            )}

            {utxoData?.owners && utxoData.owners.length > 1 && (
              <div className="label">
                <span className="label-text-alt text-info">
                  Multiple owners found. Select the address to receive the
                  refund.
                </span>
              </div>
            )}
          </div>

          <div className="alert alert-info">
            <div className="flex flex-col items-start gap-1">
              <div className="font-semibold flex items-center gap-2">
                <FaShield className="w-4 h-4" />
                Security & Approval Process
              </div>
              <p className="text-sm">
                For security, refunds can only be sent to original UTXO owner
                addresses. This request will require approval from{" "}
                {numApprovals} administrators before the MNEE tokens are
                returned. The transaction cannot be reversed once confirmed.
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
            disabled={!refundAddress || isLoading || loadingUtxo}
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

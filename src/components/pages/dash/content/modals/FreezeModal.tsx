import { useEffect, useState } from "react";
import { FaSpinner, FaSnowflake, FaLock } from "react-icons/fa6";
import { apiFetch } from "@/utils/api";
import CustomToast from "@/components/common/CustomToast";

interface FreezeModalProps {
  onClose: () => void;
  onSuccess: () => Promise<void>;
  canFreeze: boolean;
  canBlacklist: boolean;
}

export const FreezeModal = ({
  onClose,
  onSuccess,
  canFreeze,
  canBlacklist
}: FreezeModalProps) => {
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('');  // Add reason state
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [config, setConfig] = useState<{
    minNoOfApproval: number;
    maxNoOfApproval: number;
  } | null>(null);
  const [no_of_approvals, setnoOfApprovals] = useState<number>(config?.minNoOfApproval || 2);

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
        setnoOfApprovals(data.minNoOfApproval);
      } catch (error) {
        // console.error("Error fetching config:", error);
        CustomToast.error("Failed to fetch configuration");
      }
    };

    fetchConfig();
  }, []);

  const handleFreezeRequest = async () => {
    try {
      setFreezeLoading(true);
      const response = await apiFetch("/api/freeze", {
        method: "POST",
        body: JSON.stringify({
          address,
          action: "FREEZE",
          no_of_approvals: no_of_approvals || 2,
          reason, // Include reason
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to create freeze request");
      }

      await onSuccess();
      onClose();
      CustomToast.success("Freeze request created");
    } catch (error) {
      // console.error('Error creating freeze request:', error);
      CustomToast.error(
        error instanceof Error
          ? error.message
          : "Failed to create freeze request"
      );
    } finally {
      setFreezeLoading(false);
    }
  };

  const handleBlacklistRequest = async () => {
    try {
      setBlacklistLoading(true);
      const response = await apiFetch("/api/blacklist", {
        method: "POST",
        body: JSON.stringify({
          address,
          action: "BLACKLIST",
          no_of_approvals: no_of_approvals || 2,
          reason, // Include reason
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create blacklist request");
      }

      await onSuccess();
      onClose();
      CustomToast.success("Blacklist request created");
    } catch (error) {
      // console.error('Error creating blacklist request:', error);
      CustomToast.error(
        error instanceof Error
          ? error.message
          : "Failed to create blacklist request"
      );
    } finally {
      setBlacklistLoading(false);
    }
  };

  return (
    <dialog id="freeze_modal" className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold mb-6">Restrict Address</h3>
        <div className="mb-6 space-y-2 text-sm opacity-70">
          {canFreeze && <p><FaSnowflake className="inline mr-2" /> Freeze: Prevents an address from sending funds</p>}
          {canBlacklist && <p><FaLock className="inline mr-2" /> Blacklist: Prevents an address from receiving funds</p>}
        </div>
        <div className="space-y-4">
          <div className="form-control w-full block">
            <div className="label">
              <span className="label-text">Bitcoin Address</span>
            </div>
            <input
              type="text"
              className="input input-bordered w-full max-w-md font-mono"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Bitcoin SV Address"
              required
            />
          </div>
          <div className="form-control w-full block">
            <label className="label">
              <span className="label-text">Reason</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full max-w-md font-mono"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={100}
              placeholder={`Reason for ${canFreeze ? 'Freezing' : ''}${(canFreeze && canBlacklist)? '/' : ''}${canBlacklist ? 'Blacklisting' : ''} Address`}
              required
            />
          </div>
          <div className="form-control w-full block">
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
                  if (isNaN(num) || num < (config?.minNoOfApproval ?? 2)) {
                    setnoOfApprovals(config?.minNoOfApproval ?? 2);
                  } else if (num > (config?.maxNoOfApproval ?? 2)) {
                    setnoOfApprovals(config?.maxNoOfApproval ?? 2);
                  } else {
                    setnoOfApprovals(Number(value));
                  }
                }
              }}
              placeholder={`Enter no_of_approvals value (between ${config?.minNoOfApproval} and ${config?.maxNoOfApproval})`}
              min={config?.minNoOfApproval}
              max={config?.maxNoOfApproval}
              required
            />
            <div className="label my-2">
              <span className="label-text-alt text-sm text-base-content/70">
                No of Approvals must be between {config?.minNoOfApproval} and{" "}
                {config?.maxNoOfApproval}
              </span>
            </div>
          </div>
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {canBlacklist && <button
            type="button"
            className="btn btn-error"
            onClick={handleBlacklistRequest}
            disabled={blacklistLoading || !address}
          >
            {blacklistLoading ? <FaSpinner className="animate-spin mr-2" /> : 'Blacklist'}
          </button>}
          {canFreeze && <button
            type="button"
            className="btn btn-primary"
            onClick={handleFreezeRequest}
            disabled={freezeLoading || !address}
          >
            {freezeLoading ? <FaSpinner className="animate-spin mr-2" /> : 'Freeze'}
          </button>}
        </div>
      </div>
    </dialog>
  );
};

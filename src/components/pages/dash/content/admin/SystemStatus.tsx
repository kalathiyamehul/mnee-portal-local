import { useSession } from "next-auth/react";
import { FaCheck, FaXmark, FaSpinner } from "react-icons/fa6";
import { toast } from "react-hot-toast";
import { useSystemStatus } from "@/contexts/SystemStatusContext";
import { useState } from "react";
import { apiFetch } from "@/utils/api";

interface SystemStatusProps {
  isPaused: boolean;
  hasPendingPause: boolean;
  hasPendingResume: boolean;
  onPauseToggle: () => Promise<void>;
}

export const SystemStatus = ({ isPaused, hasPendingPause, hasPendingResume, onPauseToggle }: SystemStatusProps) => {
  const { data: session } = useSession();
  const { statusData, fetchStatus } = useSystemStatus();
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const pendingAction = statusData?.systemRequests?.find(req => 
    req.status === 'PENDING' && 
    (req.action === 'PAUSE' || req.action === 'RESUME')
  );

  const isRequester = pendingAction?.requester.email === session?.user?.email;
  const canApprove = pendingAction && !isRequester && 
    !pendingAction.approvals.some(approval => approval.approver?.email === session?.user?.email);

  const handleApprovePause = async () => {
    if (!pendingAction) return;
    
    try {
      const response = await apiFetch("/api/approveSystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionRequestId: pendingAction.id }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to approve pause request");
      }

      await fetchStatus();
      toast.success("Request approved");
    } catch (error) {
      // console.error("Failed to approve request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to approve request");
    }
  };

  const handleCancelPause = async () => {
    if (!pendingAction) return;
    
    setIsCancelling(true);
    try {
      const response = await apiFetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionRequestId: pendingAction.id }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to cancel request");
      }

      await fetchStatus();
      toast.success("Request cancelled");
    } catch (error) {
      // console.error("Failed to cancel request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cancel request");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      await onPauseToggle();
      toast.success(isPaused ? 'Resume request created' : 'Pause request created');
    } catch (error) {
      // console.error('Error toggling system pause:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to toggle system state');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusText = () => {
    if (isPaused) {
      if (hasPendingResume) return "System is Paused (Resume Requested)";
      return "System is Paused";
    }
    if (hasPendingPause) return "System is Active (Pause Requested)";
    return "System is Active";
  };

  const hasPendingAction = hasPendingPause || hasPendingResume;

  return (
    <div className="bg-base-200 rounded-lg p-4 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${hasPendingAction ? 'bg-warning' : isPaused ? 'bg-error' : 'bg-success'}`} />
            <span className="font-medium">{getStatusText()}</span>
          </div>
          {canApprove && (
            <button
              type="button"
              onClick={handleApprovePause}
              className="btn btn-success btn-sm gap-2"
            >
              <FaCheck className="w-3 h-3" />
              Approve
            </button>
          )}
        </div>
        {isRequester && pendingAction ? (
          <button
            type="button"
            onClick={handleCancelPause}
            className="btn btn-error btn-sm gap-2"
            disabled={isCancelling}
          >
            {isCancelling ? (
              <FaSpinner className="animate-spin w-3 h-3" />
            ) : (
              <FaXmark className="w-3 h-3" />
            )}
            Cancel
          </button>
        ) : (
          <div className="form-control">
            <label className="cursor-pointer relative">
              <input
                type="checkbox"
                className={`toggle ${hasPendingAction ? 'toggle-warning' : (isPaused ? 'toggle-error' : 'toggle-success')} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                checked={!isPaused}
                onChange={handleToggle}
                disabled={hasPendingAction || isLoading}
              />
              {isLoading && (
                <FaSpinner className="animate-spin w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 -translate-x-[200%] text-base-content/70" />
              )}
            </label>
          </div>
        )}
      </div>
    </div>
  );
}; 
import { useSession } from "next-auth/react";
import { FaCheck, FaXmark, FaSpinner } from "react-icons/fa6";
import { toast } from "react-hot-toast";
import { useSystemStatus } from "@/contexts/SystemStatusContext";
import { useState } from "react";

interface SystemStatusProps {
  isPaused: boolean;
  hasPendingPause: boolean;
  onPauseToggle: () => Promise<void>;
}

export const SystemStatus = ({ isPaused, hasPendingPause, onPauseToggle }: SystemStatusProps) => {
  const { data: session } = useSession();
  const { statusData, fetchStatus } = useSystemStatus();
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const pendingPause = statusData?.systemRequests?.find(req => 
    req.status === 'PENDING' && 
    req.action === 'PAUSE'
  );

  const isRequester = pendingPause?.requester.email === session?.user?.email;
  const canApprove = pendingPause && !isRequester && 
    !pendingPause.approvals.some(approval => approval.approver.email === session?.user?.email);

  const handleApprovePause = async () => {
    if (!pendingPause) return;
    
    try {
      const response = await fetch("/api/approvePause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionRequestId: pendingPause.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve pause request");
      }

      await fetchStatus();
      toast.success("Pause request approved");
    } catch (error) {
      console.error("Failed to approve pause request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to approve pause request");
    }
  };

  const handleCancelPause = async () => {
    if (!pendingPause) return;
    
    setIsCancelling(true);
    try {
      const response = await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionRequestId: pendingPause.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel pause request");
      }

      await fetchStatus();
      toast.success("Pause request cancelled");
    } catch (error) {
      console.error("Failed to cancel pause request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cancel pause request");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      await onPauseToggle();
      toast.success(isPaused ? 'System resumed successfully' : 'Pause request created');
    } catch (error) {
      console.error('Error toggling system pause:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to toggle system pause');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-base-200 rounded-lg p-4 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${hasPendingPause ? 'bg-warning' : isPaused ? 'bg-error' : 'bg-success'}`} />
            <span className="font-medium">
              System is {isPaused ? 'Paused' : 'Active'}
              {hasPendingPause && ' (Pause Requested)'}
            </span>
          </div>
          {canApprove && (
            <button
              onClick={handleApprovePause}
              className="btn btn-success btn-sm gap-2"
            >
              <FaCheck className="w-3 h-3" />
              Approve
            </button>
          )}
        </div>
        {isRequester && pendingPause ? (
          <button
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
                className={`toggle ${hasPendingPause ? 'toggle-warning' : (isPaused ? 'toggle-error' : 'toggle-success')} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                checked={!isPaused}
                onChange={handleToggle}
                disabled={hasPendingPause || isLoading}
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
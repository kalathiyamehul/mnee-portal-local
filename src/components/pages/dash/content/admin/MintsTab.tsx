"use client";

import { FaCoins } from "react-icons/fa6";
import { MintTable } from "./MintTable";
import { useSystemStatus } from "@/contexts/SystemStatusContext";
import { ExportButtons } from "@/components/common/ExportButtons";
import { toToken } from "satoshi-token";
import { Config } from "@prisma/client";
import { DEFAULT_DECIMALS } from "@/lib/constants";

interface MintsTabProps {
  showModal: (id: string) => void;
  hasCreateMintPer?: boolean;
  config: Config | null;
  hasApproveMintPer?: boolean;
  hasRejectMintPer?: boolean;
}

export const MintsTab = ({
  showModal,
  config,
  hasCreateMintPer,
  hasApproveMintPer,
  hasRejectMintPer,
}: MintsTabProps) => {
  const { statusData, initialLoading } = useSystemStatus();
  const mintRequests = statusData?.mintRequests || [];
  //   console.log("Permissions: ", hasApproveMintPer, hasRejectMintPer, hasCreateMintPer)

  // Helper to format data for export
  const exportApprovedData = mintRequests
    .filter((request) => request.status === "DONE")
    .map((request) => ({
      Amount: `${toToken(
        (request?.amount ?? "0").toString(),
        config?.decimals || DEFAULT_DECIMALS
      )} MNEE`,
      Requested_by: request?.requester?.name || request?.requester?.email,
      Customers: request.customer?.name || request.customer?.address,
      Approver: request.approvals?.map((a) => a.approver?.email).join(", "),
      Status: "APPROVED",
      Created: new Date(request.createdAt).toLocaleString(),
    }));

  if (initialLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Mint Requests</h2>
        <div className="space-x-5">
          <ExportButtons
            data={exportApprovedData}
            buttonLabel="Export Approved Mints"
            filename={`Approved-Mint`}
            className="mb-4"
          />
          {hasCreateMintPer && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => showModal("mint_modal")}
            >
              <FaCoins className="mr-1" />
              <span>Mint</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-8">
        <MintTable
          mints={mintRequests}
          mode="active"
          onUpdate={() => {}} // SystemStatusContext handles updates automatically
          showActions={hasApproveMintPer && hasRejectMintPer}
          hasApproveMintPer={hasApproveMintPer}
          hasRejectMintPer={hasRejectMintPer}
          enablePagination={true}
          itemsPerPage={6}
        />

        <MintTable
          title="Request History"
          mints={mintRequests}
          mode="history"
          onUpdate={() => {}}
          alwaysShow={true}
          showActions={false}
          enablePagination={true}
          itemsPerPage={6}
        />
      </div>
    </div>
  );
};

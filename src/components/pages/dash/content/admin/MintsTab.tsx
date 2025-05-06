"use client";

import { FaCoins } from "react-icons/fa6";
import { MintTable } from "./MintTable";
import { useSystemStatus } from "@/contexts/SystemStatusContext";

interface MintsTabProps {
  showModal: (id: string) => void;
  hasCreateMintPer?: boolean;
  hasApproveMintPer?: boolean;
  hasRejectMintPer?: boolean;
}

export const MintsTab = ({ showModal, hasCreateMintPer, hasApproveMintPer, hasRejectMintPer }: MintsTabProps) => {
  const { statusData, initialLoading } = useSystemStatus();
  const mintRequests = statusData?.mintRequests || [];
//   console.log("Permissions: ", hasApproveMintPer, hasRejectMintPer, hasCreateMintPer)

  if (initialLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Mint Requests</h2>
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

      <div className="space-y-8">
        <MintTable
          mints={mintRequests}
          mode="active"
          onUpdate={() => {}} // SystemStatusContext handles updates automatically
          showActions={true}
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

"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { FaArrowLeft, FaEdit } from "react-icons/fa";
import { MdOutlineOpenInNew } from "react-icons/md";
import { CustomerModal } from "../modals/CustomerModal";
import { toToken } from "satoshi-token";
import { useBalance } from "@/contexts/BalanceContext";
import { getConfig } from "@/lib/config";
import { Config } from "@prisma/client";
import { getGravatarUrl } from "@/utils/gravatar";

interface CustomerActivity {
  customer: {
    id: string;
    name: string;
    email: string;
    address: string;
    createdAt: string;
    creator: {
      name: string | null;
      email: string;
    };
  };
  activity: {
    mints: Array<{
      id: string;
      amount: string;
      status: string;
      createdAt: string;
      txid: string | null;
      address: string;
      requester: {
        name: string | null;
        email: string;
      };
    }>;
    burns: Array<{
      id: string;
      amount: string;
      status: string;
      createdAt: string;
      txid: string | null;
      refundAddress: string;
      requester: {
        name: string | null;
        email: string;
      };
    }>;
  };
}

export default function CustomerViewContent({ initialData }: { initialData: CustomerActivity }) {
  const router = useRouter();
  const { balances } = useBalance();
  const [data] = useState<CustomerActivity>(initialData);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'mints' | 'burns'>('mints');
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configData = await getConfig();
        setConfig(configData);
      } catch (error) {
        console.error('Error loading config:', error);
        toast.error('Failed to load configuration');
      }
    };

    loadConfig();
  }, []);

  if (!config) {
    return (
      <div className="flex justify-center items-center min-h-screen animate-fade-in">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  const { customer, activity } = data;

  return (
    <div className="px-8 p-4 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="btn btn-ghost btn-sm"
        >
          <FaArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-bold">Customer Details</h1>
      </div>

      {/* Customer Info Card */}
      <div className="bg-base-200 p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="avatar">
              <div className="mask mask-squircle w-16 h-16">
                <img
                  src={getGravatarUrl(customer.email)}
                  alt="Customer avatar"
                />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold">{customer.name}</h2>
              <p className="text-base-content/70">{customer.email}</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-ghost btn-sm gap-2"
          >
            <FaEdit className="w-4 h-4" />
            Edit
          </button>
        </div>

        <div className="divider"></div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <div className="text-sm text-base-content/70">Address</div>
            <div className="flex items-center gap-2">
              <div className="font-mono text-sm">
                {customer.address}
              </div>
              <a
                href={`https://whatsonchain.com/address/${customer.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-xs btn-square"
                title="View on WhatsOnChain"
              >
                <MdOutlineOpenInNew className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-base-content/70">Balance</div>
            <div className="font-mono text-sm">
              {balances ? 
                `${toToken((balances[customer.address] || 0).toString(), config.decimals)} MNEE` :
                <span className="loading loading-spinner loading-xs"></span>
              }
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-base-content/70">Created By</div>
            <div className="flex items-center gap-2">
              <div className="avatar">
                <div className="mask mask-squircle w-6 h-6">
                  <img
                    src={getGravatarUrl(customer.creator.email)}
                    alt="Creator avatar"
                  />
                </div>
              </div>
              <span className="text-sm">{customer.creator.email}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-base-content/70">Created</div>
            <div className="text-sm">
              {formatDistanceToNow(new Date(customer.createdAt), { addSuffix: true })}
            </div>
          </div>
        </div>
      </div>

      {/* Activity Tabs */}
      <div className="space-y-4">
        <div className="tabs tabs-boxed">
          <button
            className={`tab ${activeTab === 'mints' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('mints')}
          >
            Mints ({activity.mints.length})
          </button>
          <button
            className={`tab ${activeTab === 'burns' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('burns')}
          >
            Burns ({activity.burns.length})
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="text-base-content/70 text-sm border-b border-base-200">
                <th className="bg-base-100">Date</th>
                <th className="bg-base-100">Amount</th>
                <th className="bg-base-100">Status</th>
                <th className="bg-base-100">Requested By</th>
                <th className="bg-base-100 w-[100px]">TXID</th>
              </tr>
            </thead>
            <tbody>
              {activeTab === 'mints' ? (
                activity.mints.map((mint) => (
                  <tr key={mint.id} className="hover border-l-4 border-l-transparent hover:border-l-primary">
                    <td>{formatDistanceToNow(new Date(mint.createdAt), { addSuffix: true })}</td>
                    <td className="font-mono">
                      {toToken(mint.amount.toString(), config.decimals)} MNEE
                    </td>
                    <td>
                      <div className={`badge ${
                        mint.status === 'APPROVED' ? 'badge-success' :
                        mint.status === 'PENDING' ? 'badge-warning' :
                        'badge-error'
                      }`}>
                        {mint.status}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="avatar">
                          <div className="mask mask-squircle w-6 h-6">
                            <img
                              src={getGravatarUrl(mint.requester.email)}
                              alt="Requester avatar"
                            />
                          </div>
                        </div>
                        <span className="text-sm">{mint.requester.email}</span>
                      </div>
                    </td>
                    <td>
                      {mint.txid && (
                        <a
                          href={`https://whatsonchain.com/tx/${mint.txid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-hover font-mono text-xs"
                        >
                          {mint.txid.slice(0, 8)}...{mint.txid.slice(-8)}
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                activity.burns.map((burn) => (
                  <tr key={burn.id} className="hover border-l-4 border-l-transparent hover:border-l-primary">
                    <td>{formatDistanceToNow(new Date(burn.createdAt), { addSuffix: true })}</td>
                    <td className="font-mono">
                      {toToken(burn.amount.toString(), config.decimals)} MNEE
                    </td>
                    <td>
                      <div className={`badge ${
                        burn.status === 'APPROVED' ? 'badge-success' :
                        burn.status === 'PENDING' ? 'badge-warning' :
                        'badge-error'
                      }`}>
                        {burn.status}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="avatar">
                          <div className="mask mask-squircle w-6 h-6">
                            <img
                              src={getGravatarUrl(burn.requester.email)}
                              alt="Requester avatar"
                            />
                          </div>
                        </div>
                        <span className="text-sm">{burn.requester.email}</span>
                      </div>
                    </td>
                    <td>
                      {burn.txid && (
                        <a
                          href={`https://whatsonchain.com/tx/${burn.txid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-hover font-mono text-xs"
                        >
                          {burn.txid.slice(0, 8)}...{burn.txid.slice(-8)}
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
              {((activeTab === 'mints' && activity.mints.length === 0) ||
                (activeTab === 'burns' && activity.burns.length === 0)) && (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-base-content/70">
                    No {activeTab} found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <CustomerModal
          customer={customer}
          onClose={() => setShowModal(false)}
          onSuccess={async () => {
            setShowModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
} 
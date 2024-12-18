"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerModal } from '../modals/CustomerModal';
import { formatDistanceToNow } from 'date-fns';
import { FaUserPlus, FaEdit } from 'react-icons/fa';
import { MdOutlineOpenInNew } from 'react-icons/md';
import { useCustomer } from '@/contexts/CustomerContext';
import { useBalance } from '@/contexts/BalanceContext';
import { getGravatarUrl } from '@/utils/gravatar';
import { getConfig } from '@/lib/config';
import { toToken } from 'satoshi-token';
import { Config, Customer } from '@prisma/client';
import { FetchStatus } from '@/types/common';

export default function DashboardCustomersContent() {
  const router = useRouter();
  const { customers, loading, error, fetchCustomers } = useCustomer();
  const { balances, fetchBalances, fetchStatus } = useBalance();
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const configData = await getConfig();
        setConfig(configData);
      } catch (error) {
        console.error('Error loading config:', error);
      }
    };
    init();
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (customers?.length && fetchStatus === FetchStatus.IDLE) {
      const addresses = customers.map(c => c.address);
      fetchBalances(addresses);
    }
  }, [customers, fetchBalances, fetchStatus]);

  if (loading || !config) {
    return (
      <div className="flex justify-center items-center min-h-screen animate-fade-in">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="alert alert-error">{error.message}</div>
      </div>
    );
  }

  const handleEdit = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomer(customer);
    setShowModal(true);
  };

  return (
    <div className="p-4 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Customers</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary btn-sm gap-2"
        >
          <FaUserPlus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr className="text-base-content/70 text-sm border-b border-base-200">
              <th className="bg-base-100">Customer</th>
              <th className="bg-base-100">MNEE Address</th>
              <th className="bg-base-100">Created By</th>
              <th className="bg-base-100 w-[180px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((customer) => (
              <tr
                key={customer.id}
                className="hover border-l-4 border-l-transparent hover:border-l-primary cursor-pointer"
                onClick={() => router.push(`/dash/customers/${customer.id}`)}
              >
                <td>
                  <div className="flex items-center gap-3">
                    <div className="avatar">
                      <div className="mask mask-squircle w-10 h-10">
                        <img
                          src={getGravatarUrl(customer.email)}
                          alt="Customer avatar"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-base-content/70">{customer.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm">
                        {customer.address}
                      </div>
                      <a
                        href={`https://whatsonchain.com/address/${customer.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs btn-square"
                        onClick={(e) => e.stopPropagation()}
                        title="View on WhatsOnChain"
                      >
                        <MdOutlineOpenInNew className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-sm text-base-content/70">
                      Balance: {balances[customer.address] !== undefined ? (
                        `${toToken(balances[customer.address].toString(), config.decimals)} MNEE`
                      ) : (
                        <span className="loading loading-spinner loading-xs"></span>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="avatar">
                      <div className="mask mask-squircle w-10 h-10">
                        <img
                          src={getGravatarUrl(customer.creator.email)}
                          alt="Creator avatar"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">{customer.creator.email}</div>
                      <div className="text-sm text-base-content/70">
                        {formatDistanceToNow(new Date(customer.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit({
                          id: customer.id,
                          name: customer.name,
                          email: customer.email,
                          address: customer.address,
                          createdBy: customer.creator.email,
                          createdAt: new Date(customer.createdAt),
                          updatedAt: new Date(customer.createdAt)
                        }, e);
                      }}
                      className="btn btn-ghost btn-sm gap-2"
                      title="Edit customer"
                    >
                      <FaEdit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dash/customers/${customer.id}`);
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!customers?.length && (
              <tr>
                <td colSpan={4} className="text-center py-4 text-base-content/70">
                  No customers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CustomerModal
          customer={selectedCustomer || undefined}
          onClose={() => {
            setShowModal(false);
            setSelectedCustomer(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setSelectedCustomer(null);
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
} 
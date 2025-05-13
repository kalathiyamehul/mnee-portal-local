"use client";

// biome-ignore lint/style/useImportType: <explanation>
import { createContext, useContext, useCallback, useState, ReactNode, useMemo } from 'react';
import { toast } from 'react-hot-toast';

interface Customer {
  id: string;
  name: string;
  email: string;
  address: string;
  noOfApproval: number;
  createdAt: string;
  creator: {
    name: string | null;
    email: string;
  };
}

interface PaginatedResponse {
  customers: Customer[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface CustomerContextType {
  customers: Customer[] | null;
  loading: boolean;
  error: Error | null;
  fetchCustomers: (page?: number, limit?: number) => Promise<void>;
  getCustomer: (id: string) => Promise<Customer>;
  createCustomer: (data: {
    name: string;
    email: string;
    address: string;
  }) => Promise<Customer>;
  updateCustomer: (
    id: string,
    data: { name: string; email: string; address: string }
  ) => Promise<Customer>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const CustomerContext = createContext<CustomerContextType | null>(null);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 6,
    totalPages: 1,
  });

  const fetchCustomers = useCallback(async (page = 1, limit = 6) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/customers?page=${page}&limit=${limit}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch customers");
      }
      const data: PaginatedResponse = await response.json();
      setCustomers(data.customers);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      toast.error("Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  }, []);

  const getCustomer = useCallback(
    async (id: string) => {
      const cachedCustomer = customers?.find((c) => c.id === id);
      if (cachedCustomer) return cachedCustomer;

      const response = await fetch(`/api/customers/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch customer");
      }
      const data = await response.json();
      return data.customer;
    },
    [customers]
  );

  const createCustomer = useCallback(
    async (data: { name: string; email: string; address: string }) => {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to create customer");
      }

      const newCustomer = await response.json();
      // Refresh the current page after creating a new customer
      await fetchCustomers(pagination.page, pagination.limit);
      return newCustomer;
    },
    [fetchCustomers, pagination.page, pagination.limit]
  );

  const updateCustomer = useCallback(
    async (
      id: string,
      data: { name: string; email: string; address: string }
    ) => {
      const response = await fetch(`/api/customers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to update customer");
      }

      const updatedCustomer = await response.json();
      // Refresh the current page after updating a customer
      await fetchCustomers(pagination.page, pagination.limit);
      return updatedCustomer;
    },
    [fetchCustomers, pagination.page, pagination.limit]
  );

  const value = useMemo(
    () => ({
      customers,
      loading,
      error,
      fetchCustomers,
      getCustomer,
      createCustomer,
      updateCustomer,
      pagination,
    }),
    [
      customers,
      loading,
      error,
      fetchCustomers,
      getCustomer,
      createCustomer,
      updateCustomer,
      pagination,
    ]
  );

  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
} 
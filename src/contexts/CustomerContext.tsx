"use client";

// biome-ignore lint/style/useImportType: <explanation>
import { createContext, useContext, useCallback, useState, ReactNode, useMemo } from 'react';
import { toast } from 'react-hot-toast';

interface Customer {
  id: string;
  name: string;
  email: string;
  address: string;
  createdAt: string;
  creator: {
    name: string | null;
    email: string;
  };
}

interface CustomerContextType {
  customers: Customer[] | null;
  loading: boolean;
  error: Error | null;
  fetchCustomers: () => Promise<void>;
  getCustomer: (id: string) => Promise<Customer>;
  createCustomer: (data: { name: string; email: string; address: string }) => Promise<Customer>;
  updateCustomer: (id: string, data: { name: string; email: string; address: string }) => Promise<Customer>;
}

const CustomerContext = createContext<CustomerContextType | null>(null);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/customers');
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      const data = await response.json();
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, []);

  const getCustomer = useCallback(async (id: string) => {
    const cachedCustomer = customers?.find(c => c.id === id);
    if (cachedCustomer) return cachedCustomer;

    const response = await fetch(`/api/customers/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch customer');
    }
    const data = await response.json();
    return data.customer;
  }, [customers]);

  const createCustomer = useCallback(async (data: { name: string; email: string; address: string }) => {
    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to create customer');
    }

    const newCustomer = await response.json();
    setCustomers(prev => prev ? [...prev, newCustomer] : [newCustomer]);
    return newCustomer;
  }, []);

  const updateCustomer = useCallback(async (id: string, data: { name: string; email: string; address: string }) => {
    const response = await fetch(`/api/customers/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to update customer');
    }

    const updatedCustomer = await response.json();
    setCustomers(prev => 
      prev ? prev.map(c => c.id === id ? updatedCustomer : c) : [updatedCustomer]
    );
    return updatedCustomer;
  }, []);

  const value = useMemo(() => ({
    customers,
    loading,
    error,
    fetchCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
  }), [customers, loading, error, fetchCustomers, getCustomer, createCustomer, updateCustomer]);
  
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
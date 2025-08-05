"use client";

import CustomToast from '@/components/common/CustomToast';
import { apiFetch } from '@/utils/api';
import {
  sanitizeError,
  sanitizeHttpError,
  getDisplayMessage,
} from "@/utils/errorHandler";
// biome-ignore lint/style/useImportType: <explanation>
import {
  createContext,
  useContext,
  useCallback,
  useState,
  ReactNode,
  useMemo,
  useEffect,
} from "react";
import { EVENTS } from "@/lib/sseEmitter";

interface Customer {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  noOfApprovals: number;
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
    address: string;
  }) => Promise<Customer>;
  updateCustomer: (
    id: string,
    data: { name: string; address: string }
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
        const sanitizedError = await sanitizeHttpError(
          response,
          "Failed to fetch customers"
        );
        const error = new Error(sanitizedError.message);
        setError(error);
        CustomToast.error(getDisplayMessage(sanitizedError));
        return;
      }
      const data: PaginatedResponse = await response.json();
      setCustomers(data.customers);
      setPagination(data.pagination);
    } catch (err) {
      const sanitizedError = sanitizeError(err, "Failed to fetch customers");
      const error = new Error(sanitizedError.message);
      setError(error);
      CustomToast.error(getDisplayMessage(sanitizedError));
    } finally {
      setLoading(false);
    }
  }, []);

    // Add this SSE effect to listen for real-time updates
    useEffect(() => {
      // Create SSE connection
      const eventSource = new EventSource("/api/sse");
  
      // Connection established
      eventSource.onopen = () => {
        // console.log("SSE connection established"); 
      };

      const handleCustomerUpdate = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const { type } = data;
          if (type === "APPROVED") {
            fetchCustomers(pagination.page, pagination.limit);
          }
        } catch (error) {
          // console.error("Error handling SSE event:", error);
        }
      };

      eventSource.addEventListener(EVENTS.CUSTOMER_UPDATE, handleCustomerUpdate);
  
      // Handle errors
      eventSource.onerror = (error) => {
        // console.error("SSE connection error:", error);
        eventSource.close();
      };
  
      // Clean up on unmount
      return () => {
        // console.log("Closing SSE connection");
        eventSource.removeEventListener(EVENTS.CUSTOMER_UPDATE, handleCustomerUpdate);
        eventSource.close();
      };
    }, [pagination.page, pagination.limit]);

  const getCustomer = useCallback(
    async (id: string) => {
      const cachedCustomer = customers?.find((c) => c.id === id);
      if (cachedCustomer) return cachedCustomer;

      const response = await apiFetch(`/api/customers/${id}`);
      if (!response.ok) {
        const sanitizedError = await sanitizeHttpError(
          response,
          "Failed to fetch customer"
        );
        throw new Error(sanitizedError.message);
      }
      const data = await response.json();
      return data.customer;
    },
    [customers]
  );

  const createCustomer = useCallback(
    async (data: { name: string; address: string }) => {
      const response = await apiFetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const sanitizedError = await sanitizeHttpError(
          response,
          "Failed to create customer"
        );
        throw new Error(sanitizedError.message);
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
      data: { name: string; address: string }
    ) => {
      const response = await apiFetch(`/api/customers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const sanitizedError = await sanitizeHttpError(
          response,
          "Failed to update customer"
        );
        throw new Error(sanitizedError.message);
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
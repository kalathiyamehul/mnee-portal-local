import { apiFetch } from "@/utils/api";
import type { Config } from "@prisma/client";
import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { toToken, toTokenSat } from "satoshi-token";

interface Threshold {
  id: string;
  name: string;
  value: number;
}

interface FeeItem {
  fee: number | string;
  max: number | string;
  min: number | string;
}

interface ValidationErrors {
  [key: number]: {
    fee?: string;
    max?: string;
    min?: string;
  };
}

const ConfigureTab = () => {
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<Threshold | null>(
    null
  );
  const [editingFee, setEditingFee] = useState<boolean>(false);
  const [items, setItems] = useState<FeeItem[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [config, setConfig] = useState<Config>();
  const [thresholdError, setThresholdError] = useState<string>("");

  // Int4 range constants
  const INT4_MIN = 1; // Minimum positive value for thresholds
  const INT4_MAX = 2147483647; // Maximum int4 value

  // Enhanced validation with sequential range checking
  const validateAllItems = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    items.forEach((item, index) => {
      const itemErrors: { fee?: string; max?: string; min?: string } = {};
      const previousItem = index > 0 ? items[index - 1] : null;

      // Convert string values to numbers for validation
      const feeValue = typeof item.fee === 'string' ? (item.fee === '' ? NaN : parseFloat(item.fee)) : item.fee;
      const maxValue = typeof item.max === 'string' ? (item.max === '' ? NaN : parseFloat(item.max)) : item.max;
      const minValue = typeof item.min === 'string' ? (item.min === '' ? NaN : parseFloat(item.min)) : item.min;
      const prevFeeValue = previousItem ? (typeof previousItem.fee === 'string' ? (previousItem.fee === '' ? NaN : parseFloat(previousItem.fee)) : previousItem.fee) : NaN;
      const prevMaxValue = previousItem ? (typeof previousItem.max === 'string' ? (previousItem.max === '' ? NaN : parseFloat(previousItem.max)) : previousItem.max) : NaN;

      // Check for empty fields
      if (item.fee === '' || isNaN(feeValue)) {
        itemErrors.fee = "Fee is required";
      }
      if (item.max === '' || isNaN(maxValue)) {
        itemErrors.max = "Max is required";
      }
      if (item.min === '' || isNaN(minValue)) {
        itemErrors.min = "Min is required";
      }

      // Basic validations (only if values are valid numbers)
      if (!isNaN(feeValue)) {
        if (feeValue < 0) {
          itemErrors.fee = "Fee must be non-negative";
        }
        if (feeValue > INT4_MAX) {
          itemErrors.fee = `Fee cannot exceed ${INT4_MAX.toLocaleString()} (int4 limit)`;
        }
      }

      if (!isNaN(maxValue)) {
        if (maxValue < 0) {
          itemErrors.max = "Max must be non-negative";
        }
        if (maxValue > Number.MAX_SAFE_INTEGER && maxValue !== Number.MAX_SAFE_INTEGER) {
          itemErrors.max = `Max cannot exceed ${INT4_MAX.toLocaleString()} (int4 limit)`;
        }
      }

      if (!isNaN(minValue)) {
        if (minValue < 0) {
          itemErrors.min = "Min must be non-negative";
        }
        if (minValue > INT4_MAX) {
          itemErrors.min = `Min cannot exceed ${INT4_MAX.toLocaleString()} (int4 limit)`;
        }
      }

      // Validate min <= max for current item (only if both are valid numbers)
      if (!isNaN(minValue) && !isNaN(maxValue) && minValue > maxValue) {
        itemErrors.min = "Min cannot be greater than Max";
      }

      // Sequential range validations (only if we have a previous item and values are valid)
      if (previousItem && !isNaN(feeValue) && !isNaN(prevFeeValue)) {
        // Fee must be greater than previous item's fee
        if (feeValue <= prevFeeValue) {
          itemErrors.fee = `Fee must be greater than ${prevFeeValue} (previous item's fee)`;
        }
      }

      if (previousItem && !isNaN(minValue) && !isNaN(prevMaxValue)) {
        // Min must be greater than previous item's max
        if (minValue <= prevMaxValue) {
          itemErrors.min = `Min must be greater than ${prevMaxValue} (previous item's max)`;
        }
      }

      if (!isNaN(maxValue) && !isNaN(minValue)) {
        // Additional check: current max should be greater than current min
        if (maxValue <= minValue) {
          itemErrors.max = "Max must be greater than Min";
        }
      }

      // For the first item, ensure min starts from 0 (only if value is valid)
      if (index === 0 && !isNaN(minValue) && minValue !== 0) {
        itemErrors.min = "First item's min must be 0";
      }

      // Add validation to ensure no gaps in ranges (only if both values are valid)
      if (previousItem && !isNaN(minValue) && !isNaN(prevMaxValue) && minValue !== prevMaxValue + 1) {
        itemErrors.min = `Min should be ${
          prevMaxValue + 1
        } to maintain sequential range`;
      }

      if (Object.keys(itemErrors).length > 0) {
        newErrors[index] = itemErrors;
      }
    });

    // Additional validation: Check for overlapping ranges
    for (let i = 0; i < items.length - 1; i++) {
      const currentItem = items[i];
      const nextItem = items[i + 1];
      
      const currentMaxValue = typeof currentItem.max === 'string' ? (currentItem.max === '' ? NaN : parseFloat(currentItem.max)) : currentItem.max;
      const nextMinValue = typeof nextItem.min === 'string' ? (nextItem.min === '' ? NaN : parseFloat(nextItem.min)) : nextItem.min;

      if (!isNaN(currentMaxValue) && !isNaN(nextMinValue) && currentMaxValue >= nextMinValue) {
        if (!newErrors[i + 1]) {
          newErrors[i + 1] = {};
        }
        newErrors[
          i + 1
        ].min = `Range overlaps with previous item. Min should be greater than ${currentMaxValue}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [items]);

  // Validate items whenever items change - NOW ALWAYS ACTIVE
  useEffect(() => {
    if (items.length > 0) {
      validateAllItems();
    }
  }, [items, validateAllItems]);

  // Add new item
  const addNewItem = (): void => {
    const lastItem = items[items.length - 1];
    const lastMaxValue = lastItem ? (typeof lastItem.max === 'string' ? parseFloat(lastItem.max) || 0 : lastItem.max) : 0;
    const lastFeeValue = lastItem ? (typeof lastItem.fee === 'string' ? parseFloat(lastItem.fee) || 0 : lastItem.fee) : 0;
    const nextMax = lastItem ? lastMaxValue + 1000 : 1000;
    const newItem: FeeItem = {
      fee: lastItem ? lastFeeValue + 1 : 0,
      max: Math.min(nextMax, Number.MAX_SAFE_INTEGER),
      min: lastItem ? lastMaxValue + 1 : 0,
    };
    setItems([...items, newItem]);
  };

  // Remove item
  const removeItem = (index: number): void => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
      // Remove errors for this item
      const newErrors = { ...errors };
      delete newErrors[index];
      // Shift error indices down for items after the removed one
      const shiftedErrors: ValidationErrors = {};
      Object.entries(newErrors).forEach(([idx, error]) => {
        const numIdx = parseInt(idx);
        if (numIdx < index) {
          shiftedErrors[numIdx] = error;
        } else if (numIdx > index) {
          shiftedErrors[numIdx - 1] = error;
        }
      });
      setErrors(shiftedErrors);
    }
  };

  // Update item field with immediate validation
  const updateItem = (
    index: number,
    field: keyof FeeItem,
    value: string
  ): void => {
    // Handle empty string case - allow empty values
    if (value === '') {
      const newItems = [...items];
      newItems[index] = { ...newItems[index], [field]: '' };
      setItems(newItems);
      return;
    }
    
    const numericValue = parseFloat(value);
    
    // Check if the value is a valid number
    if (isNaN(numericValue)) {
      return; // Don't update if not a valid number
    }
    
    // Validate int4 range for fee and min fields (max can be infinity)
    if ((field === 'fee' || field === 'min') && !isNaN(numericValue) && numericValue > INT4_MAX) {
      return; // Don't update if outside int4 range
    }
    
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: numericValue };
    setItems(newItems);
    // Note: Validation will trigger automatically via useEffect
  };

  const fetchConfig = async () => {
    try {
      const response = await apiFetch("/api/config/database");
      if (!response.ok) {
        throw new Error("Failed to fetch configuration");
      }
      const config = await response.json();
      setConfig(config);
      setThresholds([
        {
          id: "1",
          name: "Minimum Approvals",
          value: config.minNoOfApproval,
        },
        { id: "2", name: "Maximum Approvals", value: config.maxNoOfApproval },
      ]);
      // Initialize items with fee structure from config
      setItems([...config.fees]);
    } catch (error) {
      // console.error("Error fetching config:", error);
      toast.error("Failed to load threshold settings");
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial config data
  useEffect(() => {
    fetchConfig();
  }, []);

  const handleUpdateThreshold = async () => {
    if (!editingThreshold) return;

    try {
      const response = await apiFetch("/api/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          minNoOfApproval:
            editingThreshold.id === "1" ? editingThreshold.value : undefined,
          maxNoOfApproval:
            editingThreshold.id === "2" ? editingThreshold.value : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update threshold");
      }

      setThresholds((prev) =>
        prev.map((t) => (t.id === editingThreshold.id ? editingThreshold : t))
      );
      toast.success("Threshold updated successfully");
      setIsEditing(false);
    } catch (error) {
      // console.error("Error updating threshold:", error);
      toast.error("Failed to update threshold");
    }
  };

  const handlefeeSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    // Final validation before submit (this should always pass now since validation is live)
    if (!validateAllItems()) {
      setIsSubmitting(false);
      toast.error("Please fix validation errors before submitting");
      return;
    }

    try {
      // Convert string values back to numbers for API submission
      const numericItems = items.map(item => ({
        fee: typeof item.fee === 'string' ? parseFloat(item.fee) || 0 : item.fee,
        max: typeof item.max === 'string' ? parseFloat(item.max) || 0 : item.max,
        min: typeof item.min === 'string' ? parseFloat(item.min) || 0 : item.min,
      }));

      const response = await apiFetch("/api/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          feeStructure: numericItems,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update fee structure");
      }

      setEditingFee(false);
      toast.success("Fee structure updated successfully");
    } catch (error) {
      // console.error("Error updating fee structure:", error);
      toast.error("Failed to update fee structure");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if there are any validation errors
  const hasValidationErrors = Object.keys(errors).length > 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Threshold Configuration</h1>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Threshold Name</th>
              <th>Current Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {thresholds.map((threshold) => (
              <tr key={threshold.id}>
                <td className="font-medium">{threshold.name}</td>
                <td>{threshold.value} approvals required</td>
                <td>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEditingThreshold(threshold);
                      setIsEditing(true);
                      setThresholdError(""); // Clear any previous errors
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fee Structure Configuration */}
      <div className="flex justify-between items-center mt-14 mb-4">
        <h1 className="text-2xl font-bold">Fee Structure Configuration</h1>
        {editingFee ? (
          <div className="flex items-center space-x-4">
            <div
              className="tooltip tooltip-top tooltip-error"
              data-tip={`${
                items[items.length - 1].max === Number.MAX_SAFE_INTEGER
                  ? "Cannot add more fees if the last fee's max is set to Infinity"
                  : ""
              }`}
            >
              <button
                onClick={addNewItem}
                className="btn btn-primary btn-sm"
                disabled={
                  isSubmitting ||
                  items[items.length - 1].max === Number.MAX_SAFE_INTEGER
                }
                type="button"
              >
                Add New Fee
              </button>
            </div>
            <button
              onClick={() => {
                setEditingFee(false);
                fetchConfig();
                setErrors({});
              }}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>

            <button
              onClick={handlefeeSubmit}
              className={`btn btn-success btn-sm ${
                isSubmitting ? "loading" : ""
              } ${hasValidationErrors ? "btn-disabled" : ""}`}
              type="button"
              disabled={isSubmitting || hasValidationErrors}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingFee(true)}
            className="btn btn-primary btn-sm"
            type="button"
          >
            Edit
          </button>
        )}
      </div>

      {/* Validation Summary - NOW SHOWS LIVE ERRORS */}
      {hasValidationErrors && (
        <div className="alert alert-error mb-4">
          <div>
            <h3 className="font-bold">Validation Errors:</h3>
            <p className="text-sm">Please fix the following errors:</p>
            <ul className="list-disc list-inside text-sm mt-2">
              {Object.entries(errors).map(([index, fieldErrors]) => (
                <li key={index}>
                  Row {parseInt(index) + 1}:{" "}
                  {Object.values(fieldErrors).join(", ")}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="overflow-x-auto space-y-4">
        <table className="table">
          <thead>
            <tr>
              <th>Fee</th>
              <th>Min Amount</th>
              <th>Max Amount</th>
              {editingFee && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="p-3">
                {/* Fee Field */}
                <td className="align-top">
                  {editingFee ? (
                    <input
                      type="number"
                      value={item.fee}
                      onChange={(e) => updateItem(index, "fee", e.target.value)}
                      className={`input input-bordered w-full ${
                        errors[index]?.fee &&
                        "border-red-500 focus:ring-red-500"
                      }`}
                      placeholder="Fee amount"
                      min="0"
                      max={INT4_MAX}
                    />
                  ) : (
                    <p>{toToken(typeof item?.fee === 'string' ? parseFloat(item.fee) || 0 : item?.fee, config?.decimals ?? 0)} MNEE</p>
                  )}
                  {errors[index]?.fee && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[index].fee}
                    </p>
                  )}
                </td>

                {/* Min Field */}
                <td className="align-top">
                  {editingFee ? (
                    <input
                      type="number"
                      value={item.min}
                      onChange={(e) => updateItem(index, "min", e.target.value)}
                      className={`input input-bordered w-full ${
                        errors[index]?.min &&
                        "border-red-500 focus:ring-red-500"
                      }`}
                      placeholder="Minimum"
                      min="0"
                      max={INT4_MAX}
                    />
                  ) : (
                    <p>{toToken(typeof item?.min === 'string' ? parseFloat(item.min) || 0 : item?.min, config?.decimals ?? 0)} MNEE</p>
                  )}
                  {errors[index]?.min && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[index].min}
                    </p>
                  )}
                </td>

                {/* Max Field */}
                <td className="align-top">
                  {editingFee ? (
                    <input
                      type="number"
                      value={item.max}
                      max={Number.MAX_SAFE_INTEGER}
                      onChange={(e) => {
                        updateItem(index, "max", e.target.value);
                      }}
                      className={`input input-bordered w-full ${
                        errors[index]?.max &&
                        "border-red-500 focus:ring-red-500"
                      }`}
                      placeholder="Maximum"
                      min="0"
                    />
                  ) : (
                    <p>
                      {(typeof item?.max === 'number' ? item.max : parseFloat(item.max) || 0) === Number.MAX_SAFE_INTEGER
                        ? "∞"
                        : `${toToken(typeof item?.max === 'string' ? parseFloat(item.max) || 0 : item.max, config?.decimals ?? 0)} MNEE`}
                    </p>
                  )}
                  {errors[index]?.max && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[index].max}
                    </p>
                  )}
                </td>
                {editingFee && items.length > 1 && (
                  <td className="align-top">
                    <button
                      onClick={() => removeItem(index)}
                      className="btn btn-sm btn-error"
                      type="button"
                      aria-label={`Remove item ${index + 1}`}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isEditing && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Edit Threshold</h3>
            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Required Approvals</span>
              </label>
              <input
                type="number"
                min="1"
                max={INT4_MAX}
                step="1"
                className="input input-bordered w-full"
                value={editingThreshold?.value}
                onKeyDown={(e) => {
                  if (e.key === "." || e.key === ",") {
                    e.preventDefault(); // Prevents typing decimal point or comma
                  }
                }}
                onChange={(e) => {
                  const inputValue = Number(e.target.value);
                  
                  // Clear previous error
                  setThresholdError("");
                  
                  // Validate int4 range first
                  if (inputValue < INT4_MIN) {
                    setThresholdError(`Value must be at least ${INT4_MIN}`);
                    return;
                  }
                  if (inputValue > INT4_MAX) {
                    setThresholdError(`Value cannot exceed ${INT4_MAX.toLocaleString()} (int4 limit)`);
                    return;
                  }
                  
                  setEditingThreshold((prev) =>
                    prev
                      ? {
                          ...prev,
                          value: Math.max(
                            editingThreshold?.id === "1"
                              ? 2 // Absolute minimum for min approvals
                              : editingThreshold?.id === "2"
                              ? (thresholds.find((t) => t.id === "1")?.value ??
                                  2) + 1 // Min = threshold1 + 1
                              : 2,
                            Math.min(
                              editingThreshold?.id === "1"
                                ? Math.min(
                                    (thresholds.find((t) => t.id === "2")
                                      ?.value ?? INT4_MAX) - 1, // Max = threshold2 - 1
                                    INT4_MAX
                                  )
                                : INT4_MAX,
                              inputValue
                            )
                          ),
                        }
                      : null
                  );
                }}
              />
              {thresholdError && (
                <p className="text-red-500 text-sm mt-1">{thresholdError}</p>
              )}
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => {
                setIsEditing(false);
                setThresholdError(""); // Clear errors when canceling
              }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpdateThreshold}
                disabled={!!thresholdError}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigureTab;
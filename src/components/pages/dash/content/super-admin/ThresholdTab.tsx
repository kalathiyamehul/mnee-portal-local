import { apiFetch } from '@/utils/api'
import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

interface Threshold {
  id: string
  name: string
  value: number
}

const ThresholdTab = () => {
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<Threshold | null>(
    null
  );

  // Fetch initial config data
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await apiFetch("/api/config/database");
        if (!response.ok) {
          throw new Error("Failed to fetch configuration");
        }
        const config = await response.json();
        setThresholds([
          {
            id: "1",
            name: "Minimum Approvals",
            value: config.minNoOfApproval,
          },
          { id: "2", name: "Maximum Approvals", value: config.maxNoOfApproval },
        ]);
      } catch (error) {
        // console.error("Error fetching config:", error);
        toast.error("Failed to load threshold settings");
      } finally {
        setLoading(false);
      }
    };
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
                className="input input-bordered w-full"
                value={editingThreshold?.value}
                onChange={(e) =>
                  setEditingThreshold((prev) =>
                    prev ? { ...prev, value: Number(e.target.value) } : null
                  )
                }
              />
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpdateThreshold}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ThresholdTab

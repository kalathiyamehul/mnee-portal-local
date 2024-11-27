'use client';

import { useState, useEffect } from 'react';
import { FaSpinner, FaPlus, FaTrash } from 'react-icons/fa';

interface Fee {
  min: number;
  max: number;
  fee: number;
}

const DashboardSettingsContent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<Fee[]>([]);
  const [newFee, setNewFee] = useState<Fee>({ min: 0, max: 0, fee: 0 });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        setFees(data.fees || []);
      } catch (error) {
        console.error('Error fetching config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleAddFee = () => {
    setFees([...fees, newFee]);
    setNewFee({ min: 0, max: 0, fee: 0 });
  };

  const handleRemoveFee = (index: number) => {
    setFees(fees.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fees }),
      });
    } catch (error) {
      console.error('Error saving config:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <FaSpinner className="animate-spin mx-auto my-12" />;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Fees Configuration */}
      <div className="card bg-base-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Fee Structure</h2>
        
        {/* Existing Fees */}
        <div className="mb-6">
          <h3 className="text-lg mb-2">Current Fees</h3>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Min Amount</th>
                  <th>Max Amount</th>
                  <th>Fee</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee, index) => (
                  <tr key={`${fee.min}-${fee.max}-${index}`}>
                    <td>{fee.min}</td>
                    <td>{fee.max}</td>
                    <td>{fee.fee}</td>
                    <td>
                      <button
                        onClick={() => handleRemoveFee(index)}
                        className="btn btn-ghost btn-sm text-error"
                        aria-label="Remove fee"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add New Fee */}
        <div className="form-control">
          <h3 className="text-lg mb-2">Add New Fee</h3>
          <div className="flex gap-4 items-end">
            <div>
              <label htmlFor="min" className="label">Min Amount</label>
              <input
                id="min"
                type="number"
                className="input input-bordered"
                value={newFee.min}
                onChange={(e) => setNewFee({ ...newFee, min: Number(e.target.value) })}
              />
            </div>
            <div>
              <label htmlFor="max" className="label">Max Amount</label>
              <input
                id="max"
                type="number"
                className="input input-bordered"
                value={newFee.max}
                onChange={(e) => setNewFee({ ...newFee, max: Number(e.target.value) })}
              />
            </div>
            <div>
              <label htmlFor="fee" className="label">Fee</label>
              <input
                id="fee"
                type="number"
                className="input input-bordered"
                value={newFee.fee}
                onChange={(e) => setNewFee({ ...newFee, fee: Number(e.target.value) })}
              />
            </div>
            <button
              onClick={handleAddFee}
              className="btn btn-primary"
              disabled={newFee.min >= newFee.max}
            >
              <FaPlus className="mr-2" /> Add Fee
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6">
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? <FaSpinner className="animate-spin" /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardSettingsContent; 
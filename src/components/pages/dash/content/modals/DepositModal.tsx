import { QRCodeSVG } from 'qrcode.react';
import { FaCopy } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';
import { useEffect } from 'react';

interface DepositModalProps {
  onClose: () => void;
  title: string;
  address: string;
}

export const DepositModal = ({ onClose, title, address }: DepositModalProps) => {
  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard');
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <dialog id="deposit_modal" className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="text-lg font-bold mb-6">{title}</h3>
        <div className="space-y-6">
          <div className="flex justify-center">
            <QRCodeSVG
              value={address}
              size={200}
              level="L"
              includeMargin={true}
              className="bg-white p-2 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2 bg-base-200 p-3 rounded-lg">
            <code className="flex-1 text-xs break-all">{address}</code>
            <button
              onClick={handleCopyAddress}
              className="btn btn-ghost btn-sm"
              title="Copy address"
            >
              <FaCopy />
            </button>
          </div>
          <p className="text-sm opacity-70 text-center">
            Scan the QR code or copy the address above to make your deposit
          </p>
        </div>
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button>close</button>
      </form>
    </dialog>
  );
}; 
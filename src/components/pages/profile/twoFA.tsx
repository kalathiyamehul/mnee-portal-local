"use client";

import CustomToast from "@/components/common/CustomToast";
import { apiFetch } from "@/utils/api";
import { useState, useEffect } from "react";
import { MdClose } from "react-icons/md";

const Button = (props: any) => (
  <button
    className="p-2 rounded-md border border-solid hover:bg-white hover:text-black transition-colors duration-300"
    type="button"
    {...props}
  />
);

// Rename component from Home to TwoFA
export default function TwoFA() {
  const [_2faStatus, set2FAStatus] = useState<
    "enabled" | "disabled" | "initializing"
  >("disabled");
  const [qrData, setQRData] = useState<string>();
  const [qrSecret, setQRSecret] = useState<string>();
  const [userToken, setUserToken] = useState<string>("");
  const [errorText, setErrorText] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  // Check initial 2FA status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await apiFetch("/api/auth/2fa/status");
        const data = await response.json();
        set2FAStatus(data.enabled ? "enabled" : "disabled");
      } catch (error) {
        // console.error("Failed to check 2FA status:", error);
        CustomToast.error("Failed to check 2FA status");
        setErrorText("Failed to check 2FA status");
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
  }, []);

  const handleDisable2FA = async () => {
    try {
      const response = await apiFetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          disable: true,
        }),
      });

      if (response.ok) {
        set2FAStatus("disabled");
        setQRData(undefined);
        setQRSecret(undefined);
        setUserToken("");
        setErrorText(undefined);
      } else {
        setErrorText("Failed to disable 2FA");
      }
    } catch (error) {
      // console.error("Failed to disable 2FA:", error);
      CustomToast.error("Failed to disable 2FA");
      setErrorText("Failed to disable 2FA");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 items-end w-full">
      {!qrData && (
        <div className="flex items-center gap-3">
          <span className="badge badge-lg badge-ghost">Current Status:</span>
          <span
            className={`font-medium ${
              _2faStatus === "enabled" ? "text-success" : "text-error"
            }`}
          >
            {_2faStatus === "enabled" ? "Active" : "Inactive"}
          </span>
        </div>
      )}

      {_2faStatus === "disabled" && (
        <button
          className="btn btn-primary w-fit"
          onClick={async () => {
            set2FAStatus("initializing");
            try {
              const response = await apiFetch("/api/qrcode");
              const data = await response.json();
              setQRData(data.data);
              setQRSecret(data.secret);
            } catch (error) {
              setErrorText("Failed to initialize 2FA. Please try again.");
              set2FAStatus("disabled");
            }
          }}
        >
          Set Up 2FA
        </button>
      )}

      {_2faStatus !== "enabled" && qrData && (
        <div className="space-y-6 p-4 bg-base-100 rounded-lg w-11/12 relative">
          <button 
            className="absolute top-2 right-2 btn btn-ghost btn-sm"
            onClick={() => {
              setQRData(undefined);
              setQRSecret(undefined);
              set2FAStatus('disabled');
              setErrorText(undefined);
            }}
          >
            <MdClose className="size-5" />
          </button>
          <div className="space-y-2">
            <h4 className="font-medium">Step 1: Scan QR Code</h4>
            <div className="alert alert-info">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="stroke-current shrink-0 w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <span>
                Use Google Authenticator, Authy or Microsoft Authenticator to
                scan this code
              </span>
            </div>
            <img
              src={qrData}
              alt="2FA QR Code"
              className="mx-auto h-52 w-52 p-2 bg-white rounded"
            />
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Step 2: Verify Code</h4>
            <input
              type="text"
              placeholder="Enter 6-digit code"
              className="input input-bordered w-full max-w-xs"
              maxLength={6}
              onChange={(e) => setUserToken(e.target.value)}
              value={userToken}
            />

            <div className="flex gap-2 items-center">
              <button
                className="btn btn-success btn-sm"
                onClick={async () => {
                  try {
                    const response = await apiFetch(`/api/verify`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        secret: qrSecret,
                        token: userToken,
                      }),
                    });
                    const data = await response.json();
                    if (data.success) {
                      set2FAStatus("enabled");
                      setErrorText("");
                      setQRData(undefined);
                      setQRSecret(undefined);
                      setUserToken("");
                    } else {
                      setUserToken("");
                      setErrorText(
                        "Invalid verification code. Please try again."
                      );
                    }
                  } catch (error) {
                    setUserToken("");
                    setErrorText("Failed to verify code. Please try again.");
                  }
                }}
              >
                Verify & Activate
              </button>
              {errorText && (
                <span className="text-error text-sm">{errorText}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {_2faStatus === "enabled" && (
        <button
          className="btn btn-error btn-sm ml-4"
          onClick={handleDisable2FA}
        >
          Disable 2FA
        </button>
      )}
    </div>
  );
}

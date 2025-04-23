"use client";

import { useState } from "react";

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
  const [userToken, setUserToken] = useState<string>(''); // Initialize with empty string
  const [errorText, setErrorText] = useState<string>();
  return (
    <div className="flex flex-col gap-4 items-end w-full">
      {!qrData && (
        <div className="flex items-center gap-3">
          <span className="badge badge-lg badge-ghost">Current Status:</span>
          <span className={`font-medium ${_2faStatus === "enabled" ? "text-success" : "text-error"}`}>
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
              const response = await fetch("/api/qrcode");
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
        <div className="space-y-6 p-4 bg-base-100 rounded-lg w-11/12">
          <div className="space-y-2">
            <h4 className="font-medium">Step 1: Scan QR Code</h4>
            <div className="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span>Use Google Authenticator, Authy or Microsoft Authenticator to scan this code</span>
            </div>
            <img src={qrData} alt="2FA QR Code" className="mx-auto h-52 w-52 p-2 bg-white rounded" />
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Step 2: Verify Code</h4>
            <input
              type="text"
              placeholder="Enter 6-digit code"
              className="input input-bordered w-full max-w-xs"
              maxLength={6}
              onChange={(e) => setUserToken(e.target.value)}
              value={userToken || ''} // Ensure always string value
            />
            
            <div className="flex gap-2 items-center">
              <button
                className="btn btn-success btn-sm"
                onClick={async () => {
                  const response = await fetch(
                    `/api/verify?secret=${qrSecret}&token=${userToken}`
                  );
                  const data = await response.json();
                  if (data.verified) {
                    set2FAStatus("enabled");
                    setErrorText("");
                  } else {
                    setUserToken("");
                    setErrorText(
                      "Failed. Please scan the QR code and repeat verification."
                    );
                  }
                }}
              >
                Verify & Activate
              </button>
              {errorText && <span className="text-error text-sm">{errorText}</span>}
            </div>
          </div>
        </div>
      )}

      {_2faStatus === "enabled" && (
        <div className="alert alert-success">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>Two-factor authentication is currently active on your account</span>
          <button className="btn btn-error btn-sm ml-4">Disable 2FA</button>
        </div>
      )}
    </div>
  );
}

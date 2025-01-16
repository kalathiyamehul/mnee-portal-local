"use client";

import { useEffect, useState, useRef } from 'react';
import { MNEE_API } from '@/env';
import { checkServerEnvVars } from '@/app/api/env-check/actions';

interface EnvWarningProps {
  onMissingVarsChange?: (vars: string[]) => void;
}

export function EnvWarning({ onMissingVarsChange }: EnvWarningProps) {
  const [missingVars, setMissingVars] = useState<string[]>([]);
  const onChangeRef = useRef(onMissingVarsChange);

  // Keep the ref up to date
  useEffect(() => {
    onChangeRef.current = onMissingVarsChange;
  }, [onMissingVarsChange]);

  useEffect(() => {
    let isMounted = true;
    let timer: NodeJS.Timer | null = null;

    async function checkVars() {
      const missing: string[] = [];

      // Check frontend variables
      if (!MNEE_API) missing.push('NEXT_PUBLIC_MNEE_API');

      // Check backend variables using server action
      try {
        const { hasMintWif, hasBurnWif, hasOrdinalsService } = await checkServerEnvVars();
        if (!isMounted) return;
        if (!hasMintWif) missing.push('MINT_WIF');
        if (!hasBurnWif) missing.push('BURN_WIF');
        if (!hasOrdinalsService) missing.push('MNEE_ORDINALS_SERVICE');
        setMissingVars(missing);
        onChangeRef.current?.(missing);

        // Only set up polling if we have missing variables
        if (missing.length > 0 && !timer) {
          timer = setInterval(checkVars, 5000);
        } else if (missing.length === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      } catch (error) {
        console.error('Failed to check server env vars:', error);
      }
    }

    // Initial check
    checkVars();

    return () => {
      isMounted = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, []); // Clean dependency array

  if (missingVars.length === 0) return null;

  return (
    <div className="flex justify-center w-full">
      <div className="alert alert-warning shadow-lg max-w-2xl w-full">
        <div className="flex-row">
          <h3 className="font-bold flex items-center gap-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="stroke-current flex-shrink-0 h-6 w-6" 
              fill="none" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            Missing Environment Variables
          </h3>
          <div>
            <div className="text-sm mt-1">
              The following environment variables are required but not set:
              <ul className="list-disc list-inside mt-2 space-y-1">
                {missingVars.map(variable => (
                  <li key={variable} className="font-mono text-xs">{variable}</li>
                ))}
              </ul>
              <p className="text-xs mt-2 opacity-75">After updating environment variables, restart the server for changes to take effect.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Scale } from 'lucide-react';

export const PresumptiveDisclaimerBanner: React.FC = () => {
  return (
    <div className="bg-white border border-slate-200 border-l-4 border-l-[#0c2340] rounded-md px-3.5 py-2 text-xs text-left shadow-xs flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-slate-800">
        <Scale className="w-4 h-4 text-[#0c2340] shrink-0" />
        <span className="font-semibold text-slate-900 text-xs">Presumptive Screening:</span>
        <span className="text-slate-600 text-xs">
          Confirmatory lab testing (GC/MS) required for judicial prosecution.
        </span>
      </div>
      <span className="text-[10px] font-mono font-medium text-slate-400 shrink-0 hidden sm:inline">
        NIST SP 800-88
      </span>
    </div>
  );
};


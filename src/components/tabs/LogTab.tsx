/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  Clock,
  User,
  MapPin,
  Lock,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  X,
  QrCode,
  CheckSquare,
  Square,
} from 'lucide-react';
import { db } from '../../db/index.ts';
import type { TestRecordEntity, TestResultOutcome } from '../../types/index.ts';
import { RecordDetailModal } from '../RecordDetailModal.tsx';
import { ForensicQrTransferModal } from '../ForensicQrTransferModal.tsx';

export const LogTab: React.FC = () => {
  const [records, setRecords] = useState<TestRecordEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<TestRecordEntity | null>(null);

  // QR Code Terminal Transfer State
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [qrModalRecords, setQrModalRecords] = useState<TestRecordEntity[]>([]);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrInitialIndex, setQrInitialIndex] = useState(0);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [tamperFilter, setTamperFilter] = useState<'ALL' | 'VERIFIED' | 'TAMPERED'>('ALL');

  const loadRecords = async () => {
    setLoading(true);
    try {
      const all = await db.testRecords.orderBy('timestampIso').reverse().toArray();
      setRecords(all);
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedRecordIds.size === filteredRecords.length && filteredRecords.length > 0) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(filteredRecords.map((r) => r.id)));
    }
  };

  const handleOpenQrForSingle = (rec: TestRecordEntity, e: React.MouseEvent) => {
    e.stopPropagation();
    setQrModalRecords([rec]);
    setQrInitialIndex(0);
    setIsQrModalOpen(true);
  };

  const handleOpenQrForSelected = () => {
    const selected = filteredRecords.filter((r) => selectedRecordIds.has(r.id));
    if (selected.length === 0) return;
    setQrModalRecords(selected);
    setQrInitialIndex(0);
    setIsQrModalOpen(true);
  };

  // Filtered and Searched Records
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = Date.now();

    return records.filter((rec) => {
      // 1. Result filter
      if (resultFilter !== 'ALL' && rec.result !== resultFilter) {
        return false;
      }

      // 2. Tamper filter
      if (tamperFilter === 'VERIFIED' && rec.tampered) return false;
      if (tamperFilter === 'TAMPERED' && !rec.tampered) return false;

      // 3. Date filter
      if (dateFilter !== 'ALL') {
        const recTime = new Date(rec.timestampIso).getTime();
        const diffDays = (now - recTime) / (1000 * 60 * 60 * 24);
        if (dateFilter === 'TODAY' && diffDays > 1) return false;
        if (dateFilter === 'WEEK' && diffDays > 7) return false;
        if (dateFilter === 'MONTH' && diffDays > 30) return false;
      }

      // 4. Full-Text Search
      if (q) {
        const idMatch = rec.id.toLowerCase().includes(q);
        const operatorMatch = rec.operatorId.toLowerCase().includes(q) || rec.badgeUnit.toLowerCase().includes(q);
        const kitMatch = rec.kitProfileId.toLowerCase().includes(q);
        const resultMatch = rec.result.toLowerCase().includes(q);
        const reasonMatch = rec.reason.toLowerCase().includes(q);
        const gpsMatch =
          rec.gps?.latitude?.toString().includes(q) ||
          rec.gps?.longitude?.toString().includes(q) ||
          rec.gps?.status.toLowerCase().includes(q);

        return idMatch || operatorMatch || kitMatch || resultMatch || reasonMatch || gpsMatch;
      }

      return true;
    });
  }, [records, searchQuery, resultFilter, dateFilter, tamperFilter]);

  return (
    <div className="space-y-4 pb-12 w-full text-left">
      {/* Title & Stats */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-300">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-700" />
            Evidence Ledger
          </h1>
          <p className="text-xs text-slate-500">
            Immutable custody chain stored locally in IndexedDB.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total</span>
            <p className="text-sm font-semibold text-slate-900">{records.length}</p>
          </div>

          <button
            onClick={loadRecords}
            className="p-1.5 rounded-md bg-[#e9edf2] hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer transition shadow-2xs"
            title="Refresh Log"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-3.5 space-y-2.5 shadow-xs">
        {/* Full-Text Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, officer, kit, result, GPS, or finding..."
            className="w-full pl-9 pr-8 py-2 rounded-md bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Result Filter */}
          <div className="flex items-center gap-1 bg-[#e9edf2] p-0.5 rounded-md border border-slate-300">
            <button
              onClick={() => setResultFilter('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                resultFilter === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setResultFilter('POSITIVE')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                resultFilter === 'POSITIVE' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Positive
            </button>
            <button
              onClick={() => setResultFilter('NEGATIVE')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                resultFilter === 'NEGATIVE' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Negative
            </button>
            <button
              onClick={() => setResultFilter('INCONCLUSIVE')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                resultFilter === 'INCONCLUSIVE' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inconclusive
            </button>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1 bg-[#e9edf2] p-0.5 rounded-md border border-slate-300">
            <button
              onClick={() => setDateFilter('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                dateFilter === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setDateFilter('TODAY')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                dateFilter === 'TODAY' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('WEEK')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                dateFilter === 'WEEK' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Days
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Record Selection Action Bar */}
      {selectedRecordIds.size > 0 && (
        <div className="sticky top-20 z-20 bg-[#0a1d37] text-white rounded-lg p-3 px-4 flex items-center justify-between text-xs shadow-lg border border-slate-700">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-mono font-bold flex items-center justify-center text-xs">
              {selectedRecordIds.size}
            </span>
            <span className="font-medium text-slate-200">
              {selectedRecordIds.size === 1 ? 'record selected' : 'records selected'} for terminal transfer
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenQrForSelected}
              className="px-3.5 py-1.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Generate Terminal QR</span>
            </button>

            <button
              onClick={() => setSelectedRecordIds(new Set())}
              className="px-2.5 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Record List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium transition cursor-pointer"
          >
            {selectedRecordIds.size === filteredRecords.length && filteredRecords.length > 0 ? (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-[#0a1d37]" />
                <span>Deselect All</span>
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5 text-slate-400" />
                <span>Select All for QR Transfer</span>
              </>
            )}
          </button>

          <span>Showing {filteredRecords.length} records</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs font-medium">
            Loading evidence ledger...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-12 text-center space-y-2 border border-dashed border-slate-300 rounded-xl bg-[#f4f6fa] p-8 shadow-xs">
            <Lock className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-xs font-semibold text-slate-800">
              {records.length === 0 ? 'No Evidence Records Stored' : 'No Matching Records'}
            </h3>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
              {records.length === 0
                ? 'Perform a test in the Chemical Test tab to create cryptographic evidence.'
                : 'Try adjusting your search query or filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecords.map((rec) => {
              const isSelected = selectedRecordIds.has(rec.id);
              const hasGps = rec.gps?.latitude !== null && rec.gps?.longitude !== null;
              const formattedDate = new Date(rec.timestampIso).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              // Create localized image thumbnail URL from blob if present
              const thumbUrl = rec.imageBlob ? URL.createObjectURL(rec.imageBlob) : null;

              return (
                <div
                  key={rec.id}
                  onClick={() => setSelectedRecord(rec)}
                  className={`p-3 rounded-lg border bg-white/95 transition cursor-pointer flex items-center justify-between gap-3 text-left shadow-2xs ${
                    isSelected
                      ? 'border-[#0a192f] ring-1 ring-[#0a192f] bg-slate-50'
                      : 'border-slate-300 hover:border-slate-400 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox for QR transfer selection */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleSelect(rec.id, e)}
                      className="p-1 rounded text-slate-400 hover:text-[#0a1d37] transition cursor-pointer flex-shrink-0"
                      title={isSelected ? 'Deselect record' : 'Select record for QR transfer'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#0a1d37]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    {/* Image Thumbnail */}
                    <div className="w-10 h-10 rounded-md bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-400" />
                      )}
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        {/* Result Badge */}
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-800">
                          {rec.result}
                        </span>

                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {rec.kitProfileId}
                        </span>

                        {/* Verified vs Tampered */}
                        {rec.tampered ? (
                          <span className="flex items-center gap-1 text-[9px] font-semibold text-slate-900 bg-slate-200 px-1 py-0.2 rounded border border-slate-300">
                            <ShieldAlert className="w-3 h-3 text-slate-700" />
                            <span>ALTERED</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] font-semibold text-slate-700 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                            <ShieldCheck className="w-3 h-3 text-slate-700" />
                            <span>VERIFIED</span>
                          </span>
                        )}
                      </div>

                      {/* Detail row */}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-slate-500">
                        <span
                          className="flex items-center gap-1 text-slate-600 font-medium"
                          title={`UTC ISO-8601: ${rec.timestampIso} • Monotonic: +${rec.bootClockMs.toFixed(1)}ms`}
                        >
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formattedDate}</span>
                          {rec.reactionElapsedSeconds && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
                              {rec.reactionElapsedSeconds}s {rec.reactionTimeFlag === 'ON_TIME' ? '✓' : rec.reactionTimeFlag}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <User className="w-3 h-3 text-slate-400" />
                          {rec.operatorId}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[9px] text-slate-400 truncate">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {hasGps
                            ? `${rec.gps.latitude?.toFixed(4)}, ${rec.gps.longitude?.toFixed(4)}`
                            : 'No GPS'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleOpenQrForSingle(rec, e)}
                      className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-[#0a1d37] border border-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      title="Generate terminal optical transfer QR code"
                    >
                      <QrCode className="w-3.5 h-3.5 text-[#0a1d37]" />
                      <span className="hidden sm:inline text-[11px] font-semibold">QR Code</span>
                    </button>

                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Record Detail & Export Modal */}
      <RecordDetailModal
        isOpen={Boolean(selectedRecord)}
        record={selectedRecord}
        onClose={() => {
          setSelectedRecord(null);
        }}
        onRecordUpdated={loadRecords}
      />

      {/* Terminal Optical QR Transfer Modal */}
      <ForensicQrTransferModal
        isOpen={isQrModalOpen}
        records={qrModalRecords}
        initialIndex={qrInitialIndex}
        onClose={() => setIsQrModalOpen(false)}
      />
    </div>
  );
};

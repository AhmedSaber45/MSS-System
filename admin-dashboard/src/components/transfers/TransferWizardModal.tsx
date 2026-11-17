'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Building,
  Smartphone,
  Layers,
  ShieldCheck,
  Loader2,
  Search,
  CheckSquare,
  Square,
  X,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type {
  SystemStore,
  InventoryDevice,
  TransferType,
  TransferPreviewResponse,
  ExecuteTransferResult,
} from '@/types/admin';

interface TransferWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: ExecuteTransferResult) => void;
  availableStores: SystemStore[];
  preselectedDeviceIds?: string[];
  preselectedSource?: string;
}

export const TransferWizardModal: React.FC<TransferWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  availableStores,
  preselectedDeviceIds = [],
  preselectedSource,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Form State
  const [sourceLocation, setSourceLocation] = useState<string>(preselectedSource || '');
  const [destinationLocation, setDestinationLocation] = useState<string>('');
  const [transferType, setTransferType] = useState<TransferType>(
    preselectedDeviceIds.length > 0 ? 'SELECTED' : 'SELECTED'
  );
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(preselectedDeviceIds);
  const [notes, setNotes] = useState<string>('');

  // Source devices state
  const [sourceDevices, setSourceDevices] = useState<InventoryDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');

  // Preview state
  const [previewData, setPreviewData] = useState<TransferPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Execution state
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecuteTransferResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [disclaimerConfirmed, setDisclaimerConfirmed] = useState(false);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      if (preselectedSource) setSourceLocation(preselectedSource);
      if (preselectedDeviceIds.length > 0) {
        setSelectedDeviceIds(preselectedDeviceIds);
        setTransferType('SELECTED');
      }
    }
  }, [isOpen, preselectedSource, preselectedDeviceIds]);

  // Load devices in source location when source changes
  useEffect(() => {
    if (!sourceLocation || !isOpen) return;

    const fetchSourceDevices = async () => {
      setLoadingDevices(true);
      try {
        const res = await fetch(`/api/inventory?location=${encodeURIComponent(sourceLocation)}&limit=200`);
        const json = await res.json();
        if (json.devices) {
          setSourceDevices(json.devices);
        }
      } catch {
        // Fallback handled
      } finally {
        setLoadingDevices(false);
      }
    };

    fetchSourceDevices();
  }, [sourceLocation, isOpen]);

  // Active stores for destination dropdown (filter out source)
  const destinationOptions = useMemo(() => {
    return availableStores.filter(
      s => !s.isArchived && s.isActive && s.name !== sourceLocation && s.code !== sourceLocation
    );
  }, [availableStores, sourceLocation]);

  // Filtered source devices for selection
  const filteredSourceDevices = useMemo(() => {
    return sourceDevices.filter(d => {
      const q = deviceSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        d.serialNumber.toLowerCase().includes(q) ||
        d.modelName.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q)
      );
    });
  }, [sourceDevices, deviceSearch]);

  // Handle Multi-device toggle
  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDeviceIds(prev =>
      prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]
    );
  };

  const selectAllEligible = () => {
    const eligibleIds = sourceDevices.filter(d => d.status === 'AVAILABLE').map(d => d.id);
    setSelectedDeviceIds(eligibleIds);
  };

  const clearSelection = () => {
    setSelectedDeviceIds([]);
  };

  // Fetch Preview (Step 4)
  const fetchPreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          sourceLocation,
          destinationLocation,
          transferType,
          deviceIds: transferType === 'SELECTED' || transferType === 'INDIVIDUAL' ? selectedDeviceIds : undefined,
          allEligible: transferType === 'ALL_ELIGIBLE',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.preview) {
        throw new Error(json.error || 'فشل في استخراج معاينة التحويل');
      }

      setPreviewData(json.preview);
    } catch (err: any) {
      setPreviewError(err.message || 'حدث خطأ أثناء معاينة التحويل');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Execute Transfer (Step 5)
  const handleExecute = async () => {
    if (!disclaimerConfirmed || executionLoading) return;

    setExecutionLoading(true);
    setExecutionError(null);

    const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          sourceLocation,
          destinationLocation,
          transferType,
          deviceIds: transferType === 'SELECTED' || transferType === 'INDIVIDUAL' ? selectedDeviceIds : undefined,
          allEligible: transferType === 'ALL_ELIGIBLE',
          notes,
          idempotencyKey,
          confirmed: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.result) {
        throw new Error(json.error || 'فشل في تنفيذ عملية التحويل');
      }

      setExecutionResult(json.result);
      setStep(6);
      onSuccess(json.result);
    } catch (err: any) {
      setExecutionError(err.message || 'حدث خطأ أثناء تنفيذ التحويل');
    } finally {
      setExecutionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-brand-primary rounded-xl border border-blue-500/20">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">معالج تحويل المخزون المعتمد</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                نقل الأجهزة بين الفروع والمخازن مع التحقق الذري وحفظ التكلفة والسجلات التاريخية
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicators */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/50 flex items-center justify-between shrink-0 overflow-x-auto gap-2">
          {[
            { num: 1, title: 'المصدر' },
            { num: 2, title: 'الوجهة' },
            { num: 3, title: 'تحديد الأجهزة' },
            { num: 4, title: 'معاينة الأثر' },
            { num: 5, title: 'التأكيد' },
            { num: 6, title: 'النتيجة' },
          ].map(s => {
            const isCurrent = step === s.num;
            const isPassed = step > s.num;
            return (
              <div
                key={s.num}
                className={`flex items-center gap-2 text-xs font-semibold whitespace-nowrap ${
                  isCurrent ? 'text-brand-primary' : isPassed ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isPassed
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isPassed ? <CheckCircle className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span>{s.title}</span>
                {s.num < 6 && <div className="w-4 h-px bg-slate-800 hidden sm:block mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Wizard Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: Select Source */}
          {step === 1 && (
            <div className="space-y-4 max-w-xl mx-auto py-4">
              <div className="text-center space-y-1 mb-6">
                <h4 className="text-base font-bold text-white">الخطوة 1: تحديد موقع المصدر</h4>
                <p className="text-xs text-slate-400">
                  اختر الفرع أو المخزن الذي ستنقل الأجهزة منه
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  موقع المصدر (Store / Warehouse) *
                </label>
                <select
                  value={sourceLocation}
                  onChange={e => setSourceLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-primary"
                >
                  <option value="">-- اختر موقع المصدر --</option>
                  {availableStores
                    .filter(s => !s.isArchived)
                    .map(store => (
                      <option key={store.id} value={store.name}>
                        {store.name} ({store.code}) — {store.type}
                      </option>
                    ))}
                </select>
              </div>

              {sourceLocation && (
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <Building className="w-4 h-4 text-brand-primary" />
                    <span>الموقع المحدد: <strong>{sourceLocation}</strong></span>
                  </div>
                  {loadingDevices ? (
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary" />
                      جاري فحص المخزون...
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-semibold">
                      {sourceDevices.filter(d => d.status === 'AVAILABLE').length} جهاز متاح للنقل
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Select Destination */}
          {step === 2 && (
            <div className="space-y-4 max-w-xl mx-auto py-4">
              <div className="text-center space-y-1 mb-6">
                <h4 className="text-base font-bold text-white">الخطوة 2: تحديد موقع الوجهة</h4>
                <p className="text-xs text-slate-400">
                  اختر الفرع أو المخزن الذي ستستقبل الأجهزة المحولة
                </p>
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-xs flex items-center gap-2 text-slate-300 mb-4">
                <span className="text-slate-500">المصدر المعتمد:</span>
                <span className="font-bold text-white">{sourceLocation}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  موقع الوجهة الهدف (Destination) *
                </label>
                <select
                  value={destinationLocation}
                  onChange={e => setDestinationLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-primary"
                >
                  <option value="">-- اختر موقع الوجهة --</option>
                  {destinationOptions.map(store => (
                    <option key={store.id} value={store.name}>
                      {store.name} ({store.code}) — {store.type}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1.5 block">
                  يجب أن يختلف موقع الوجهة عن موقع المصدر، وتكون حالته نشطة.
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Select Transfer Scope & Devices */}
          {step === 3 && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-base font-bold text-white">الخطوة 3: تحديد نطاق الأجهزة المراد نقلها</h4>
                  <p className="text-xs text-slate-400">
                    حدد أجهزة معينة أو كامل الرصيد المتاح من ({sourceLocation}) إلى ({destinationLocation})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferType('SELECTED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      transferType === 'SELECTED'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    تحديد أجهزة معينة
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferType('ALL_ELIGIBLE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      transferType === 'ALL_ELIGIBLE'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    نقل كامل الرصيد المتاح
                  </button>
                </div>
              </div>

              {transferType === 'ALL_ELIGIBLE' ? (
                <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-2xl text-center space-y-3 max-w-xl mx-auto my-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-brand-primary flex items-center justify-center mx-auto">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h5 className="font-bold text-white text-sm">نقل كامل الأجهزة المتاحة من الموقع</h5>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    سيتم نقل جميع الأجهزة المسجلة بحالة (متاح - AVAILABLE) في ({sourceLocation}) والبالغ عددها (
                    <strong className="text-emerald-400">
                      {sourceDevices.filter(d => d.status === 'AVAILABLE').length} جهاز
                    </strong>
                    ) إلى ({destinationLocation}).
                  </p>
                  <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
                    تنبيه: الأجهزة المحجوزة، المباعة، أو قيد الصيانة لن يتم نقلها وستظل محفوظة بالمصدر.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search and Selection Actions Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                    <div className="relative flex-1">
                      <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="ابحث بالسيريال نمبر أو اسم الموديل أو الماركة..."
                        value={deviceSearch}
                        onChange={e => setDeviceSearch(e.target.value)}
                        className="w-full pr-9 pl-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-primary"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllEligible}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors"
                      >
                        تحديد كل المتاح
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        إلغاء التحديد
                      </button>
                      <span className="text-xs font-bold text-brand-primary px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                        المحدد: {selectedDeviceIds.length}
                      </span>
                    </div>
                  </div>

                  {/* Device Selection Table */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto bg-slate-950/30">
                    <table className="w-full text-right text-xs text-slate-300">
                      <thead className="bg-slate-900/90 text-slate-400 text-[11px] font-semibold sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="p-3 w-10 text-center">اختيار</th>
                          <th className="p-3">السيريال</th>
                          <th className="p-3">الموديل والماركة</th>
                          <th className="p-3">الحالة</th>
                          <th className="p-3">تكلفة الشراء</th>
                          <th className="p-3">أهلية النقل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {loadingDevices ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              <Loader2 className="w-5 h-5 animate-spin mx-auto text-brand-primary mb-2" />
                              جاري استعراض الأجهزة...
                            </td>
                          </tr>
                        ) : filteredSourceDevices.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-500">
                              لا توجد أجهزة مطابقة في موقع المصدر
                            </td>
                          </tr>
                        ) : (
                          filteredSourceDevices.map(d => {
                            const isSelected = selectedDeviceIds.includes(d.id);
                            const isAvailable = d.status === 'AVAILABLE';

                            return (
                              <tr
                                key={d.id}
                                onClick={() => isAvailable && toggleDeviceSelection(d.id)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-blue-900/20 text-white'
                                    : isAvailable
                                    ? 'hover:bg-slate-900/50'
                                    : 'opacity-50 cursor-not-allowed bg-slate-950/60'
                                }`}
                              >
                                <td className="p-3 text-center">
                                  {isAvailable ? (
                                    isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-brand-primary mx-auto" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-600 mx-auto" />
                                    )
                                  ) : (
                                    <X className="w-4 h-4 text-rose-500/60 mx-auto" />
                                  )}
                                </td>
                                <td className="p-3 font-mono font-bold">{d.serialNumber}</td>
                                <td className="p-3">
                                  {d.modelName} <span className="text-slate-500 text-[11px]">({d.brand})</span>
                                </td>
                                <td className="p-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                      d.status === 'AVAILABLE'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : d.status === 'RESERVED'
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    }`}
                                  >
                                    {d.status}
                                  </span>
                                </td>
                                <td className="p-3 font-mono">{d.purchaseCost.toLocaleString()} ج.م</td>
                                <td className="p-3 text-[11px]">
                                  {isAvailable ? (
                                    <span className="text-emerald-400 font-medium">مؤهل للتحويل</span>
                                  ) : (
                                    <span className="text-rose-400">{d.ineligibilityReason || 'غير متاح'}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Preview Impact */}
          {step === 4 && (
            <div className="space-y-4 py-2">
              <div className="pb-3 border-b border-slate-800">
                <h4 className="text-base font-bold text-white">الخطوة 4: معاينة الأثر والتحقق المسبق</h4>
                <p className="text-xs text-slate-400">
                  فحص حقيقي ومحدث لحالة الأجهزة في السحابة قبل تأكيد العملية
                </p>
              </div>

              {previewLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                  <p className="text-sm">جاري تدقيق أهلية الأجهزة وحساب التكلفة...</p>
                </div>
              ) : previewError ? (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{previewError}</span>
                </div>
              ) : previewData ? (
                <div className="space-y-4">
                  {/* Validation Errors Alert */}
                  {previewData.validationErrors && previewData.validationErrors.length > 0 && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1.5 text-xs text-rose-400">
                      <div className="font-bold flex items-center gap-2 text-rose-300">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>تعذر اعتماد التحويل للأسباب التالية:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 pr-2">
                        {previewData.validationErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">الأجهزة المؤهلة</div>
                      <div className="text-xl font-bold text-emerald-400 mt-1">
                        {previewData.totalEligibleCount} جهاز
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">الأجهزة المستبعدة</div>
                      <div className="text-xl font-bold text-rose-400 mt-1">
                        {previewData.totalIneligibleCount} جهاز
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">إجمالي التكلفة المنقولة</div>
                      <div className="text-xl font-bold text-white mt-1">
                        {previewData.totalEligibleCost.toLocaleString()} ج.م
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">حالة العملية</div>
                      <div className="mt-1">
                        {previewData.canTransfer ? (
                          <span className="px-2 py-1 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                            جاهز للتأكيد
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                            محظور
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Historical Preservation Banner */}
                  <div className="p-3.5 bg-blue-950/20 border border-blue-900/40 rounded-xl text-xs text-blue-300 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-blue-200">الضمانة المالية والتاريخية: </span>
                      {previewData.historicalNotice}
                    </div>
                  </div>

                  {/* Eligible items preview list */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-slate-300">الأجهزة المعتمدة للنقل:</h5>
                    <div className="border border-slate-800 rounded-xl max-h-48 overflow-y-auto bg-slate-950/40 text-xs">
                      <table className="w-full text-right text-slate-300">
                        <thead className="bg-slate-900/80 text-[11px] text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="p-2.5">السيريال</th>
                            <th className="p-2.5">الموديل</th>
                            <th className="p-2.5">التكلفة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {previewData.eligibleDevices.map(d => (
                            <tr key={d.id} className="hover:bg-slate-900/40">
                              <td className="p-2.5 font-bold text-white">{d.serialNumber}</td>
                              <td className="p-2.5 font-sans text-slate-300">{d.modelName}</td>
                              <td className="p-2.5 text-slate-300">{d.purchaseCost.toLocaleString()} ج.م</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* STEP 5: Confirmation */}
          {step === 5 && (
            <div className="space-y-5 max-w-xl mx-auto py-3">
              <div className="text-center space-y-1 mb-4">
                <h4 className="text-base font-bold text-white">الخطوة 5: التأكيد وإقرار النقل</h4>
                <p className="text-xs text-slate-400">
                  يرجى كتابة ملاحظات إدارية اختيارية والإقرار النهائي
                </p>
              </div>

              {executionError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                  {executionError}
                </div>
              )}

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">من موقع:</span>
                  <span className="font-bold text-white">{sourceLocation}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">إلى موقع:</span>
                  <span className="font-bold text-emerald-400">{destinationLocation}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">عدد الأجهزة المؤكدة:</span>
                  <span className="font-bold text-white">{previewData?.totalEligibleCount || 0} جهاز</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">القيمة الإجمالية:</span>
                  <span className="font-bold text-white">{previewData?.totalEligibleCost.toLocaleString() || 0} ج.م</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  ملاحظات أو سبب التحويل (اختياري)
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: تحويل بضائع لتغذية فرع وسط البلد قبل المعرض..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Checkbox disclaimer */}
              <div className="flex items-start gap-3 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                <input
                  type="checkbox"
                  id="confirmTransferDisclaimer"
                  checked={disclaimerConfirmed}
                  onChange={e => setDisclaimerConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-800 text-brand-primary focus:ring-brand-primary"
                />
                <label htmlFor="confirmTransferDisclaimer" className="text-xs text-slate-300 cursor-pointer">
                  أؤكد مسؤوليتي عن تحويل الأجهزة المحددة لموقع الوجهة، وأعلم أن هذه الحركة موثقة في سجل التدقيق ومحفوظة برقم مرجعي غير قابل للتكرار.
                </label>
              </div>
            </div>
          )}

          {/* STEP 6: Success Result */}
          {step === 6 && executionResult && (
            <div className="text-center py-6 space-y-4 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white">تم تنفيذ تحويل المخزون بنجاح!</h4>
                <p className="text-xs text-slate-400">{executionResult.message}</p>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-right text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">الرقم المرجعي للتحويل:</span>
                  <span className="font-mono font-bold text-brand-primary text-sm">
                    {executionResult.referenceNumber}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">عدد الأجهزة المنقولة:</span>
                  <span className="font-bold text-white">{executionResult.itemCount} جهاز</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">إجمالي التكلفة المنقولة:</span>
                  <span className="font-mono font-bold text-white">{executionResult.totalCost.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">المسار المنفذ:</span>
                  <span className="font-semibold text-slate-300">
                    {executionResult.sourceLocation} ➔ {executionResult.destinationLocation}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          {step < 6 ? (
            <>
              <div>
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((step - 1) as any)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>السابق</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
                >
                  إلغاء
                </button>

                {step === 1 && (
                  <button
                    type="button"
                    disabled={!sourceLocation || loadingDevices}
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <span>التالي (تحديد الوجهة)</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                {step === 2 && (
                  <button
                    type="button"
                    disabled={!destinationLocation}
                    onClick={() => setStep(3)}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <span>التالي (تحديد الأجهزة)</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                {step === 3 && (
                  <button
                    type="button"
                    disabled={
                      transferType === 'SELECTED' && selectedDeviceIds.length === 0
                    }
                    onClick={() => {
                      fetchPreview();
                      setStep(4);
                    }}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <span>التالي (معاينة الأثر)</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                {step === 4 && (
                  <button
                    type="button"
                    disabled={!previewData?.canTransfer || previewLoading}
                    onClick={() => setStep(5)}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <span>متابعة للتأكيد</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                {step === 5 && (
                  <button
                    type="button"
                    disabled={!disclaimerConfirmed || executionLoading}
                    onClick={handleExecute}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg disabled:opacity-50"
                  >
                    {executionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري تنفيذ التحويل الذري...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>تأكيد واعتماد التحويل</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl text-xs font-bold transition-all"
              >
                إغلاق وتحديث القوائم
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferWizardModal;

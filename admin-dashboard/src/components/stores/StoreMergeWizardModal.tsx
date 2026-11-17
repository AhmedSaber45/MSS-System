'use client';

import React, { useState, useEffect } from 'react';
import {
  GitMerge,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Building,
  Users,
  Layers,
  ShieldCheck,
  Loader2,
  Plus,
  Store,
  Warehouse,
} from 'lucide-react';
import type {
  SystemStore,
  CreateStoreInput,
  StoreMergeImpactPreview,
  StoreMergeResult,
  StoreType,
} from '@/types/admin';

interface StoreMergeWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: StoreMergeResult) => void;
  availableStores: SystemStore[];
}

export const StoreMergeWizardModal: React.FC<StoreMergeWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  availableStores,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Selected source stores
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Step 2: Destination choice
  const [destinationMode, setDestinationMode] = useState<'existing' | 'new'>('existing');
  const [selectedDestId, setSelectedDestId] = useState<string>('');
  const [newDestForm, setNewDestForm] = useState<CreateStoreInput>({
    code: '',
    name: '',
    type: 'combined',
    description: '',
    address: '',
    phone: '',
    isActive: true,
  });

  // Step 3: Impact Preview
  const [preview, setPreview] = useState<StoreMergeImpactPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Step 4: Disclaimer confirmation
  const [confirmedDisclaimer, setConfirmedDisclaimer] = useState(false);
  const [mergeNotes, setMergeNotes] = useState('');

  // Step 5: Execution
  const [executing, setExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<StoreMergeResult | null>(null);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedSourceIds([]);
      setSelectedDestId('');
      setDestinationMode('existing');
      setConfirmedDisclaimer(false);
      setPreview(null);
      setPreviewError(null);
      setExecutionError(null);
      setMergeResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter eligible source stores (must be active and not archived)
  const eligibleSources = availableStores.filter(s => !s.isArchived);

  // Eligible destination stores (exclude selected sources)
  const eligibleDestinations = availableStores.filter(
    s => !s.isArchived && !selectedSourceIds.includes(s.id)
  );

  const toggleSourceSelect = (id: string) => {
    if (selectedSourceIds.includes(id)) {
      setSelectedSourceIds(selectedSourceIds.filter(sId => sId !== id));
    } else {
      setSelectedSourceIds([...selectedSourceIds, id]);
    }
  };

  // Fetch preview when moving to Step 3
  const handleProceedToPreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const params = new URLSearchParams();
      params.set('sources', selectedSourceIds.join(','));
      if (destinationMode === 'existing') {
        params.set('dest', selectedDestId);
      } else {
        params.set('newDestName', newDestForm.name);
      }

      const res = await fetch(`/api/stores/merge?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر جلب معاينة تأثير الدمج');

      setPreview(data.preview);
      setStep(3);
    } catch (err: any) {
      setPreviewError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Execute merge
  const handleExecuteMerge = async () => {
    setExecuting(true);
    setExecutionError(null);
    try {
      const payload: any = {
        sourceStoreIds: selectedSourceIds,
        notes: mergeNotes.trim() || undefined,
      };

      if (destinationMode === 'existing') {
        payload.destinationStoreId = selectedDestId;
      } else {
        payload.newDestination = newDestForm;
      }

      const res = await fetch('/api/stores/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في تنفيذ عملية الدمج');

      setMergeResult(data);
      setStep(5);
      onSuccess(data);
    } catch (err: any) {
      setExecutionError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header & Progress */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">معالج دمج الفروع والمخازن</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                دمج فروع الشركاء في فرع موحد مع الحفاظ التام على السجلات التاريخية والمخزون
              </p>
            </div>
          </div>
          {step !== 5 && (
            <button
              onClick={onClose}
              disabled={executing}
              className="text-slate-400 hover:text-white text-sm font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Step Indicator Header */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400 shrink-0">
          <span className={step >= 1 ? 'text-blue-400 font-bold' : ''}>1. الفروع المصدر</span>
          <span>←</span>
          <span className={step >= 2 ? 'text-blue-400 font-bold' : ''}>2. الفرع الوجهة</span>
          <span>←</span>
          <span className={step >= 3 ? 'text-blue-400 font-bold' : ''}>3. معاينة التأثير</span>
          <span>←</span>
          <span className={step >= 4 ? 'text-blue-400 font-bold' : ''}>4. التأكيد والإقرار</span>
          <span>←</span>
          <span className={step === 5 ? 'text-emerald-400 font-bold' : ''}>5. اكتمال الدمج</span>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* ========================================================================= */}
          {/* STEP 1: SELECT SOURCE STORES */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-start gap-2.5">
                <Building className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  حدد فرعين أو أكثر من الفروع/المخازن الحالية لدمجها. سيتم أرشفة هذه الفروع بعد الدمج
                  وإعادة توجيه موظفيها إلى الفرع الموحد.
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  الفروع والمخازن المتاحة للدمج ({eligibleSources.length}):
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto p-1">
                  {eligibleSources.map(st => {
                    const isSelected = selectedSourceIds.includes(st.id);
                    return (
                      <div
                        key={st.id}
                        onClick={() => toggleSourceSelect(st.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-slate-900 border-slate-700 pointer-events-none"
                          />
                          <div>
                            <div className="font-bold text-sm flex items-center gap-2">
                              <span>{st.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                {st.code}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {st.type === 'store' ? 'محل تجاري' : st.type === 'warehouse' ? 'مخزن مركزي' : 'محل ومخزن مشترك'} •{' '}
                              المستخدمون المعينون: {st.assignedUsersCount ?? 0}
                            </div>
                          </div>
                        </div>
                        {st.deviceCount !== undefined && (
                          <span className="text-xs font-mono text-slate-400 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                            {st.deviceCount} جهاز
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedSourceIds.length < 2 && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>يُفضل اختيار فرعين أو أكثر لإتمام دمج الشركاء.</span>
                </p>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: SELECT OR CREATE DESTINATION */}
          {/* ========================================================================= */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-4 border-b border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => setDestinationMode('existing')}
                  className={`text-xs font-bold pb-2 transition-colors relative cursor-pointer ${
                    destinationMode === 'existing'
                      ? 'text-blue-400 border-b-2 border-blue-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  اختيار فرع وجهة حالي
                </button>
                <button
                  type="button"
                  onClick={() => setDestinationMode('new')}
                  className={`text-xs font-bold pb-2 transition-colors relative cursor-pointer ${
                    destinationMode === 'new'
                      ? 'text-blue-400 border-b-2 border-blue-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  + إنشاء فرع موحد جديد للدمج
                </button>
              </div>

              {destinationMode === 'existing' ? (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-300">
                    حدد الفرع الذي سيصبح المقر الموحد بعد الدمج:
                  </label>
                  {eligibleDestinations.length === 0 ? (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                      لا توجد فروع أخرى متاحة كوجهة. يرجى اختيار تبويب "إنشاء فرع موحد جديد".
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                      {eligibleDestinations.map(st => {
                        const isSelected = selectedDestId === st.id;
                        return (
                          <div
                            key={st.id}
                            onClick={() => setSelectedDestId(st.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-blue-600/15 border-blue-500 text-white'
                                : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-4 h-4 text-blue-600 focus:ring-0 bg-slate-900 border-slate-700 pointer-events-none"
                              />
                              <div>
                                <span className="font-bold text-sm">{st.name}</span>
                                <span className="text-[10px] font-mono mr-2 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                  {st.code}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-slate-500 font-sans">
                              {st.type === 'store' ? 'محل' : st.type === 'warehouse' ? 'مخزن' : 'مشترك'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        كود الفرع الموحد (Code) *
                      </label>
                      <input
                        type="text"
                        value={newDestForm.code}
                        onChange={e => setNewDestForm({ ...newDestForm, code: e.target.value })}
                        placeholder="مثال: SHOP_UNIFIED"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 uppercase font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        اسم الفرع الموحد *
                      </label>
                      <input
                        type="text"
                        value={newDestForm.name}
                        onChange={e => setNewDestForm({ ...newDestForm, name: e.target.value })}
                        placeholder="مثال: المقر الموحد (مسعود وأيمن)"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        نوع الموقع
                      </label>
                      <select
                        value={newDestForm.type}
                        onChange={e => setNewDestForm({ ...newDestForm, type: e.target.value as StoreType })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="combined">محل ومخزن مشترك (Combined)</option>
                        <option value="store">محل تجاري فقط (Store)</option>
                        <option value="warehouse">مخزن فقط (Warehouse)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        رقم الهاتف
                      </label>
                      <input
                        type="text"
                        value={newDestForm.phone}
                        onChange={e => setNewDestForm({ ...newDestForm, phone: e.target.value })}
                        placeholder="010..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      العنوان
                    </label>
                    <input
                      type="text"
                      value={newDestForm.address}
                      onChange={e => setNewDestForm({ ...newDestForm, address: e.target.value })}
                      placeholder="العنوان التفصيلي للفرع الموحد"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {previewError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs">
                  {previewError}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: PREVIEW IMPACT */}
          {/* ========================================================================= */}
          {step === 3 && preview && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-200">
                <div className="font-bold flex items-center gap-2 mb-1 text-sm text-blue-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>معاينة نتائج الدمج قبل التنفيذ</span>
                </div>
                <p className="leading-relaxed">
                  راجع التغييرات التنظيمية وأرصدة الأجهزة المتأثرة بدقة قبل المتابعة.
                </p>
              </div>

              {/* Source vs Destination Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    الفروع المصدر المؤرشفة ({preview.sourceStores.length})
                  </span>
                  {preview.sourceStores.map(s => (
                    <div key={s.id} className="font-semibold text-slate-200">
                      • {s.name} ({s.code})
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-slate-950/60 border border-blue-500/30 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-blue-400">
                    الفرع الموحد المستهدف (Destination)
                  </span>
                  <div className="font-bold text-sm text-white">
                    {preview.destinationStore?.name || preview.newDestinationName}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    سيصبح الموقع النشط الوحيد بعد الدمج
                  </div>
                </div>
              </div>

              {/* Affected Users & Partners */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <div className="font-bold text-slate-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>الموظفون والشركاء الذين سيتم نقل عضويتهم ({preview.affectedUsers.length}):</span>
                  </span>
                </div>
                {preview.affectedUsers.length === 0 ? (
                  <p className="text-slate-500">لا يوجد موظفون معينون بالفروع المصدر المحددة.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {preview.affectedUsers.map(u => (
                      <div
                        key={u.userId}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px]"
                      >
                        <div>
                          <span className="font-bold text-slate-100">{u.displayName}</span>
                          <span className="text-slate-500 font-mono mr-1.5">(@{u.username})</span>
                          <span className="text-slate-400 mr-2">
                            (حالياً في: {u.currentStores.join(', ')})
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                          سيُعين في الفرع الموحد
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CRITICAL RULE: Inventory & Historical Preservation Notice */}
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-2 text-amber-200">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>تنبيه أمان المخزون الصارم (Critical Inventory Rule):</span>
                </div>
                <div className="space-y-1 text-[11px] leading-relaxed text-amber-200/90">
                  <p>
                    • <strong>لا يتم نقل الأجهزة تلقائياً:</strong> أجهزة ومخزون الفروع المدمجة تظل مسجلة برصيد
                    موقعها الأصلي. النقل الفعلي للأجهزة بين المواقع يتطلب عملية تحويل مخزني مستقلة في المرحلة 5.
                  </p>
                  <p>
                    • <strong>الحفظ التاريخي التام:</strong> فواتير المبيعات، حركات الصندوق، أرقام السيريال،
                    وتكاليف الشراء السابقة تظل منسوبة لمواقعها ومسؤوليها الأصليين ولن يتم تعديلها أو حذفها مطلقاً.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: EXPLICIT CONFIRMATION */}
          {/* ========================================================================= */}
          {step === 4 && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>الإقرار النهائي لعملية دمج الفروع</span>
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  أنت على وشك أرشفة الفروع المصدر المحددة ونقل جميع عضويات الشركاء والموظفين التابعين لها
                  إلى الفرع الموحد. لا يمكن التراجع التلقائي عن عملية الدمج بعد تنفيذها.
                </p>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    ملاحظات أو مبررات الدمج (اختياري، للتدقيق):
                  </label>
                  <textarea
                    rows={2}
                    value={mergeNotes}
                    onChange={e => setMergeNotes(e.target.value)}
                    placeholder="مثال: دمج فرعي محل 1 ومحل 2 تحت إدارة مشتركة بين الشركاء محمود مسعود وأيمن"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmedDisclaimer}
                      onChange={e => setConfirmedDisclaimer(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <span className="text-slate-200 font-semibold leading-relaxed">
                      أقر بأنني راجعت الشركاء والمواقع المتأثرة، وأدرك تماماً أن هذه العملية تعيد تنظيم الهيكل
                      الإداري فقط، وتُبقي المخزون والأجهزة مسجلة بمواقعها الأصلية دون نقل تلقائي.
                    </span>
                  </label>
                </div>
              </div>

              {executionError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs">
                  {executionError}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 5: COMPLETION */}
          {/* ========================================================================= */}
          {step === 5 && mergeResult && (
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">اكتملت عملية دمج الفروع بنجاح!</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                تم دمج الفروع المصدر بنجاح وأرشفتها، وتعيين جميع الشركاء والموظفين في الفرع الموحد:{' '}
                <strong className="text-emerald-400">{mergeResult.destinationStore.name}</strong>.
              </p>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400 inline-block font-mono">
                رقم العملية: {mergeResult.mergeId} • الفروع المدمجة: {mergeResult.mergedSourceStoreIds.length}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Navigation Buttons */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={selectedSourceIds.length < 1}
                onClick={() => setStep(2)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>التالي: اختيار الفرع الوجهة</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>السابق</span>
              </button>
              <button
                type="button"
                disabled={
                  previewLoading ||
                  (destinationMode === 'existing' && !selectedDestId) ||
                  (destinationMode === 'new' && (!newDestForm.code.trim() || !newDestForm.name.trim()))
                }
                onClick={handleProceedToPreview}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {previewLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جارٍ تحميل المعاينة...</span>
                  </>
                ) : (
                  <>
                    <span>التالي: معاينة التأثير</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>السابق</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span>المتابعة إلى التأكيد النهائي</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <button
                type="button"
                disabled={executing}
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowRight className="w-4 h-4" />
                <span>السابق</span>
              </button>
              <button
                type="button"
                disabled={!confirmedDisclaimer || executing}
                onClick={handleExecuteMerge}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جارٍ تنفيذ الدمج الذري...</span>
                  </>
                ) : (
                  <>
                    <GitMerge className="w-4 h-4" />
                    <span>تنفيذ واعتماد الدمج</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 5 && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                إغلاق وتحديث القائمة
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreMergeWizardModal;

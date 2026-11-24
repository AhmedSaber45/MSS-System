import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Spinner } from '@/components/common/Spinner';
import { formatCurrency } from '@/lib/utils';
import type { MSSCatalogModel } from '@/types/mssCatalog';
import type { MSSModelInventorySummary } from '@/types/mssInventory';
import { mssCatalogService } from '@/services/mssCatalogService';
import {
  extractModelSpecificationsAndNotes,
  type SpecItem,
  type SpecIconType,
} from '@/services/mssModelSpecsService';
import {
  Cpu,
  HardDrive,
  Monitor,
  Activity,
  FileText,
  Sparkles,
  Maximize2,
  Layers,
  Plug,
  Battery,
  Tv,
  CheckCircle2,
  Info,
  CircuitBoard,
} from 'lucide-react';
// Use closest appropriate graphics-card icon CircuitBoard available in installed Lucide library
const GpuIcon = CircuitBoard;

export interface MSSModelSpecsModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: MSSCatalogModel | null;
  summary?: MSSModelInventorySummary | null;
}

export type { SpecItem };
export { extractModelSpecificationsAndNotes };

function getSpecIcon(type?: SpecIconType): React.ReactNode {
  switch (type) {
    case 'cpu':
      return <Cpu className="w-4 h-4 text-blue-600" />;
    case 'ram':
      return <Layers className="w-4 h-4 text-violet-600" />;
    case 'storage':
      return <HardDrive className="w-4 h-4 text-amber-600" />;
    case 'gpu':
      return <GpuIcon className="w-4 h-4 text-pink-600" />;
    case 'monitor':
      return <Monitor className="w-4 h-4 text-cyan-600" />;
    case 'resolution':
      return <Maximize2 className="w-4 h-4 text-indigo-600" />;
    case 'refresh':
      return <Activity className="w-4 h-4 text-emerald-600" />;
    case 'panel':
      return <Layers className="w-4 h-4 text-cyan-600" />;
    case 'curvature':
      return <Tv className="w-4 h-4 text-purple-600" />;
    case 'brightness':
      return <Sparkles className="w-4 h-4 text-amber-600" />;
    case 'ports':
      return <Plug className="w-4 h-4 text-sky-600" />;
    case 'touch':
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    case 'battery':
      return <Battery className="w-4 h-4 text-emerald-600" />;
    case 'generic':
    default:
      return <Info className="w-4 h-4 text-slate-600" />;
  }
}

export const MSSModelSpecsModal: React.FC<MSSModelSpecsModalProps> = ({
  isOpen,
  onClose,
  model,
  summary,
}) => {
  const [resolvedModel, setResolvedModel] = useState<MSSCatalogModel | null>(model);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (model) {
      setResolvedModel(model);
      return;
    }
    if (isOpen && summary?.model_id) {
      setIsLoading(true);
      mssCatalogService
        .getModelById(summary.model_id)
        .then(m => {
          setResolvedModel(m);
        })
        .catch(err => {
          console.warn('Failed to load model details:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setResolvedModel(null);
    }
  }, [model, summary?.model_id, isOpen]);

  if (!isOpen) return null;

  const displayBrand = resolvedModel?.brand || summary?.brand || '';
  const displayName = resolvedModel?.model_name || summary?.model_name || 'موديل غير محدد';
  const displayCategory = resolvedModel?.category || summary?.category || 'أخرى';
  const displayCode = (resolvedModel as any)?.model_code || summary?.model_code || '';
  const listPrice = resolvedModel?.default_list_price || 0;

  const { specs, notes } = extractModelSpecificationsAndNotes(resolvedModel);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="مواصفات وملاحظات الموديل"
      subtitle={`${displayBrand} ${displayName}`}
      size="lg"
      footer={
        <Button variant="outline" size="sm" onClick={onClose} className="px-5 font-semibold text-xs">
          إغلاق
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Model Header Summary Box */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50/90 rounded-xl border border-slate-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base sm:text-lg font-bold text-slate-900">
                {displayBrand} {displayName}
              </span>
              {displayCode && (
                <span className="font-mono text-xs bg-slate-200/80 text-slate-800 px-2 py-0.5 rounded border border-slate-300">
                  {displayCode}
                </span>
              )}
              <Badge variant="default" size="sm">
                {displayCategory}
              </Badge>
            </div>
            {summary?.branch && (
              <p className="text-xs text-slate-500">
                الموقع / الفرع: <span className="font-semibold text-slate-700">{summary.branch}</span>
              </p>
            )}
          </div>

          {listPrice > 0 && (
            <div className="text-right bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg shrink-0">
              <span className="text-[10px] text-emerald-700 block font-medium">السعر الاسترشادي</span>
              <span className="font-bold text-sm text-emerald-900 font-mono">
                {formatCurrency(listPrice)}
              </span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
            <Spinner size="md" className="mx-auto mb-2 text-blue-600" />
            <p className="text-xs font-medium text-slate-600">جاري تحميل مواصفات الموديل...</p>
          </div>
        ) : specs.length === 0 && !notes ? (
          /* Empty State */
          <div className="p-8 text-center bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
            <Info className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-sm font-bold text-slate-700">
              مفيش مواصفات أو ملاحظات مسجلة للموديل ده
            </p>
            <p className="text-xs text-slate-500">
              يمكنك إضافة وتعديل المواصفات الفنية والملاحظات من خلال كتالوج الموديلات.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1. Specifications Grid */}
            {specs.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs pb-1 border-b border-slate-200">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>المواصفات الفنية للموديل ({specs.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {specs.map(s => (
                    <div
                      key={s.key}
                      className="p-2.5 bg-slate-50/90 hover:bg-slate-100/80 transition-colors rounded-lg border border-slate-200 flex items-start gap-2.5"
                    >
                      <div className="p-1.5 bg-white rounded-md border border-slate-200 shrink-0 mt-0.5 shadow-2xs">
                        {getSpecIcon(s.iconType)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] text-slate-500 block truncate font-medium">
                          {s.label}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-800 block break-words mt-0.5" dir="auto">
                          {s.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Notes Section (Visually distinct, only if notes exist) */}
            {notes && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs pb-1 border-b border-amber-200/80">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>الملاحظات والمواصفات الإضافية</span>
                </div>
                <div
                  className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto shadow-2xs"
                  dir="auto"
                >
                  {notes}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

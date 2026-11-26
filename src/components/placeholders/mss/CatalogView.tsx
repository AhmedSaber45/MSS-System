// Model creation and editing with (gpu, setGpu) handled in MSSModelModal
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { Pagination } from '@/components/common/Pagination';
import {
  Plus,
  Search,
  Laptop,
  Monitor,
  Store,
  Layers,
  Edit,
  Trash2,
  Cpu,
  Tv,
  LayoutGrid,
  List,
  RefreshCw,
  CircuitBoard,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { mssCatalogService } from '@/services/mssCatalogService.ts';
import { userPreferencesService, PREF_KEYS } from '@/services/userPreferencesService';
import { useMSSLocations } from '@/hooks/useMSSLocations';
import { MSSModelModal } from './MSSModelModal';
import { MSSDeviceCreationModal } from './MSSDeviceCreationModal';
import type {
  MSSCatalogModel,
  MSSModelAvailability,
} from '@/types/mssCatalog.ts';

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'ALL', label: 'الكل ' },
  { id: 'لابتوب', label: 'لابتوب' },
  { id: 'شاشة', label: 'شاشات' },
];

export const CatalogView: React.FC = () => {
  const { locations } = useMSSLocations();
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  const [models, setModels] = useState<MSSCatalogModel[]>([]);
  const [availability, setAvailability] = useState<Record<string, MSSModelAvailability>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() =>
    userPreferencesService.getEnum<'table' | 'cards'>(
      PREF_KEYS.MSS_CATALOG_VIEW_MODE,
      'table',
      ['table', 'cards']
    )
  );

  // Add / Edit Model Modal state
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [editingModel, setEditingModel] = useState<MSSCatalogModel | null>(null);

  // Add Device Modal state
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState<boolean>(false);

  // Delete Confirmation
  const [modelToDelete, setModelToDelete] = useState<MSSCatalogModel | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [modelsList, availMap] = await Promise.all([
        mssCatalogService.getModels(searchQuery, selectedCategory),
        mssCatalogService.getAvailabilityMap(),
      ]);
      setModels(modelsList);
      setAvailability(availMap);
    } catch (err) {
      console.warn('Failed to load catalog data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset pagination on search or category filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  const pagedModels = useMemo(() => {
    const total = models.length;
    const maxPage = Math.max(1, Math.ceil(total / 9));
    const safePage = Math.min(currentPage, maxPage);
    return models.slice((safePage - 1) * 9, safePage * 9);
  }, [models, currentPage]);

  // Open modal for new model
  const handleOpenAddModal = () => {
    setEditingModel(null);
    setIsModelModalOpen(true);
  };

  // Open modal for editing model
  const handleOpenEditModal = (model: MSSCatalogModel) => {
    setEditingModel(model);
    setIsModelModalOpen(true);
  };

  // Delete model
  const handleConfirmDelete = async () => {
    if (!modelToDelete) return;
    try {
      await mssCatalogService.deleteModel(modelToDelete.id);
      showNotification({
        type: 'success',
        title: 'تم حذف الموديل',
        message: `تم حذف الموديل ${modelToDelete.brand} ${modelToDelete.model_name} من الكتالوج`,
      });
      setModelToDelete(null);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل حذف الموديل',
        message: err.message || 'لا يمكن حذف الموديل لارتباطه بأجهزة في المخزن',
      });
    }
  };

  // KPI stats
  const stats = useMemo(() => {
    const totalCount = models.length;
    const laptops = models.filter(m => m.category === 'لابتوب').length;
    const monitors = models.filter(m => m.category === 'شاشة').length;

    let totalAvailShop1 = 0;
    let totalAvailShop2 = 0;
    const locationTotals: Record<string, number> = {};
    Object.values(availability).forEach(a => {
      totalAvailShop1 += a.available_shop1;
      totalAvailShop2 += a.available_shop2;
      const bAvail = (a as any).branch_availability;
      if (bAvail && typeof bAvail === 'object') {
        Object.entries(bAvail).forEach(([loc, cnt]) => {
          locationTotals[loc] = (locationTotals[loc] || 0) + (Number(cnt) || 0);
        });
      }
    });

    return { totalCount, laptops, monitors, totalAvailShop1, totalAvailShop2, locationTotals };
  }, [models, availability]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title=" موديلات الأجهزة"
        subtitle=""
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => triggerRefresh(loadData, 'جارٍ تحديث كتالوج الموديلات والمواصفات...')}
              disabled={isRefreshing || isLoading}
              leftIcon={<RefreshCw className={`w-4.5 h-4.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />}
              className="border-slate-300 font-semibold"
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsAddDeviceModalOpen(true)}
              leftIcon={<Laptop className="w-4.5 h-4.5 text-blue-600" />}
              className="border-slate-300 font-bold text-slate-800 hover:bg-slate-50"
            >
              إضافة جهاز جديد
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenAddModal}
              leftIcon={<Plus className="w-4.5 h-4.5" />}
              className="font-bold bg-blue-600 hover:bg-blue-700"
            >
              إضافة موديل جديد
            </Button>
          </div>
        }
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">إجمالي الموديلات</span>
            <Layers className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-2.5">{stats.totalCount}</p>
        </Card>

        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">موديلات اللابتوب</span>
            <Laptop className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-2.5">{stats.laptops}</p>
        </Card>

        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">موديلات الشاشات</span>
            <Monitor className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-2.5">{stats.monitors}</p>
        </Card>

        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">الأجهزة المتاحة بالفروع</span>
            <Store className="w-5 h-5 text-slate-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-2.5 flex-wrap">
            {locations.map((loc, locIdx) => {
              const count = stats.locationTotals[loc] ?? 0;
              return (
                <span
                  key={loc}
                  className={`text-base font-bold font-mono tabular-nums ${
                    locIdx % 2 === 0 ? 'text-blue-600' : 'text-emerald-600'
                  }`}
                >
                  {loc}: {count}
                </span>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4.5 h-4.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="البحث بالماركة، اسم الموديل، المعالج، كارت الشاشة..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>

          {/* Categories Tab Selector */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 gap-1 w-full md:w-auto justify-center">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedCategory === c.id
                    ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 gap-1">
            <button
              onClick={() => {
                setViewMode(
                  userPreferencesService.setEnum<'table' | 'cards'>(
                    PREF_KEYS.MSS_CATALOG_VIEW_MODE,
                    'table',
                    ['table', 'cards']
                  )
                );
              }}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-subtle border border-slate-300' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="عرض كجدول"
            >
              <List className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={() => {
                setViewMode(
                  userPreferencesService.setEnum<'table' | 'cards'>(
                    PREF_KEYS.MSS_CATALOG_VIEW_MODE,
                    'cards',
                    ['table', 'cards']
                  )
                );
              }}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-subtle border border-slate-300' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="عرض كبطاقات"
            >
              <LayoutGrid className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {isLoading ? (
        <Card className="p-16 text-center bg-white border-slate-300 shadow-2xs">
          <Spinner size="lg" className="mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">جاري تحميل بيانات الأجهزة والكتالوج ...</p>
        </Card>
      ) : models.length === 0 ? (
        <Card className="p-16 text-center space-y-3 bg-white border-slate-300 shadow-2xs">
          <Layers className="w-10 h-10 mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">لا توجد موديلات مطابقة للبحث</h3>
          <p className="text-sm text-slate-500">جرب البحث بكلمات أخرى أو أضف موديلاً جديداً للكتالوج.</p>
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenAddModal}
            leftIcon={<Plus className="w-4.5 h-4.5" />}
            className="font-bold bg-blue-600 hover:bg-blue-700"
          >
            إضافة موديل جديد الآن
          </Button>
        </Card>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="p-3.5">الماركة والموديل</th>
                  <th className="p-3.5">النوع</th>
                  <th className="p-3.5">المواصفات الأساسية (CPU / GPU / RAM / Storage)</th>
                  <th className="p-3.5">السعر الاسترشادي</th>
                  <th className="p-3.5 text-center">المتاح في الفروع</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {pagedModels.map(m => {
                  const avail = availability[m.id] || {
                    available_shop1: 0,
                    available_shop2: 0,
                    total_available: 0,
                    reserved_count: 0,
                  };

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          {m.category === 'لابتوب' ? (
                            <Laptop className="w-4.5 h-4.5 text-slate-500 shrink-0" />
                          ) : (
                            <Monitor className="w-4.5 h-4.5 text-slate-500 shrink-0" />
                          )}
                          <div>
                            <span className="font-bold text-slate-900 block">{m.brand} {m.model_name}</span>
                            {m.specifications && (
                              <span className="text-xs text-slate-500 block truncate max-w-xs">{m.specifications}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <Badge variant="default" size="sm">
                          {m.category}
                        </Badge>
                      </td>

                      <td className="p-3.5 text-xs text-slate-600 font-mono">
                        <div className="space-y-0.5">
                          {m.processor && <div>CPU: {m.processor}</div>}
                          {m.gpu && <div className="text-blue-700 font-bold">GPU: {m.gpu}</div>}
                          {(m.ram || m.storage) && (
                            <div>
                              {m.ram && `RAM: ${m.ram}`} {m.storage && `| Storage: ${m.storage}`}
                            </div>
                          )}
                          {m.screen_size && <div>Screen: {m.screen_size}</div>}
                          {!m.processor && !m.gpu && !m.ram && !m.storage && <span className="text-slate-400">غير محدد</span>}
                        </div>
                      </td>

                      <td className="p-3.5 font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrency(m.default_list_price)}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="inline-flex items-center gap-2 font-mono text-xs font-bold flex-wrap justify-center">
                          {locations.map((loc, locIdx) => {
                            const count = (avail as any).branch_availability?.[loc] ?? 0;
                            return (
                              <span
                                key={loc}
                                className={`px-2 py-0.5 rounded border ${
                                  count > 0
                                    ? locIdx % 2 === 0
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}
                                title={`المتاح في ${loc}`}
                              >
                                {loc}: {count}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditModal(m)}
                            className="text-slate-600 hover:text-blue-600 h-8 px-2"
                            title="تعديل الموديل"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setModelToDelete(m)}
                            className="text-slate-600 hover:text-rose-600 h-8 px-2"
                            title="حذف الموديل"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedModels.map(m => {
            const avail = availability[m.id] || {
              available_shop1: 0,
              available_shop2: 0,
              total_available: 0,
              reserved_count: 0,
            };

            return (
              <Card key={m.id} className="p-4 bg-white border-slate-300 shadow-2xs hover:shadow-subtle transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {m.category === 'لابتوب' ? (
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                          <Laptop className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                          <Monitor className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{m.brand} {m.model_name}</h4>
                        <Badge variant="default" size="sm" className="mt-1">
                          {m.category}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(m)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setModelToDelete(m)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Specs List */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 text-xs text-slate-600 font-mono mb-3">
                    {m.processor && (
                      <div className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{m.processor}</span>
                      </div>
                    )}
                    {m.gpu && (
                      <div className="flex items-center gap-1.5 text-blue-700 font-bold">
                        <CircuitBoard className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{m.gpu}</span>
                      </div>
                    )}
                    {(m.ram || m.storage) && (
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{m.ram} | {m.storage}</span>
                      </div>
                    )}
                    {m.screen_size && (
                      <div className="flex items-center gap-1.5">
                        <Tv className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{m.screen_size}</span>
                      </div>
                    )}
                    {m.specifications && (
                      <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200">
                        {m.specifications}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">السعر الاسترشادي:</span>
                    <strong className="text-slate-900 font-bold font-mono text-sm">{formatCurrency(m.default_list_price)}</strong>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold flex-wrap justify-end">
                    {locations.map(loc => {
                      const count = (avail as any).branch_availability?.[loc] || 0;
                      return (
                        <span key={loc} className="px-2 py-0.5 rounded border bg-slate-100 text-slate-800 border-slate-300" title={`المتاح في ${loc}`}>
                          {loc}: {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {models.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-300 p-2 shadow-2xs">
          <Pagination
            currentPage={currentPage}
            totalItems={models.length}
            pageSize={9}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Add / Edit Model Modal */}
      <MSSModelModal
        isOpen={isModelModalOpen}
        onClose={() => {
          setIsModelModalOpen(false);
          setEditingModel(null);
        }}
        modelToEdit={editingModel}
        onSuccess={() => loadData()}
      />

      {/* Add New Device Modal from Devices Page */}
      <MSSDeviceCreationModal
        isOpen={isAddDeviceModalOpen}
        onClose={() => setIsAddDeviceModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* Delete Confirmation Modal */}
      {modelToDelete && (
        <Modal
          isOpen={!!modelToDelete}
          onClose={() => setModelToDelete(null)}
          title="تأكيد حذف الموديل  "
          subtitle="هل أنت متأكد من رغبتك في حذف هذا الموديل؟"
          size="sm"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="md" onClick={() => setModelToDelete(null)} className="border-slate-300 font-semibold">
                إلغاء
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleConfirmDelete}
                className="font-bold"
              >
                تأكيد الحذف
              </Button>
            </div>
          }
        >
          <div className="text-sm space-y-2">
            <p className="text-slate-800">
              سيتم حذف الموديل <strong>{modelToDelete.brand} {modelToDelete.model_name}</strong> من الكتالوج.
            </p>
            <p className="text-slate-500 text-xs">
              ملاحظة: ممنوع   حذف أي موديل إذا كان مسجلاً له أجهزة فعلية في المخزن لحماية سلامة البيانات.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};

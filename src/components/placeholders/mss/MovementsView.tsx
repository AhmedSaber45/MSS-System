import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';
import { Spinner } from '@/components/common/Spinner';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { useAuth } from '@/context/AuthContext';
import { mssInventoryService } from '@/services/mssInventoryService';
import { mssCatalogService } from '@/services/mssCatalogService';
import { mssOperationalService } from '@/services/mssOperationalService';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useDateRangeFilter } from '@/lib/dateValidation';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import type { MSSDeviceMovement, MSSDevice, MSSStockLocation } from '@/types/mssInventory';
import type { MSSCatalogModel } from '@/types/mssCatalog';
import type {
  InventoryTransfer,
  TransferType,
  TransferPreviewResponse,
  ExecuteTransferResult,
  SystemStore,
} from '@/types/mssOperational';
import {
  Plus,
  Search,
  ArrowLeftRight,
  Store,
  History,
  CheckCircle2,
  RefreshCw,
  Eye,
  Boxes,
  ShieldCheck,
  CheckSquare,
  Square,
  ArrowRight,
  ArrowLeft,
  FileText,
  AlertTriangle,
  Layers,
} from 'lucide-react';

export const MovementsView: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  // Tab State: 'transfers' (Batches) vs 'movements' (Individual Device Log)
  const [activeTab, setActiveTab] = useState<'transfers' | 'movements'>('transfers');

  // Data States
  const [movements, setMovements] = useState<MSSDeviceMovement[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [availableDevices, setAvailableDevices] = useState<MSSDevice[]>([]);
  const [catalogModels, setCatalogModels] = useState<MSSCatalogModel[]>([]);
  const [systemStores, setSystemStores] = useState<SystemStore[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const dateFilter = useDateRangeFilter();

  // Selected Transfer for Details Modal
  const [selectedTransfer, setSelectedTransfer] = useState<InventoryTransfer | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);

  // Transfer Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [wizardSource, setWizardSource] = useState<string>('محل 1');
  const [wizardDest, setWizardDest] = useState<string>('محل 2');
  const [wizardType, setWizardType] = useState<TransferType>('INDIVIDUAL');
  const [wizardSelectedIds, setWizardSelectedIds] = useState<string[]>([]);
  const [wizardModelId, setWizardModelId] = useState<string>('');
  const [wizardNotes, setWizardNotes] = useState<string>('تحويل مخزون تشغيلي');
  const [wizardPreview, setWizardPreview] = useState<TransferPreviewResponse | null>(null);
  const [wizardResult, setWizardResult] = useState<ExecuteTransferResult | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Device search in wizard
  const [wizardDeviceSearch, setWizardDeviceSearch] = useState<string>('');

  const actor = useMemo(() => {
    return {
      id: user?.id || 'admin',
      username: user?.username || 'admin',
    };
  }, [user]);

  // Load All Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [movList, devList, trfRes, models, stores] = await Promise.all([
        mssInventoryService.getMovements(),
        mssInventoryService.getDevices(),
        mssOperationalService.getTransferHistory({ limit: 100 }),
        mssCatalogService.getModels(),
        mssOperationalService.getStores({ includeArchived: false }),
      ]);
      setMovements(movList);
      setAvailableDevices(devList);
      setTransfers(trfRes.transfers);
      setCatalogModels(models);
      setSystemStores(stores);
    } catch (err: any) {
      console.warn('Failed to load transfers/movements data:', err);
      showNotification({
        type: 'error',
        title: 'خطأ في جلب السجلات',
        message: err.message || 'تعذر تحميل سجلات حركات وتحويلات الأجهزة',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Transfer Wizard
  const handleOpenWizard = (preselectedIds?: string[], preselectedSource?: string) => {
    setWizardStep(1);
    const sourceLoc = preselectedSource || (systemStores[0]?.name || 'محل 1');
    const destLoc = systemStores[1]?.name || 'محل 2';
    setWizardSource(sourceLoc);
    setWizardDest(destLoc);
    setWizardType(preselectedIds && preselectedIds.length > 0 ? 'SELECTED' : 'INDIVIDUAL');
    setWizardSelectedIds(preselectedIds || []);
    setWizardModelId('');
    setWizardNotes('تحويل مخزون لتلبية احتياجات الفروع');
    setWizardPreview(null);
    setWizardResult(null);
    setWizardDeviceSearch('');
    setIsWizardOpen(true);
  };

  // Open Details Modal
  const handleOpenTransferDetails = async (trf: InventoryTransfer) => {
    setSelectedTransfer(trf);
    setIsDetailsModalOpen(true);
    try {
      const full = await mssOperationalService.getTransferDetails(trf.id);
      if (full) setSelectedTransfer(full);
    } catch {
      // Fallback
    }
  };

  // Wizard: Calculate Preview
  const handleCalculatePreview = async () => {
    if (!wizardSource || !wizardDest) {
      showNotification({
        type: 'warning',
        title: 'تحديد المواقع',
        message: 'يجب اختيار موقع المصدر وموقع الوجهة',
      });
      return;
    }
    if (wizardSource === wizardDest) {
      showNotification({
        type: 'warning',
        title: 'المواقع متطابقة',
        message: 'لا يمكن نقل المخزون إلى نفس الموقع الحالي',
      });
      return;
    }

    try {
      const preview = await mssOperationalService.previewInventoryTransfer({
        sourceLocation: wizardSource,
        destinationLocation: wizardDest,
        transferType: wizardType,
        deviceIds: wizardSelectedIds,
        modelId: wizardModelId || undefined,
        allEligible: wizardType === 'ALL_ELIGIBLE',
      });
      setWizardPreview(preview);
      setWizardStep(3);
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في التحقق من النقل',
        message: err.message || 'فشل حساب معاينة النقل',
      });
    }
  };

  // Wizard: Execute Transfer
  const handleExecuteTransfer = async () => {
    if (!wizardPreview || !wizardPreview.canTransfer) return;

    setIsExecuting(true);
    try {
      const result = await mssOperationalService.executeInventoryTransfer(
        {
          sourceLocation: wizardSource,
          destinationLocation: wizardDest,
          transferType: wizardType,
          deviceIds: wizardPreview.eligibleDevices.map(d => d.id),
          modelId: wizardModelId || undefined,
          allEligible: wizardType === 'ALL_ELIGIBLE',
          notes: wizardNotes.trim() || undefined,
          confirmed: true,
        },
        actor
      );

      setWizardResult(result);
      setWizardStep(6);
      showNotification({
        type: 'success',
        title: 'تم تنفيذ التحويل بنجاح',
        message: result.message,
      });
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل التحويل',
        message: err.message || 'حدث خطأ أثناء تنفيذ عملية التحويل',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Filtered Transfer Batches
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.referenceNumber.toLowerCase().includes(q) ||
        t.sourceLocation.toLowerCase().includes(q) ||
        t.destinationLocation.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q));

      const matchesLocation =
        locationFilter === 'ALL' ||
        t.sourceLocation === locationFilter ||
        t.destinationLocation === locationFilter;

      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesLocation && matchesStatus;
    });
  }, [transfers, searchQuery, locationFilter, statusFilter]);

  // Filtered Individual Movements
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const matchesLocation =
        locationFilter === 'ALL' ||
        m.from_location === locationFilter ||
        m.to_location === locationFilter;

      if (dateFilter.startDate && m.movement_date < dateFilter.startDate) return false;
      if (dateFilter.endDate && m.movement_date.split('T')[0] > dateFilter.endDate) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          m.serial_number.toLowerCase().includes(q) ||
          (m.model_name && m.model_name.toLowerCase().includes(q)) ||
          (m.brand && m.brand.toLowerCase().includes(q)) ||
          (m.notes && m.notes.toLowerCase().includes(q))
        );
      }
      return matchesLocation;
    });
  }, [movements, locationFilter, dateFilter.startDate, dateFilter.endDate, searchQuery]);

  // Source devices for Wizard Step 2
  const wizardSourceDevices = useMemo(() => {
    return availableDevices.filter(d => d.stock_location === wizardSource);
  }, [availableDevices, wizardSource]);

  const filteredWizardSourceDevices = useMemo(() => {
    if (!wizardDeviceSearch.trim()) return wizardSourceDevices;
    const q = wizardDeviceSearch.trim().toLowerCase();
    return wizardSourceDevices.filter(
      d =>
        d.serial_number.toLowerCase().includes(q) ||
        (d.model_name && d.model_name.toLowerCase().includes(q)) ||
        (d.brand && d.brand.toLowerCase().includes(q))
    );
  }, [wizardSourceDevices, wizardDeviceSearch]);

  // KPIs
  const kpis = useMemo(() => {
    const totalTransfers = transfers.length;
    const completedTransfers = transfers.filter(t => t.status === 'COMPLETED').length;
    const totalUnitsTransferred = transfers
      .filter(t => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + (t.itemCount || 0), 0);
    const totalValuation = transfers
      .filter(t => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + (t.totalCost || 0), 0);

    return { totalTransfers, completedTransfers, totalUnitsTransferred, totalValuation };
  }, [transfers]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="تحويلات وحركات المخزون "
        subtitle=""
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => triggerRefresh(loadData, 'جارٍ تحديث التحويلات والحركات...')}
              disabled={isRefreshing || isLoading}
              leftIcon={<RefreshCw className={`w-4.5 h-4.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => handleOpenWizard()}
              leftIcon={<ArrowLeftRight className="w-4.5 h-4.5" />}
              className="font-bold"
            >
              تحويل أجهزة جديدة
            </Button>
          </div>
        }
      />


      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">إجمالي عمليات التحويل</span>
            <ArrowLeftRight className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 mt-2">{kpis.totalTransfers}</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600">التحويلات المكتملة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black font-mono text-emerald-800 mt-2">{kpis.completedTransfers}</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600">الأجهزة المنقولة بنجاح</span>
            <Boxes className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black font-mono text-indigo-800 mt-2">{kpis.totalUnitsTransferred} جهاز</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">القيمة التقديرية للمنقولات</span>
            <ShieldCheck className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 mt-2">
            {formatCurrency(kpis.totalValuation)}
          </p>
        </Card>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'transfers'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>سجل  التحويل ({transfers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'movements'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>حركات الأجهزة الفردية ({movements.length})</span>
        </button>
      </div>

      {/* Filters Bar */}
      <Card className="p-3 bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={
                activeTab === 'transfers'
                  ? 'البحث برقم التحويل المرجعي أو الموقع أو الملاحظات...'
                  : 'البحث بالسيريال أو الموديل أو الملاحظات...'
              }
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-9 text-xs"
            />
          </div>

          <div className="w-full md:w-48">
            <Select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'كافة المواقع' },
                ...systemStores.map(s => ({ value: s.name, label: s.name })),
              ]}
              className="text-xs"
            />
          </div>

          {activeTab === 'movements' && (
            <div className="w-full md:w-auto">
              <DateRangeInputs
                startDate={dateFilter.startDate}
                endDate={dateFilter.endDate}
                onStartDateChange={dateFilter.setStartDate}
                onEndDateChange={dateFilter.setEndDate}
                onClear={dateFilter.clearDateRange}
              />
            </div>
          )}
        </div>
      </Card>

      {/* TAB 1: Transfer Batches Table */}
      {activeTab === 'transfers' && (
        <Card className="border border-slate-200 bg-white overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
              <Spinner size="lg" />
              <p className="text-xs">جارٍ تحميل سجلات التحويلات...</p>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="p-8 text-center">
              <ArrowLeftRight className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">لا توجد عمليات تحويل مسجلة</h3>
              <p className="text-xs text-slate-500 mt-1">
                يمكنك بدء تحويل أجهزة جديد بالنقر على &quot;تحويل أجهزة جديدة&quot;.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">الرقم المرجعي</th>
                    <th className="py-3 px-3.5">من الموقع (المصدر)</th>
                    <th className="py-3 px-3.5">إلى الموقع (الوجهة)</th>
                    <th className="py-3 px-3.5 text-center">عدد الأجهزة</th>
                    <th className="py-3 px-3.5">إجمالي التكلفة</th>
                    <th className="py-3 px-3.5">التاريخ والوقت</th>
                    <th className="py-3 px-3.5">الحالة</th>
                    <th className="py-3 px-3.5 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredTransfers.map(trf => (
                    <tr key={trf.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5">
                        <span className="font-mono font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {trf.referenceNumber}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        <span className="font-bold text-slate-800">{trf.sourceLocation}</span>
                      </td>

                      <td className="py-3 px-3.5">
                        <span className="font-bold text-slate-800">{trf.destinationLocation}</span>
                      </td>

                      <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-900">
                        {trf.itemCount} جهاز
                      </td>

                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrency(trf.totalCost)}
                      </td>

                      <td className="py-3 px-3.5 font-mono text-slate-600 text-[11px]" dir="ltr">
                        {formatDate(trf.createdAt)}
                      </td>

                      <td className="py-3 px-3.5">
                        <Badge
                          variant={trf.status === 'COMPLETED' ? 'success' : 'warning'}
                          size="sm"
                          className="font-semibold"
                        >
                          {trf.status === 'COMPLETED' ? 'مكتمل بنجاح' : trf.status}
                        </Badge>
                      </td>

                      <td className="py-3 px-3.5 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenTransferDetails(trf)}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                          className="text-[11px]"
                        >
                          عرض الإيصال
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: Individual Movements Log Table */}
      {activeTab === 'movements' && (
        <Card className="border border-slate-200 bg-white overflow-hidden shadow-xs">
          {filteredMovements.length === 0 ? (
            <div className="p-8 text-center text-slate-500">لا توجد حركات مطابقة</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">السيريال والموديل</th>
                    <th className="py-3 px-3.5">الموقع السابق</th>
                    <th className="py-3 px-3.5">الموقع الحالي</th>
                    <th className="py-3 px-3.5">تاريخ النقل</th>
                    <th className="py-3 px-3.5">البيان والسبب</th>
                    <th className="py-3 px-3.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredMovements.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5">
                        <span className="font-mono font-bold text-slate-900 block">{m.serial_number}</span>
                        {m.model_name && <span className="text-[11px] text-slate-500">{m.brand} {m.model_name}</span>}
                      </td>

                      <td className="py-3 px-3.5 font-bold text-slate-700">{m.from_location}</td>
                      <td className="py-3 px-3.5 font-bold text-emerald-800">{m.to_location}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-600 text-[11px]" dir="ltr">
                        {formatDate(m.movement_date)}
                      </td>
                      <td className="py-3 px-3.5 text-slate-700">{m.notes || 'نقل مادي بين المقرات'}</td>
                      <td className="py-3 px-3.5">
                        <Badge variant="success" size="sm">مكتمل</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Transfer Details Modal (Receipt) */}
      {isDetailsModalOpen && selectedTransfer && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`إيصال تحويل مخزون: ${selectedTransfer.referenceNumber}`}
          subtitle={`من: ${selectedTransfer.sourceLocation} ➔ إلى: ${selectedTransfer.destinationLocation}`}
          size="lg"
          footer={
            <div className="flex justify-between items-center w-full">
              <span className="text-slate-500 text-xs font-mono">
                المنفذ: {selectedTransfer.createdByUsername} ({formatDate(selectedTransfer.createdAt)})
              </span>
              <Button variant="outline" size="md" onClick={() => setIsDetailsModalOpen(false)}>
                إغلاق
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Header Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-slate-400 block text-[10px]">الرقم المرجعي:</span>
                <span className="font-mono font-bold text-blue-800 select-all">{selectedTransfer.referenceNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">إجمالي القطع:</span>
                <span className="font-mono font-bold text-slate-900">{selectedTransfer.itemCount} جهاز</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">قيمة التكلفة :</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(selectedTransfer.totalCost)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">الحالة:</span>
                <Badge variant={selectedTransfer.status === 'COMPLETED' ? 'success' : 'warning'} size="sm">
                  {selectedTransfer.status === 'COMPLETED' ? 'مكتمل وموثق' : selectedTransfer.status}
                </Badge>
              </div>
            </div>

            {selectedTransfer.notes && (
              <p className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg text-blue-900">
                <strong>ملاحظات التحويل:</strong> {selectedTransfer.notes}
              </p>
            )}

            {/* Devices Items Table */}
            <div>
              <h4 className="font-bold text-slate-800 mb-2">الأجهزة  المنقولة بالعملية:</h4>
              {selectedTransfer.items && selectedTransfer.items.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">السيريال</th>
                        <th className="py-2 px-3">الموديل</th>
                        <th className="py-2 px-3">تكلفة الشراء</th>
                        <th className="py-2 px-3">الحالة السابقة</th>
                        <th className="py-2 px-3">الحالة الناتجة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedTransfer.items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{item.serialNumber}</td>
                          <td className="py-2 px-3 text-slate-700">{item.modelName || 'جهاز لابتوب / شاشة'}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            {formatCurrency(item.purchaseCostSnapshot)}
                          </td>
                          <td className="py-2 px-3 text-slate-500">{item.previousStatus}</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">{item.resultingStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 italic p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  تم تسجيل العملية وتحديث المواقع لكافة الأجهزة بنجاح.
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 6-Step Transfer Wizard Modal */}
      {isWizardOpen && (
        <Modal
          isOpen={isWizardOpen}
          onClose={() => !isExecuting && setIsWizardOpen(false)}
          title="معالج تحويل المخزون الإرشادي (Guided Transfer Wizard)"
          subtitle=""
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              {wizardStep > 1 && wizardStep < 6 ? (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setWizardStep((wizardStep - 1) as any)}
                  disabled={isExecuting}
                  leftIcon={<ArrowRight className="w-4 h-4" />}
                >
                  السابق
                </Button>
              ) : (
                <div />
              )}

              {wizardStep === 1 && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (wizardSource === wizardDest) {
                      showNotification({
                        type: 'warning',
                        title: 'المواقع متطابقة',
                        message: 'يجب اختيار موقع مصدر مختلف عن موقع الوجهة.',
                      });
                      return;
                    }
                    setWizardStep(2);
                  }}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  className="font-bold"
                >
                  التالي: اختيار الأجهزة
                </Button>
              )}

              {wizardStep === 2 && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCalculatePreview}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  className="font-bold"
                >
                  التالي: معاينة التحويل
                </Button>
              )}

              {wizardStep === 3 && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setWizardStep(4)}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  className="font-bold"
                >
                  التالي: شروط الأمان
                </Button>
              )}

              {wizardStep === 4 && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setWizardStep(5)}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  className="font-bold"
                >
                  التالي: التأكيد والتنفيذ
                </Button>
              )}

              {wizardStep === 5 && (
                <Button
                  variant="danger"
                  size="md"
                  onClick={handleExecuteTransfer}
                  disabled={isExecuting}
                  leftIcon={isExecuting ? <Spinner size="sm" /> : <ArrowLeftRight className="w-4 h-4" />}
                  className="font-bold"
                >
                  {isExecuting ? 'جارٍ التحويل ...' : 'تأكيد وتنفيذ النقل '}
                </Button>
              )}

              {wizardStep === 6 && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setIsWizardOpen(false)}
                  className="font-bold"
                >
                  إغلاق 
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Step Indicator */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              {[
                { s: 1, title: 'المواقع' },
                { s: 2, title: 'الأجهزة' },
                { s: 3, title: 'المعاينة' },
                { s: 4, title: 'الأمان' },
                { s: 5, title: 'التنفيذ' },
                { s: 6, title: 'النتيجة' },
              ].map(item => (
                <div
                  key={item.s}
                  className={`flex items-center gap-1 font-bold ${
                    wizardStep === item.s
                      ? 'text-blue-700'
                      : wizardStep > item.s
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                      wizardStep === item.s
                        ? 'bg-blue-600 text-white'
                        : wizardStep > item.s
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {item.s}
                  </span>
                  <span>{item.title}</span>
                </div>
              ))}
            </div>

            {/* Step 1: Select Locations */}
            {wizardStep === 1 && (
              <div className="space-y-3.5">
                <Alert variant="info" title="الخطوة 1: حدد موقع المصدر وموقع الوجهة">
                  اختر الفرع أو المخزن الذي ستخرج منه الأجهزة، والموقع المستلم الذي ستنقل إليه.
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      موقع المصدر (حيث تتواجد الأجهزة حالياً):
                    </label>
                    <Select
                      value={wizardSource}
                      onChange={e => setWizardSource(e.target.value)}
                      options={systemStores.map(s => ({ value: s.name, label: `${s.name} (${s.code}) - ${s.type}` }))}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      موقع الوجهة (المستلم للأجهزة):
                    </label>
                    <Select
                      value={wizardDest}
                      onChange={e => setWizardDest(e.target.value)}
                      options={systemStores.map(s => ({ value: s.name, label: `${s.name} (${s.code}) - ${s.type}` }))}
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
                  <span className="font-bold text-slate-800 block mb-1">إحصائية موقع المصدر المحدد:</span>
                  <span>يتواجد حالياً في ({wizardSource}): </span>
                  <strong className="font-mono text-slate-900">{wizardSourceDevices.length} جهاز</strong>
                  <span> (منها {wizardSourceDevices.filter(d => d.status === 'AVAILABLE').length} جهاز متاح للنقل).</span>
                </div>
              </div>
            )}

            {/* Step 2: Choose Transfer Mode & Pick Devices */}
            {wizardStep === 2 && (
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">نوع عملية التحويل:</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { id: 'INDIVIDUAL', label: 'جهاز فردي' },
                      { id: 'SELECTED', label: 'أجهزة متعددة محددة' },
                      { id: 'MODEL_GROUP', label: 'موديل كامل' },
                      { id: 'ALL_ELIGIBLE', label: 'كل المتاح بالموقع' },
                    ].map(opt => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => setWizardType(opt.id as any)}
                        className={`p-2.5 rounded-lg border text-center font-bold text-xs transition-all ${
                          wizardType === opt.id
                            ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* If Model Group, show model dropdown */}
                {wizardType === 'MODEL_GROUP' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">اختر الموديل لنقل أجهزته المتاحة:</label>
                    <Select
                      value={wizardModelId}
                      onChange={e => setWizardModelId(e.target.value)}
                      options={[
                        { value: '', label: '-- اختر الموديل --' },
                        ...catalogModels.map(m => ({
                          value: m.id,
                          label: `${m.brand} ${m.model_name} (${m.category})`,
                        })),
                      ]}
                    />
                  </div>
                )}

                {/* If Individual or Selected, show devices picker table */}
                {(wizardType === 'INDIVIDUAL' || wizardType === 'SELECTED') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">
                        اختر الأجهزة من ({wizardSource}) [المحدد: {wizardSelectedIds.length}]:
                      </span>
                      {wizardType === 'SELECTED' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const availIds = filteredWizardSourceDevices
                                .filter(d => d.status === 'AVAILABLE')
                                .map(d => d.id);
                              setWizardSelectedIds(availIds);
                            }}
                            className="text-blue-700 hover:underline font-bold text-[11px]"
                          >
                            تحديد كل المتاح 
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => setWizardSelectedIds([])}
                            className="text-slate-500 hover:underline text-[11px]"
                          >
                            إلغاء التحديد
                          </button>
                        </div>
                      )}
                    </div>

                    <Input
                      placeholder="بحث بالسيريال أو الموديل..."
                      value={wizardDeviceSearch}
                      onChange={e => setWizardDeviceSearch(e.target.value)}
                      className="text-xs"
                    />

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-slate-100">
                      {filteredWizardSourceDevices.length === 0 ? (
                        <p className="p-4 text-center text-slate-400">لا توجد أجهزة متطابقة في هذا الموقع</p>
                      ) : (
                        filteredWizardSourceDevices.map(d => {
                          const checked = wizardSelectedIds.includes(d.id);
                          const isAvail = d.status === 'AVAILABLE';
                          return (
                            <label
                              key={d.id}
                              className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                                checked ? 'bg-blue-50/80' : isAvail ? 'hover:bg-slate-50' : 'bg-slate-50 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type={wizardType === 'INDIVIDUAL' ? 'radio' : 'checkbox'}
                                  name="wizard_dev_select"
                                  checked={checked}
                                  onChange={() => {
                                    if (wizardType === 'INDIVIDUAL') {
                                      setWizardSelectedIds([d.id]);
                                    } else {
                                      setWizardSelectedIds(prev =>
                                        prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id]
                                      );
                                    }
                                  }}
                                  className="rounded border-slate-300 text-blue-600"
                                />
                                <div>
                                  <span className="font-mono font-bold text-slate-900 block">{d.serial_number}</span>
                                  <span className="text-[11px] text-slate-500">{d.brand} {d.model_name}</span>
                                </div>
                              </div>
                              <div className="text-left font-mono">
                                <span className="font-bold text-slate-800 block text-xs">{formatCurrency(d.purchase_cost)}</span>
                                <Badge variant={isAvail ? 'success' : 'warning'} size="sm">
                                  {d.status}
                                </Badge>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* If All Eligible */}
                {wizardType === 'ALL_ELIGIBLE' && (
                  <Alert variant="warning" title="نقل شامل لكل الأجهزة المتاحة:">
                    سيتم نقل جميع الأجهزة التي حالتها AVAILABLE فقط من ({wizardSource}) إلى ({wizardDest}). الأجهزة المحجوزة أو المباعة سيتم استبعادها تلقائياً لحمايتها.
                  </Alert>
                )}
              </div>
            )}

            {/* Step 3: Authoritative Preview */}
            {wizardStep === 3 && wizardPreview && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <span className="text-slate-400 block text-[10px]">الأجهزة المؤهلة للنقل:</span>
                    <span className="font-mono font-bold text-emerald-700 text-base">
                      {wizardPreview.totalEligibleCount} جهاز
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">الأجهزة المستبعدة (غير مؤهلة):</span>
                    <span className="font-mono font-bold text-rose-600 text-base">
                      {wizardPreview.totalIneligibleCount} جهاز
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">إجمالي تكلفة الشراء للمنقولات:</span>
                    <span className="font-mono font-bold text-slate-900 text-base">
                      {formatCurrency(wizardPreview.totalEligibleCost)}
                    </span>
                  </div>
                </div>

                {/* Ineligible List if any */}
                {wizardPreview.ineligibleDevices.length > 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                    <span className="font-bold text-rose-800 block">
                      أجهزة مستبعدة تلقائياً   ({wizardPreview.ineligibleDevices.length}):
                    </span>
                    <div className="max-h-28 overflow-y-auto text-[11px] divide-y divide-rose-100">
                      {wizardPreview.ineligibleDevices.map(idv => (
                        <div key={idv.id} className="py-1 flex items-center justify-between text-rose-900">
                          <span className="font-mono font-bold">{idv.serial_number}</span>
                          <span>السبب: {idv.reason} ({idv.status})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validation Errors */}
                {wizardPreview.validationErrors && wizardPreview.validationErrors.length > 0 && (
                  <Alert variant="error" title="تنبيهات تمنع إتمام النقل:">
                    <ul className="list-disc pr-4 space-y-0.5">
                      {wizardPreview.validationErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </Alert>
                )}
              </div>
            )}

            {/* Step 4: Safety & Accounting Rules */}
            {wizardStep === 4 && (
              <div className="space-y-3">



                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    ملاحظات أو سبب التحويل (اختياري):
                  </label>
                  <Input
                    value={wizardNotes}
                    onChange={e => setWizardNotes(e.target.value)}
                    placeholder="مثال: نقل لتجهيز طلبيات عملاء في فرع الجيزة..."
                  />
                </div>
              </div>
            )}

            {/* Step 5: Final Execution Confirmation */}
            {wizardStep === 5 && wizardPreview && (
              <div className="space-y-3 text-center py-4">
                <ArrowLeftRight className="w-12 h-12 text-blue-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">هل أنت متأكد من تنفيذ هذا التحويل؟</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  سيتم نقل <strong className="font-mono text-blue-800">{wizardPreview.totalEligibleCount} جهاز</strong> بقيمة تكلفة إجمالية <strong className="font-mono text-slate-900">{formatCurrency(wizardPreview.totalEligibleCost)}</strong> من <strong>({wizardSource})</strong> إلى <strong>({wizardDest})</strong>.
                </p>
              </div>
            )}

            {/* Step 6: Success Result */}
            {wizardStep === 6 && wizardResult && (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">تم تنفيذ التحويل بنجاح!</h3>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 max-w-sm mx-auto space-y-1">
                  <div>
                    <span className="text-emerald-700 text-[10px]">الرقم المرجعي:</span>
                    <p className="font-mono font-bold text-sm select-all">{wizardResult.referenceNumber}</p>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-emerald-200">
                    <span>عدد القطع: {wizardResult.itemCount} جهاز</span>
                    <span className="font-mono">{formatCurrency(wizardResult.totalCost)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { Alert } from '@/components/common/Alert';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { useAuth } from '@/context/AuthContext';
import { mssOperationalService } from '@/services/mssOperationalService';
import { generateBranchCode } from '@/lib/branchCodeGenerator';
import { formatDate } from '@/lib/utils';
import type {
  SystemStore,
  StoreType,
  CreateStoreInput,
  StoreMergeImpactPreview,
} from '@/types/mssOperational';
import {
  Store,
  Warehouse,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Power,
  Archive,
  Users,
  GitMerge,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Building,
  Phone,
  MapPin,
  Layers,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';

export const MSSStoresView: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  const [stores, setStores] = useState<SystemStore[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
  const [selectedStore, setSelectedStore] = useState<SystemStore | null>(null);

  // Form states (Add / Edit)
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState<boolean>(false);
  const [formType, setFormType] = useState<StoreType>('store');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Partner Assignment state in Details Modal
  const [assignUserId, setAssignUserId] = useState<string>('');
  const [assignIsPrimary, setAssignIsPrimary] = useState<boolean>(false);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Archive Confirmation Modal State
  const [storeToArchive, setStoreToArchive] = useState<SystemStore | null>(null);
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  // Merge Wizard State
  const [mergeStep, setMergeStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [mergeDestinationId, setMergeDestinationId] = useState<string>('');
  const [mergeNotes, setMergeNotes] = useState<string>('');
  const [mergePreview, setMergePreview] = useState<StoreMergeImpactPreview | null>(null);
  const [isMerging, setIsMerging] = useState<boolean>(false);

  const actor = useMemo(() => {
    return {
      id: user?.id || 'admin',
      username: user?.username || 'admin',
    };
  }, [user]);

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mssOperationalService.getStores({
        search: searchQuery,
        type: typeFilter as any,
        status: statusFilter,
        includeArchived: true,
      });
      setStores(data);
    } catch (err: any) {
      console.warn('Failed to load stores:', err);
      showNotification({
        type: 'error',
        title: 'خطأ في جلب الفروع',
        message: err.message || 'تعذر تحميل بيانات الفروع والمخازن',
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, typeFilter, statusFilter, showNotification]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormCode('');
    setIsCodeManuallyEdited(false);
    setFormName('');
    setFormType('store');
    setFormDescription('');
    setFormAddress('');
    setFormPhone('');
    setIsAddModalOpen(true);
  };

  // Name change in Add modal with automatic code generation
  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!isCodeManuallyEdited) {
      const generated = generateBranchCode(name, stores.map(s => s.code));
      setFormCode(generated);
    }
  };

  // Custom manual code input
  const handleCodeChange = (code: string) => {
    setFormCode(code.toUpperCase());
    setIsCodeManuallyEdited(true);
  };

  // Force re-generate code from name
  const handleRegenerateCode = () => {
    const generated = generateBranchCode(formName, stores.map(s => s.code));
    setFormCode(generated);
    setIsCodeManuallyEdited(false);
  };

  // Open Edit Modal
  const handleOpenEdit = (store: SystemStore) => {
    setSelectedStore(store);
    setFormCode(store.code);
    setFormName(store.name);
    setFormType(store.type);
    setFormDescription(store.description || '');
    setFormAddress(store.address || '');
    setFormPhone(store.phone || '');
    setIsEditModalOpen(true);
  };

  // Open Details Modal
  const handleOpenDetails = async (store: SystemStore) => {
    setSelectedStore(store);
    setIsDetailsModalOpen(true);
    try {
      const details = await mssOperationalService.getStoreDetails(store.id);
      if (details) setSelectedStore(details);
    } catch {
      // Non-blocking
    }
  };

  // Submit Add Store
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toUpperCase();
    const cleanName = formName.trim();
    if (!cleanCode || !cleanName) {
      showNotification({
        type: 'warning',
        title: 'بيانات غير مكتملة',
        message: 'يرجى إدخال اسم ورمز الفرع/المخزن',
      });
      return;
    }

    if (stores.some(s => s.code.toUpperCase() === cleanCode)) {
      showNotification({
        type: 'warning',
        title: 'رمز الفرع مكرر',
        message: `رمز الفرع (${cleanCode}) مسجل مسبقاً. يرجى اختيار رمز فريد.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await mssOperationalService.createStore(
        {
          code: cleanCode,
          name: cleanName,
          type: formType,
          description: formDescription.trim() || undefined,
          address: formAddress.trim() || undefined,
          phone: formPhone.trim() || undefined,
          isActive: true,
        },
        actor
      );

      showNotification({
        type: 'success',
        title: 'تم إنشاء الفرع بنجاح',
        message: `تم تسجيل الموقع (${formName}) في النظام بنجاح.`,
      });

      setIsAddModalOpen(false);
      await loadStores();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل إنشاء الفرع',
        message: err.message || 'حدث خطأ أثناء حفظ الفرع',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Store
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !formName.trim()) return;

    const cleanCode = formCode.trim().toUpperCase();
    if (!cleanCode) {
      showNotification({
        type: 'warning',
        title: 'رمز الفرع مطلوب',
        message: 'يرجى إدخال رمز للفرع/المخزن',
      });
      return;
    }

    if (stores.some(s => s.id !== selectedStore.id && s.code.toUpperCase() === cleanCode)) {
      showNotification({
        type: 'warning',
        title: 'رمز الفرع مكرر',
        message: `رمز الفرع (${cleanCode}) مسجل مسبقاً لفرع أو مخزن آخر. يرجى اختيار رمز فريد.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await mssOperationalService.updateStore(
        {
          id: selectedStore.id,
          code: cleanCode,
          name: formName.trim(),
          type: formType,
          description: formDescription.trim() || undefined,
          address: formAddress.trim() || undefined,
          phone: formPhone.trim() || undefined,
        },
        actor
      );

      showNotification({
        type: 'success',
        title: 'تم تحديث البيانات',
        message: `تم حفظ تعديلات (${formName}) بنجاح.`,
      });

      setIsEditModalOpen(false);
      await loadStores();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل التحديث',
        message: err.message || 'حدث خطأ أثناء تعديل بيانات الفرع',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (store: SystemStore) => {
    try {
      const newStatus = !store.isActive;
      await mssOperationalService.toggleStoreStatus(store.id, newStatus, actor);
      showNotification({
        type: 'info',
        title: newStatus ? 'تم تفعيل الموقع' : 'تم تعطيل الموقع',
        message: `تم تغيير حالة (${store.name}) إلى ${newStatus ? 'نشط' : 'معطل'}.`,
      });
      await loadStores();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل تغيير الحالة',
        message: err.message || 'تعذر تغيير حالة الموقع',
      });
    }
  };

  // Open Archive Confirmation Alert Modal
  const handleOpenArchiveModal = (store: SystemStore) => {
    setStoreToArchive(store);
  };

  const handleCancelArchive = () => {
    if (isArchiving) return;
    setStoreToArchive(null);
  };

  // Archive Store - Confirmed
  const handleConfirmArchive = async () => {
    if (!storeToArchive) return;

    setIsArchiving(true);
    try {
      await mssOperationalService.archiveStore(storeToArchive.id, actor);
      const entityLabel = storeToArchive.type === 'warehouse' ? 'المخزن' : 'الفرع';
      showNotification({
        type: 'success',
        title: 'تمت أرشفة الموقع',
        message: `تمت أرشفة ${entityLabel} (${storeToArchive.name}) مع الحفاظ على سلامة المخزون والسجلات التاريخية.`,
      });
      setStoreToArchive(null);
      await loadStores();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل الأرشفة',
        message: err.message || 'تعذر أرشفة الموقع',
      });
    } finally {
      setIsArchiving(false);
    }
  };

  // Backwards-compatible alias for handleOpenArchiveModal
  const handleArchiveStore = (store: SystemStore) => {
    handleOpenArchiveModal(store);
  };

  // Assign user in details modal
  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !assignUserId.trim()) return;

    setIsAssigning(true);
    try {
      await mssOperationalService.assignUserToStore(
        {
          storeId: selectedStore.id,
          userId: assignUserId.trim(),
          isPrimary: assignIsPrimary,
        },
        actor
      );

      showNotification({
        type: 'success',
        title: 'تم تعيين الموظف',
        message: 'تم تعيين الموظف في هذا الفرع بنجاح.',
      });

      setAssignUserId('');
      setAssignIsPrimary(false);
      const details = await mssOperationalService.getStoreDetails(selectedStore.id);
      if (details) setSelectedStore(details);
      await loadStores();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل التعيين',
        message: err.message || 'حدث خطأ أثناء تعيين الموظف',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  // Remove user assignment
  const handleRemoveUser = async (userId: string) => {
    if (!selectedStore) return;
    try {
      await mssOperationalService.removeUserFromStore(selectedStore.id, userId, actor);
      showNotification({
        type: 'info',
        title: 'تمت إزالة التعيين',
        message: 'تمت إزالة الموظف من هذا الفرع.',
      });
      const details = await mssOperationalService.getStoreDetails(selectedStore.id);
      if (details) setSelectedStore(details);
      await loadStores();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل الإزالة',
        message: err.message || 'تعذر إزالة الموظف',
      });
    }
  };

  // Merge Wizard Handlers
  const handleOpenMergeWizard = () => {
    setMergeStep(1);
    setMergeSourceIds([]);
    setMergeDestinationId('');
    setMergeNotes('');
    setMergePreview(null);
    setIsMergeModalOpen(true);
  };

  const handleToggleMergeSource = (storeId: string) => {
    setMergeSourceIds(prev =>
      prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
    );
  };

  const handleCalculateMergePreview = async () => {
    if (mergeSourceIds.length === 0 || !mergeDestinationId) {
      showNotification({
        type: 'warning',
        title: 'بيانات غير مكتملة',
        message: 'يرجى اختيار فرع مصدر واحد على الأقل وتحديد الفرع الوجهة.',
      });
      return;
    }

    try {
      const preview = await mssOperationalService.previewStoreMerge(
        mergeSourceIds,
        mergeDestinationId
      );
      setMergePreview(preview);
      setMergeStep(3);
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في التحقق من الدمج',
        message: err.message || 'فشل حساب تأثير دمج الفروع',
      });
    }
  };

  const handleExecuteMerge = async () => {
    if (mergeSourceIds.length === 0 || !mergeDestinationId) return;

    setIsMerging(true);
    try {
      const res = await mssOperationalService.executeStoreMerge(
        {
          sourceStoreIds: mergeSourceIds,
          destinationStoreId: mergeDestinationId,
          notes: mergeNotes.trim() || undefined,
        },
        actor
      );

      showNotification({
        type: 'success',
        title: 'تم دمج الفروع بنجاح',
        message: res.message,
      });

      setMergeStep(5);
      await loadStores();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل تنفيذ الدمج',
        message: err.message || 'حدث خطأ أثناء دمج الفروع',
      });
    } finally {
      setIsMerging(false);
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const total = stores.length;
    const activeStores = stores.filter(s => s.type === 'store' && s.isActive && !s.isArchived).length;
    const activeWarehouses = stores.filter(s => s.type === 'warehouse' && s.isActive && !s.isArchived).length;
    const archived = stores.filter(s => s.isArchived).length;
    return { total, activeStores, activeWarehouses, archived };
  }, [stores]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="إدارة الفروع والمخازن "
        subtitle=" "
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={handleOpenMergeWizard}
              leftIcon={<GitMerge className="w-4.5 h-4.5 text-blue-700" />}
              className="border-blue-200 text-blue-800 hover:bg-blue-50 font-bold"
            >
               دمج الفروع
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => triggerRefresh(loadStores, 'جارٍ تحديث الفروع والمخازن...')}
              disabled={isRefreshing || loading}
              leftIcon={<RefreshCw className={`w-4.5 h-4.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenAdd}
              leftIcon={<Plus className="w-4.5 h-4.5" />}
              className="font-bold"
            >
              إضافة فرع / مخزن
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">إجمالي المقرات</span>
            <Building className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 mt-2">{stats.total}</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-600">الفروع التجارية النشطة</span>
            <Store className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-black font-mono text-teal-800 mt-2">{stats.activeStores}</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600">المخازن والمستودعات</span>
            <Warehouse className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black font-mono text-indigo-800 mt-2">{stats.activeWarehouses}</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">المقرات المؤرشفة</span>
            <Archive className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-600 mt-2">{stats.archived}</p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-3 bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="البحث بالاسم أو الرمز أو العنوان أو الهاتف..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-9 text-xs"
            />
          </div>

          <div className="w-full md:w-48">
            <Select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              options={[
                { value: 'all', label: 'كافة الأنواع' },
                { value: 'store', label: 'فروع بيع وتوزيع' },
                { value: 'warehouse', label: 'مخازن ' },
                { value: 'combined', label: 'فرع ومخزن مدمج' },
              ]}
              className="text-xs"
            />
          </div>

          <div className="w-full md:w-48">
            <Select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'كافة الحالات' },
                { value: 'active', label: 'نشط فقط' },
                { value: 'inactive', label: 'معطل' },
                { value: 'archived', label: 'مؤرشف' },
              ]}
              className="text-xs"
            />
          </div>
        </div>
      </Card>

      {/* Stores List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
          <Spinner size="lg" />
          <p className="text-xs">جارٍ تحميل الفروع والمخازن...</p>
        </div>
      ) : stores.length === 0 ? (
        <Card className="p-8 text-center bg-white border border-slate-200">
          <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">لا توجد فروع أو مخازن مطابقة</h3>
          <p className="text-xs text-slate-500 mt-1">
            يمكنك إضافة فرع أو مخزن جديد بالنقر على زر &quot;إضافة فرع / مخزن&quot;.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map(st => {
            const isStore = st.type === 'store';
            const isWarehouse = st.type === 'warehouse';
            return (
              <Card
                key={st.id}
                className={`p-5 bg-white border transition-all duration-200 shadow-xs hover:shadow-md rounded-2xl flex flex-col justify-between group ${
                  st.isArchived
                    ? 'border-slate-300 bg-slate-50/70 opacity-80'
                    : st.isActive
                    ? 'border-slate-200/90 hover:border-blue-400 hover:shadow-blue-50/40'
                    : 'border-rose-200 bg-rose-50/25'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 pb-3 mb-3.5 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-md border border-slate-300 tracking-tight">
                        {st.code}
                      </span>
                      <Badge
                        variant={isStore ? 'primary' : isWarehouse ? 'default' : 'warning'}
                        size="sm"
                        className="font-semibold text-xs inline-flex items-center gap-1"
                      >
                        {isStore ? (
                          <Store className="w-3 h-3 shrink-0" />
                        ) : isWarehouse ? (
                          <Warehouse className="w-3 h-3 shrink-0" />
                        ) : (
                          <Building className="w-3 h-3 shrink-0" />
                        )}
                        <span>{isStore ? 'فرع تجاري' : isWarehouse ? 'مخزن' : 'مقر مدمج'}</span>
                      </Badge>
                    </div>

                    <div>
                      {st.isArchived ? (
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-full inline-flex items-center">
                          مؤرشف
                        </span>
                      ) : st.isActive ? (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                          نشط
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                          معطل
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Identity Section */}
                  <div className="mb-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isStore
                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                            : isWarehouse
                            ? 'bg-purple-50 text-purple-600 border border-purple-100'
                            : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}
                      >
                        {isStore ? (
                          <Store className="w-5 h-5" />
                        ) : isWarehouse ? (
                          <Warehouse className="w-5 h-5" />
                        ) : (
                          <Building className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-slate-900 leading-snug truncate" title={st.name}>
                          {st.name}
                        </h3>
                        {st.description ? (
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed font-normal" title={st.description}>
                            {st.description}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-1 italic font-normal">لا يوجد وصف مسجل للفرع</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Details / Contact Section */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60 space-y-2 text-xs mb-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {st.address ? (
                        <span className="truncate font-medium text-slate-800" title={st.address}>
                          {st.address}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">العنوان غير محدد</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {st.phone ? (
                        <span className="font-mono font-medium text-slate-800" dir="ltr">
                          {st.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">رقم الهاتف غير مسجل</span>
                      )}
                    </div>

                    {st.mergedIntoName && (
                      <div className="pt-2 border-t border-slate-200/70 flex items-center gap-1.5 text-[11px] text-blue-700 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                        <span className="truncate">تم الدمج في: {st.mergedIntoName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDetails(st)}
                    leftIcon={<Users className="w-3.5 h-3.5 text-blue-600" />}
                    className="text-xs font-semibold hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50/50 shadow-2xs"
                  >
                    الموظفون والمخزون
                  </Button>

                  <div className="flex items-center gap-1">
                    {!st.isArchived && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(st)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                          title={st.type === 'warehouse' ? 'تعديل بيانات المخزن' : 'تعديل بيانات الفرع'}
                          aria-label={st.type === 'warehouse' ? 'تعديل بيانات المخزن' : 'تعديل بيانات الفرع'}
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleToggleStatus(st)}
                          className={`p-1.5 rounded-lg transition-colors border border-transparent ${
                            st.isActive
                              ? 'text-emerald-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'
                          }`}
                          title={
                            st.isActive
                              ? st.type === 'warehouse'
                                ? 'تعطيل المخزن'
                                : 'تعطيل الفرع'
                              : st.type === 'warehouse'
                                ? 'تفعيل المخزن'
                                : 'تفعيل الفرع'
                          }
                          aria-label={
                            st.isActive
                              ? st.type === 'warehouse'
                                ? 'تعطيل المخزن'
                                : 'تعطيل الفرع'
                              : st.type === 'warehouse'
                                ? 'تفعيل المخزن'
                                : 'تفعيل الفرع'
                          }
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenArchiveModal(st)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                          title={st.type === 'warehouse' ? 'أرشفة المخزن' : 'أرشفة الفرع'}
                          aria-label={st.type === 'warehouse' ? 'أرشفة المخزن' : 'أرشفة الفرع'}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Store Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <Modal
          isOpen={isAddModalOpen || isEditModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
          }}
          title={isEditModalOpen ? `تعديل الفرع: ${selectedStore?.name}` : 'إضافة فرع أو مخزن جديد'}
          subtitle=" "
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                disabled={isSubmitting}
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={isEditModalOpen ? handleSubmitEdit : handleSubmitAdd}
                disabled={isSubmitting}
                leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle className="w-4.5 h-4.5" />}
                className="font-bold"
              >
                {isSubmitting ? 'جارٍ الحفظ...' : isEditModalOpen ? 'حفظ التعديلات' : 'إنشاء الفرع'}
              </Button>
            </div>
          }
        >
          <form onSubmit={isEditModalOpen ? handleSubmitEdit : handleSubmitAdd} className="space-y-3.5 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                اسم الفرع أو المخزن <span className="text-rose-500">*</span>
              </label>
              <Input
                value={formName}
                onChange={e => (isEditModalOpen ? setFormName(e.target.value) : handleNameChange(e.target.value))}
                placeholder="مثال: Cairo, Nasr City, New Cairo Branch, مخزن المعادي..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 block">
                    رمز الفرع / المخزن <span className="text-rose-500">*</span>
                  </label>
                  {isCodeManuallyEdited && (
                    <button
                      type="button"
                      onClick={handleRegenerateCode}
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                      title="استعادة الرمز المولّد تلقائياً من الاسم"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      توليد تلقائي
                    </button>
                  )}
                </div>
                <Input
                  value={formCode}
                  onChange={e => handleCodeChange(e.target.value)}
                  placeholder="مثال: CA-001, NC-001, NCB-001..."
                  className="font-mono uppercase font-bold"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {isCodeManuallyEdited ? (
                    <span className="text-amber-600">تم التعديل يدوياً (لن يُستبدل تلقائياً)</span>
                  ) : (
                    <span className="text-emerald-600">يتم توليد الرمز تلقائياً بصيغة PREFIX-001</span>
                  )}
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">النوع</label>
                <Select
                  value={formType}
                  onChange={e => setFormType(e.target.value as StoreType)}
                  options={[
                    { value: 'store', label: 'فرع بيع وتوزيع ' },
                    { value: 'warehouse', label: 'مخزن  ' },
                    { value: 'combined', label: 'فرع ومخزن ' },
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">العنوان  </label>
              <Input
                value={formAddress}
                onChange={e => setFormAddress(e.target.value)}
                placeholder="مثال: 15 شارع الجمهورية، وسط البلد..."
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">رقم هاتف الفرع</label>
              <Input
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                placeholder="01030137635"
                className="font-mono text-left"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">وصف أو ملاحظات</label>
              <Input
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="أية ملاحظات إدارية عن هذا الموقع..."
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Store Details & Memberships Modal */}
      {isDetailsModalOpen && selectedStore && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`تفاصيل : ${selectedStore.name}`}
          subtitle={`الرمز: ${selectedStore.code} | النوع: ${selectedStore.type}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              {!selectedStore.isArchived ? (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    const st = selectedStore;
                    setIsDetailsModalOpen(false);
                    handleOpenArchiveModal(st);
                  }}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 text-xs font-bold"
                  leftIcon={<Archive className="w-4 h-4" />}
                >
                  أرشفة {selectedStore.type === 'warehouse' ? 'المخزن' : 'الفرع'}
                </Button>
              ) : <div />}
              <Button variant="outline" size="md" onClick={() => setIsDetailsModalOpen(false)}>
                إغلاق
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-slate-400 block text-[11px]">الأجهزة المتواجدة حالياً:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{selectedStore.deviceCount || 0} جهاز</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">الموظفون والشركاء المعينون:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{selectedStore.assignedUsersCount || 0} موظف</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">تاريخ الإنشاء:</span>
                <span className="font-mono text-slate-700">{formatDate(selectedStore.createdAt)}</span>
              </div>
            </div>


            {/* Memberships Table */}
            <div>
              <h4 className="font-bold text-slate-800 mb-2">الموظفون المعينون بهذا الفرع</h4>
              {!selectedStore.assignedUsers || selectedStore.assignedUsers.length === 0 ? (
                <p className="text-slate-400 text-xs italic p-3 bg-slate-50 rounded-lg border border-slate-200">
                  لا يوجد موظفون معينون بهذا الفرع حالياً.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">اسم الموظف</th>
                        <th className="py-2.5 px-3">اسم المستخدم</th>
                        <th className="py-2.5 px-3">الصلاحية</th>
                        <th className="py-2.5 px-3">الفرع الأساسي</th>
                        <th className="py-2.5 px-3 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedStore.assignedUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{u.displayName}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{u.username}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant="default" size="sm">
                              {u.allowedModules === 'both' ? 'القسمين' : u.allowedModules === 'mss' ? 'Compu MSS' : 'إكسسوارات'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            {u.isPrimary ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                                أساسي
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleRemoveUser(u.id)}
                              className="text-rose-600 hover:text-rose-800 font-bold text-[11px]"
                            >
                              إزالة التعيين
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick Assign Form */}
            <form onSubmit={handleAssignUser} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-slate-800 block text-xs">تعيين موظف إضافي بالفرع</span>
              <div className="flex items-center gap-2">
                <Input
                  value={assignUserId}
                  onChange={e => setAssignUserId(e.target.value)}
                  placeholder="معرف الموظف (User ID)..."
                  className="text-xs"
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-700 whitespace-nowrap cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignIsPrimary}
                    onChange={e => setAssignIsPrimary(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>فرع أساسي</span>
                </label>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isAssigning || !assignUserId.trim()}
                  className="whitespace-nowrap font-bold"
                >
                  {isAssigning ? 'جارٍ...' : 'تعيين'}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Archive Confirmation Alert Modal */}
      {storeToArchive && (
        <Modal
          isOpen={!!storeToArchive}
          onClose={handleCancelArchive}
          title={`تأكيد أرشفة ${storeToArchive.type === 'warehouse' ? 'المخزن' : 'الفرع'}`}
          subtitle={`نقل ${storeToArchive.type === 'warehouse' ? 'المخزن' : 'الفرع'} إلى سجلات الأرشيف مع الحفاظ على البيانات`}
          size="sm"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="md"
                onClick={handleCancelArchive}
                disabled={isArchiving}
              >
                إلغاء
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleConfirmArchive}
                disabled={isArchiving}
                leftIcon={isArchiving ? <Spinner size="sm" /> : <Archive className="w-4 h-4" />}
                className="font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isArchiving
                  ? 'جارٍ الأرشفة...'
                  : `تأكيد أرشفة ${storeToArchive.type === 'warehouse' ? 'المخزن' : 'الفرع'}`}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm" dir="rtl">
      

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">نوع الموقع:</span>
                <span className="font-bold text-slate-800">
                  {storeToArchive.type === 'warehouse' ? 'مخزن' : 'فرع تجاري'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">رمز الموقع:</span>
                <span className="font-mono font-bold text-slate-900">{storeToArchive.code}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">اسم {storeToArchive.type === 'warehouse' ? 'المخزن' : 'الفرع'}:</span>
                <span className="font-bold text-slate-900">{storeToArchive.name}</span>
              </div>
              {storeToArchive.address && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">العنوان:</span>
                  <span className="text-slate-700">{storeToArchive.address}</span>
                </div>
              )}
              {storeToArchive.deviceCount !== undefined && storeToArchive.deviceCount > 0 && (
                <div className="flex items-center justify-between text-blue-700 font-semibold pt-1 border-t border-slate-200">
                  <span>الأجهزة المتواجدة حالياً:</span>
                  <span className="font-mono font-bold">{storeToArchive.deviceCount} جهاز</span>
                </div>
              )}
            </div>

        
          </div>
        </Modal>
      )}

      {/* 5-Step Store Merge Wizard Modal */}
      {isMergeModalOpen && (
        <Modal
          isOpen={isMergeModalOpen}
          onClose={() => !isMerging && setIsMergeModalOpen(false)}
          title=" دمج الفروع والمخازن "
          subtitle=""
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              {mergeStep > 1 && mergeStep < 5 ? (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setMergeStep((mergeStep - 1) as any)}
                  disabled={isMerging}
                  leftIcon={<ArrowRight className="w-4 h-4" />}
                >
                  السابق
                </Button>
              ) : (
                <div />
              )}

              {mergeStep === 1 && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (mergeSourceIds.length === 0) {
                      showNotification({
                        type: 'warning',
                        title: 'تحديد الفروع',
                        message: 'يجب اختيار فرع أو مخزن واحد على الأقل .',
                      });
                      return;
                    }
                    setMergeStep(2);
                  }}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  className="font-bold"
                >
                  التالي: اختيار الوجهة
                </Button>
              )}

              {mergeStep === 2 && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCalculateMergePreview}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  className="font-bold"
                >
                  التالي: معاينة التأثير
                </Button>
              )}

              {mergeStep === 3 && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setMergeStep(4)}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  className="font-bold"
                >
                  التالي: التأكيد والملاحظات
                </Button>
              )}

              {mergeStep === 4 && (
                <Button
                  variant="danger"
                  size="md"
                  onClick={handleExecuteMerge}
                  disabled={isMerging}
                  leftIcon={isMerging ? <Spinner size="sm" /> : <GitMerge className="w-4 h-4" />}
                  className="font-bold"
                >
                  {isMerging ? 'جارٍ تنفيذ الدمج...' : 'تأكيد وتنفيذ الدمج '}
                </Button>
              )}

              {mergeStep === 5 && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setIsMergeModalOpen(false)}
                  className="font-bold"
                >
                  إغلاق المعالج
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Step Progress Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              {[
                { s: 1, title: 'الفروع المصدر' },
                { s: 2, title: 'الفرع الوجهة' },
                { s: 3, title: 'معاينة التأثير' },
                { s: 4, title: 'التأكيد' },
                { s: 5, title: 'النتيجة' },
              ].map(item => (
                <div
                  key={item.s}
                  className={`flex items-center gap-1.5 font-bold ${
                    mergeStep === item.s
                      ? 'text-blue-700'
                      : mergeStep > item.s
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                      mergeStep === item.s
                        ? 'bg-blue-600 text-white'
                        : mergeStep > item.s
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

            {/* Step 1: Select Source Stores */}
            {mergeStep === 1 && (
              <div className="space-y-3">
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {stores
                    .filter(s => !s.isArchived)
                    .map(st => {
                      const checked = mergeSourceIds.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                            checked ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleMergeSource(st.id)}
                              className="rounded border-slate-300 text-blue-600"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block">{st.name}</span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                الرمز: {st.code} | النوع: {st.type}
                              </span>
                            </div>
                          </div>
                          <Badge variant="default" size="sm">
                            {st.type === 'store' ? 'فرع' : 'مخزن'}
                          </Badge>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Step 2: Select Destination Store */}
            {mergeStep === 2 && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="font-bold text-slate-700 block">اختر الفرع الوجهة النشط:</label>
                  <Select
                    value={mergeDestinationId}
                    onChange={e => setMergeDestinationId(e.target.value)}
                    options={[
                      { value: '', label: '-- اختر الفرع الوجهة --' },
                      ...stores
                        .filter(s => !s.isArchived && !mergeSourceIds.includes(s.id))
                        .map(s => ({
                          value: s.id,
                          label: `${s.name} (${s.code}) - ${s.type}`,
                        })),
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Impact Preview */}
            {mergeStep === 3 && mergePreview && (
              <div className="space-y-3">


                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                  <span className="font-bold text-slate-900 block">المقرات المتأثرة بالدمج:</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 block">الفروع المصدر :</span>
                      <span className="font-bold text-slate-800">
                        {mergePreview.sourceStores.map(s => s.name).join('، ')}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 block">الفرع الوجهة :</span>
                      <span className="font-bold text-emerald-800">
                        {mergePreview.destinationStore?.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold text-slate-800 block text-xs">حالة الأجهزة بالمخازن:</span>
                  {mergePreview.inventorySummary.map(item => (
                    <div
                      key={item.storeId}
                      className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-800">{item.storeName}</span>
                      <span className="font-mono text-slate-600">{item.deviceCount} جهاز في الموقع الحالي</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Notes and Final Confirmation */}
            {mergeStep === 4 && (
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    ملاحظات وأسباب الدمج (اختياري لتوثيق سجل التدقيق):
                  </label>
                  <Input
                    value={mergeNotes}
                    onChange={e => setMergeNotes(e.target.value)}
                    placeholder="مثال: دمج إداري لفرعي الجيزة في المركز الرئيسي لتوحيد صالات العرض..."
                  />
                </div>
              </div>
            )}

            {/* Step 5: Success Summary */}
            {mergeStep === 5 && (
              <div className="text-center py-6 space-y-3">
                <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">اكتمل دمج الفروع بنجاح!</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  تمت أرشفة الفروع المصدر وإعادة ربط الشركاء بالفرع الوجهة وتوثيق العملية في سجل التدقيق الإداري.
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Boxes,
  Laptop,
  CheckCircle2,
  BookmarkCheck,
  ShoppingBag,
  RefreshCw,
  Info,
  Building,
  ShieldCheck,
  ArrowRight,
  Search,
  Filter,
  ArrowLeftRight,
  Plus,
  CheckSquare,
  Square,
  Smartphone,
  Eye,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import type { NavTab } from '../layout/AdminSidebar';
import type { InventoryDevice, InventoryOverviewSummary, SystemStore } from '@/types/admin';
import { TransferWizardModal } from '../transfers/TransferWizardModal';

interface InventoryFoundationViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const InventoryFoundationView: React.FC<InventoryFoundationViewProps> = ({ onNavigate }) => {
  const [devices, setDevices] = useState<InventoryDevice[]>([]);
  const [summary, setSummary] = useState<InventoryOverviewSummary | null>(null);
  const [stores, setStores] = useState<SystemStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Multi-selection for quick transfer
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [isTransferWizardOpen, setIsTransferWizardOpen] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, storesRes] = await Promise.all([
        fetch('/api/inventory?limit=300'),
        fetch('/api/stores'),
      ]);

      if (!invRes.ok) throw new Error('فشل في جلب بيانات المخزون');
      const invData = await invRes.json();
      setDevices(invData.devices || []);
      setSummary(invData.summary || null);

      if (storesRes.ok) {
        const storesData = await storesRes.json();
        setStores(storesData.stores || []);
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحميل بيانات المخزون');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Filtered devices
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        d.serialNumber.toLowerCase().includes(q) ||
        d.modelName.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        (d.notes && d.notes.toLowerCase().includes(q));

      const matchesLocation = locationFilter === 'all' || d.stockLocation === locationFilter;
      const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || d.category === categoryFilter;

      return matchesSearch && matchesLocation && matchesStatus && matchesCategory;
    });
  }, [devices, searchTerm, locationFilter, statusFilter, categoryFilter]);

  // Selection toggle
  const toggleDeviceSelect = (id: string) => {
    setSelectedDeviceIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllEligibleVisible = () => {
    const eligible = filteredDevices.filter(d => d.status === 'AVAILABLE').map(d => d.id);
    setSelectedDeviceIds(eligible);
  };

  const clearSelection = () => {
    setSelectedDeviceIds([]);
  };

  // Derive common location for selected devices if any
  const selectedDevicesSourceLocation = useMemo(() => {
    if (selectedDeviceIds.length === 0) return undefined;
    const selectedDevs = devices.filter(d => selectedDeviceIds.includes(d.id));
    const firstLoc = selectedDevs[0]?.stockLocation;
    const allSame = selectedDevs.every(d => d.stockLocation === firstLoc);
    return allSame ? firstLoc : undefined;
  }, [selectedDeviceIds, devices]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-500/10 text-brand-primary rounded-xl border border-blue-500/20 shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>إدارة المخزون المشترك (Compu MSS)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              استعراض شامل لأجهزة اللابتوب والشاشات المسجلة في السحابة وتوزيعها على الفروع، مع بيان
              الأهلية للنقل والتحويل بين المواقع دون المساس بالبيانات التاريخية.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          {selectedDeviceIds.length > 0 && (
            <button
              onClick={() => setIsTransferWizardOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>تحويل المحدد ({selectedDeviceIds.length})</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('transfers')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-brand-primary" />
            <span>سجل التحويلات</span>
          </button>

          <button
            onClick={fetchInventory}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-xl transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-[11px] font-medium text-slate-400">إجمالي الأجهزة</div>
            <div className="text-2xl font-bold text-white mt-1">{summary.totalCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-[11px] font-medium text-emerald-400">متاح للبيع والنقل</div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">{summary.availableCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-[11px] font-medium text-amber-400">محجوز لعملاء</div>
            <div className="text-2xl font-bold text-amber-300 mt-1">{summary.reservedCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-[11px] font-medium text-blue-400">تم بيعه بالكامل</div>
            <div className="text-2xl font-bold text-blue-300 mt-1">{summary.soldCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-[11px] font-medium text-purple-400">قيد الصيانة/المرتجع</div>
            <div className="text-2xl font-bold text-purple-300 mt-1">
              {summary.maintenanceCount + summary.returnedCount}
            </div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-[11px] font-medium text-rose-400">القيمة التقديرية للتكلفة</div>
            <div className="text-xl font-bold text-white mt-1">
              {summary.totalCostValue.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">ج.م</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث برقم السيريال أو اسم الموديل أو الماركة..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-4 py-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Location Filter */}
          <select
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-white focus:outline-none focus:border-brand-primary"
          >
            <option value="all">كل المواقع والفروع</option>
            {stores.map(s => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-white focus:outline-none focus:border-brand-primary"
          >
            <option value="all">كل الحالات</option>
            <option value="AVAILABLE">متاح (AVAILABLE)</option>
            <option value="RESERVED">محجوز (RESERVED)</option>
            <option value="SOLD">مباع (SOLD)</option>
            <option value="MAINTENANCE">صيانة (MAINTENANCE)</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-white focus:outline-none focus:border-brand-primary"
          >
            <option value="all">كل الفئات</option>
            <option value="لابتوب">لابتوب</option>
            <option value="شاشة">شاشة</option>
            <option value="أخرى">أخرى</option>
          </select>

          <div className="flex items-center gap-1.5 border-r border-slate-800 pr-2 mr-1">
            <button
              onClick={selectAllEligibleVisible}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
            >
              تحديد المتاح
            </button>
            {selectedDeviceIds.length > 0 && (
              <button
                onClick={clearSelection}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-400 hover:text-white transition-colors"
              >
                إلغاء ({selectedDeviceIds.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Devices Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 text-[11px] font-semibold uppercase border-b border-slate-800">
              <tr>
                <th className="p-3 w-10 text-center">اختيار</th>
                <th className="p-3.5">رقم السيريال</th>
                <th className="p-3.5">الموديل والماركة</th>
                <th className="p-3.5">الفئة</th>
                <th className="p-3.5">الموقع الحالي</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5">تكلفة الشراء</th>
                <th className="p-3.5">سعر العرض</th>
                <th className="p-3.5">أهلية النقل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-brand-primary mx-auto mb-2" />
                    جاري تحميل أجهزة المخزون...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-rose-400 bg-rose-500/10">
                    {error}
                  </td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    <Boxes className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-300">
                      {devices.length === 0 ? 'لا توجد أجهزة مسجلة في المخزون حتى الآن' : 'لا توجد أجهزة مطابقة لمعايير البحث'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {devices.length === 0
                        ? 'يتم تسجيل الأجهزة ومطابقتها تلقائياً عبر فروع ومخازن منظومة Compu MSS'
                        : 'جرب تغيير معايير البحث أو تصفية الموقع والحالة.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDevices.map(d => {
                  const isSelected = selectedDeviceIds.includes(d.id);
                  const isAvailable = d.status === 'AVAILABLE';

                  return (
                    <tr
                      key={d.id}
                      className={`hover:bg-slate-900/50 transition-colors ${
                        isSelected ? 'bg-blue-900/15' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        {isAvailable ? (
                          <button
                            type="button"
                            onClick={() => toggleDeviceSelect(d.id)}
                            className="p-1 text-slate-400 hover:text-white transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-brand-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-white tracking-wider">
                        {d.serialNumber}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-200">{d.modelName}</div>
                        <div className="text-[11px] text-slate-500">{d.brand}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-medium">
                          {d.category}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-200 flex items-center gap-1.5 mt-1">
                        <Building className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                        <span>{d.stockLocation}</span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            d.status === 'AVAILABLE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : d.status === 'RESERVED'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : d.status === 'SOLD'
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {d.status === 'AVAILABLE' ? <CheckCircle2 className="w-3 h-3" /> : null}
                          <span>{d.status}</span>
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        {d.purchaseCost.toLocaleString()} ج.م
                      </td>
                      <td className="p-3.5 font-mono text-emerald-400 font-medium">
                        {d.listPrice.toLocaleString()} ج.م
                      </td>
                      <td className="p-3.5">
                        {d.isEligibleForTransfer ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>مؤهل للنقل</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-rose-400/90 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{d.ineligibilityReason || 'غير متاح'}</span>
                          </span>
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

      {/* Transfer Wizard Modal for quick transfer */}
      {isTransferWizardOpen && (
        <TransferWizardModal
          isOpen={isTransferWizardOpen}
          onClose={() => setIsTransferWizardOpen(false)}
          onSuccess={() => {
            setIsTransferWizardOpen(false);
            setSelectedDeviceIds([]);
            fetchInventory();
          }}
          availableStores={stores}
          preselectedDeviceIds={selectedDeviceIds}
          preselectedSource={selectedDevicesSourceLocation}
        />
      )}
    </div>
  );
};

export default InventoryFoundationView;

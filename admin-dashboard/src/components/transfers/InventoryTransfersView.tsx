'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  Boxes,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Building,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Eye,
} from 'lucide-react';
import type { InventoryTransfer, SystemStore, ExecuteTransferResult } from '@/types/admin';
import { TransferWizardModal } from './TransferWizardModal';
import { TransferDetailsModal } from './TransferDetailsModal';

export const InventoryTransfersView: React.FC = () => {
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [stores, setStores] = useState<SystemStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [destinationFilter, setDestinationFilter] = useState<string>('all');

  // Modals
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const fetchTransfersAndStores = async () => {
    setLoading(true);
    setError(null);
    try {
      const [transfersRes, storesRes] = await Promise.all([
        fetch('/api/transfers?limit=100'),
        fetch('/api/stores'),
      ]);

      if (!transfersRes.ok) throw new Error('فشل في جلب سجل التحويلات');
      const transfersData = await transfersRes.json();
      setTransfers(transfersData.transfers || []);

      if (storesRes.ok) {
        const storesData = await storesRes.json();
        setStores(storesData.stores || []);
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحميل بيانات التحويلات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfersAndStores();
  }, []);

  // Filtered Transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.referenceNumber.toLowerCase().includes(q) ||
        t.sourceLocation.toLowerCase().includes(q) ||
        t.destinationLocation.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || t.sourceLocation === sourceFilter;
      const matchesDest = destinationFilter === 'all' || t.destinationLocation === destinationFilter;

      return matchesSearch && matchesStatus && matchesSource && matchesDest;
    });
  }, [transfers, searchTerm, statusFilter, sourceFilter, destinationFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const total = transfers.length;
    const completed = transfers.filter(t => t.status === 'COMPLETED').length;
    const totalItems = transfers
      .filter(t => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + (t.itemCount || 0), 0);
    const totalCost = transfers
      .filter(t => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + (t.totalCost || 0), 0);

    return { total, completed, totalItems, totalCost };
  }, [transfers]);

  const handleOpenDetails = (id: string) => {
    setSelectedTransferId(id);
    setIsDetailsModalOpen(true);
  };

  const handleTransferSuccess = (_result: ExecuteTransferResult) => {
    fetchTransfersAndStores();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 text-brand-primary rounded-xl border border-blue-500/20 shrink-0">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>تحويلات المخزون بين الفروع والمخازن</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  المرحلة 5 مفعلة
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                إدارة النقل الفعلي لأجهزة Compu MSS بين نقاط البيع والمستودعات المركزية مع الحفاظ الذاتي
                على التكلفة الشرائية، تسلسل السيريال، وعدم تكرار وجود الجهاز في موقعين معاً.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>بدء تحويل مخزون جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-400">إجمالي عمليات التحويل</div>
          <div className="text-2xl font-bold text-white mt-1">{kpis.total}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-emerald-400">التحويلات المكتملة</div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">{kpis.completed}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-blue-400">إجمالي الأجهزة المنقولة</div>
          <div className="text-2xl font-bold text-blue-300 mt-1">{kpis.totalItems} جهاز</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-purple-400">القيمة الإجمالية المنقولة</div>
          <div className="text-2xl font-bold text-purple-300 mt-1">
            {kpis.totalCost.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالرقم المرجعي (TRF-...) أو اسم الموقع..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-4 py-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-white focus:outline-none focus:border-brand-primary"
          >
            <option value="all">كل مواقع المصدر</option>
            {stores.map(s => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Destination Filter */}
          <select
            value={destinationFilter}
            onChange={e => setDestinationFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-white focus:outline-none focus:border-brand-primary"
          >
            <option value="all">كل مواقع الوجهة</option>
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
            <option value="COMPLETED">مكتمل (COMPLETED)</option>
            <option value="PENDING">معلق (PENDING)</option>
            <option value="FAILED">فشل (FAILED)</option>
          </select>

          <button
            onClick={fetchTransfersAndStores}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700/80 rounded-lg transition-colors cursor-pointer"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Transfer History Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 text-[11px] font-semibold uppercase border-b border-slate-800">
              <tr>
                <th className="p-3.5">الرقم المرجعي</th>
                <th className="p-3.5">تاريخ التحويل</th>
                <th className="p-3.5">المسار (المصدر ➔ الوجهة)</th>
                <th className="p-3.5">نوع النطاق</th>
                <th className="p-3.5">الأجهزة</th>
                <th className="p-3.5">القيمة المنقولة</th>
                <th className="p-3.5">المسؤول</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-brand-primary mx-auto mb-2" />
                    جاري تحميل سجل التحويلات...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-rose-400 bg-rose-500/10">
                    {error}
                  </td>
                </tr>
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    <Boxes className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-300">لا توجد عمليات تحويل مطابقة</p>
                    <p className="text-xs text-slate-500 mt-1">ابدأ تحويل أجهزة جديد أو عدل معايير البحث.</p>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map(t => (
                  <tr key={t.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-brand-primary">
                      {t.referenceNumber}
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3.5 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300">{t.sourceLocation}</span>
                        <span className="text-slate-600">➔</span>
                        <span className="text-emerald-400">{t.destinationLocation}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                        {t.transferType}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-white">{t.itemCount} جهاز</td>
                    <td className="p-3.5 font-mono text-slate-200">
                      {t.totalCost.toLocaleString()} ج.م
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px]">{t.createdByUsername}</td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          t.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{t.status}</span>
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleOpenDetails(t.id)}
                        className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-brand-primary transition-colors cursor-pointer"
                        title="عرض تفاصيل الأجهزة المنقولة"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Wizard Modal */}
      {isWizardOpen && (
        <TransferWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onSuccess={handleTransferSuccess}
          availableStores={stores}
        />
      )}

      {/* Transfer Details Modal */}
      {isDetailsModalOpen && selectedTransferId && (
        <TransferDetailsModal
          transferId={selectedTransferId}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedTransferId(null);
          }}
        />
      )}
    </div>
  );
};

export default InventoryTransfersView;

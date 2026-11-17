'use client';

import React, { useState, useEffect } from 'react';
import {
  Store,
  Warehouse,
  Users,
  MapPin,
  Phone,
  Layers,
  Archive,
  UserPlus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldAlert,
  GitMerge,
} from 'lucide-react';
import type { SystemStore, AppUser, StoreAssignedUser } from '@/types/admin';

interface StoreDetailsModalProps {
  storeId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent: () => void;
}

export const StoreDetailsModal: React.FC<StoreDetailsModalProps> = ({
  storeId,
  isOpen,
  onClose,
  onRefreshParent,
}) => {
  const [store, setStore] = useState<SystemStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState('');
  const [isPrimaryForNewUser, setIsPrimaryForNewUser] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchDetails = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/stores?id=${storeId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر جلب تفاصيل الموقع');
      setStore(data.store);

      // Fetch all users for assignment dropdown
      const uRes = await fetch('/api/users');
      const uData = await uRes.json();
      setAllUsers(uData.users || []);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && storeId) {
      fetchDetails();
    }
  }, [isOpen, storeId]);

  if (!isOpen) return null;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserIdToAdd) return;

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_user',
          storeId,
          userId: selectedUserIdToAdd,
          isPrimary: isPrimaryForNewUser,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في تعيين الشريك/المستخدم');

      setActionSuccess('تم تعيين المستخدم بالفرع وتحديث الصلاحيات بنجاح.');
      setSelectedUserIdToAdd('');
      setIsPrimaryForNewUser(false);
      await fetchDetails();
      onRefreshParent();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string, username: string) => {
    if (!window.confirm(`هل أنت متأكد من إزالة المستخدم @${username} من هذا الموقع؟`)) {
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_user',
          storeId,
          userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في إزالة المستخدم');

      setActionSuccess('تم إزالة المستخدم من الفرع بنجاح.');
      await fetchDetails();
      onRefreshParent();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter users not yet assigned
  const assignedUserIds = (store?.assignedUsers || []).map(u => u.id);
  const unassignedUsers = allUsers.filter(u => !assignedUserIds.includes(u.id));

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              {store?.type === 'warehouse' ? (
                <Warehouse className="w-5 h-5" />
              ) : (
                <Store className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{store?.name || 'تفاصيل الموقع'}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {store?.code}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {store?.type === 'store'
                  ? 'محل تجاري'
                  : store?.type === 'warehouse'
                  ? 'مخزن مركزي'
                  : 'محل ومخزن مشترك'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {actionSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {actionError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span>جارٍ تحميل البيانات...</span>
            </div>
          ) : store ? (
            <>
              {/* Status and Archiving Notice */}
              {store.isArchived && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-2 text-sm">
                    <Archive className="w-4 h-4 text-amber-400" />
                    <span>موقع مؤرشف / مدمج</span>
                  </div>
                  <p className="leading-relaxed">
                    تمت أرشفة هذا الموقع ودمجه. لا يمكن إجراء عمليات تجارية جديدة عليه، مع الحفاظ الكامل على
                    كافة الفواتير والأجهزة المسجلة به تاريخياً.
                    {store.mergedIntoName && (
                      <span className="block font-bold text-white mt-1">
                        تم الدمج في: {store.mergedIntoName}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Basic Information Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">الحالة</span>
                  <div className="font-semibold text-slate-200">
                    {store.isArchived ? (
                      <span className="text-amber-400 font-bold">مؤرشف ومدمج</span>
                    ) : store.isActive ? (
                      <span className="text-emerald-400 font-bold">نشط بالمنظومة</span>
                    ) : (
                      <span className="text-rose-400 font-bold">معطل</span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">الهاتف</span>
                  <div className="font-mono text-slate-300">{store.phone || 'غير مسجل'}</div>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    رصيد الأجهزة (Compu MSS)
                  </span>
                  <div className="font-bold text-slate-200 font-mono">
                    {store.deviceCount !== undefined ? `${store.deviceCount} جهاز` : '0 جهاز'}
                  </div>
                </div>
              </div>

              {/* Address & Description */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1 text-slate-300">
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>العنوان: {store.address || 'غير محدد'}</span>
                </div>
                {store.description && (
                  <p className="text-slate-400 mt-1">{store.description}</p>
                )}
              </div>

              {/* Assigned Partners / Users Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>الشركاء والموظفون المعينون ({store.assignedUsers?.length ?? 0})</span>
                  </h4>
                </div>

                {/* Users List */}
                <div className="space-y-2">
                  {!store.assignedUsers || store.assignedUsers.length === 0 ? (
                    <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center text-slate-500">
                      لا يوجد شركاء أو موظفون معينون بهذا الموقع حالياً.
                    </div>
                  ) : (
                    store.assignedUsers.map(u => (
                      <div
                        key={u.id}
                        className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-100 flex items-center gap-2">
                            <span>{u.displayName}</span>
                            <span className="text-[11px] font-mono text-slate-400">@{u.username}</span>
                            {u.isPrimary && (
                              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                الموقع الافتراضي
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            صلاحية الوحدات:{' '}
                            {u.allowedModules === 'both'
                              ? 'كلا القسمين'
                              : u.allowedModules === 'accessories'
                              ? 'الإكسسوارات فقط'
                              : 'Compu MSS فقط'}
                          </div>
                        </div>

                        {!store.isArchived && (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleRemoveUser(u.id, u.username)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="إلغاء تعيين الشريك من هذا الفرع"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add User Form (Only if store is not archived) */}
                {!store.isArchived && (
                  <form
                    onSubmit={handleAddUser}
                    className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3 mt-3"
                  >
                    <label className="block text-[11px] font-bold text-slate-300">
                      + تعيين شريك / موظف إضافي لهذا الموقع:
                    </label>

                    {unassignedUsers.length === 0 ? (
                      <p className="text-slate-500 text-[11px]">
                        جميع المستخدمين الحاليين بالمنظومة معينون بالفعل بهذا الموقع.
                      </p>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <select
                          value={selectedUserIdToAdd}
                          onChange={e => setSelectedUserIdToAdd(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                        >
                          <option value="">اختر المستخدم / الشريك...</option>
                          {unassignedUsers.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.displayName} (@{u.username})
                            </option>
                          ))}
                        </select>

                        <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isPrimaryForNewUser}
                            onChange={e => setIsPrimaryForNewUser(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 bg-slate-900 border-slate-700"
                          />
                          <span>تعيين كموقع افتراضي</span>
                        </label>

                        <button
                          type="submit"
                          disabled={!selectedUserIdToAdd || actionLoading}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                        >
                          {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                          <span>تعيين بالموقع</span>
                        </button>
                      </div>
                    )}
                  </form>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoreDetailsModal;

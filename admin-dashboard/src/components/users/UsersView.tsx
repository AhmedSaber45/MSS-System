'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  KeyRound,
  Edit2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Store,
  Warehouse,
  Eye,
  EyeOff,
  ShieldAlert,
  AlertCircle,
  LogOut,
  Layers,
  ShieldCheck,
  Check,
  Trash2,
  Lock,
} from 'lucide-react';
import type { AppUser, SystemStore, ModulePermission, CreateAppUserInput, UpdateAppUserInput } from '@/types/admin';

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [stores, setStores] = useState<SystemStore[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<'all' | ModulePermission>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isChangeCodeOpen, setIsChangeCodeOpen] = useState(false);
  const [isDisableConfirmOpen, setIsDisableConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);

  // Forms state
  const [createForm, setCreateForm] = useState<CreateAppUserInput>({
    username: '',
    displayName: '',
    accessCode: '',
    confirmAccessCode: '',
    allowedModules: 'both',
    defaultStoreId: '',
    assignedStoreIds: [],
    isActive: true,
  });

  const [editForm, setEditForm] = useState<UpdateAppUserInput>({
    id: '',
    displayName: '',
    username: '',
    allowedModules: 'both',
    defaultStoreId: '',
    assignedStoreIds: [],
    isActive: true,
  });

  const [newAccessCode, setNewAccessCode] = useState('');
  const [confirmNewAccessCode, setConfirmNewAccessCode] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [showConfirmCode, setShowConfirmCode] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, storesRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/stores'),
      ]);
      const usersData = await usersRes.json();
      const storesData = await storesRes.json();
      setUsers(usersData.users || []);
      setStores(storesData.stores || []);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);

    if (createForm.accessCode !== createForm.confirmAccessCode) {
      setActionError('رمز الدخول وتأكيد الرمز غير متطابقين');
      setActionLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في إنشاء الحساب');

      setSuccessMessage(`تم إنشاء المستخدم "${data.user.displayName}" بنجاح وتشفير رمز الدخول.`);
      setIsCreateOpen(false);
      setCreateForm({
        username: '',
        displayName: '',
        accessCode: '',
        confirmAccessCode: '',
        allowedModules: 'both',
        defaultStoreId: '',
        assignedStoreIds: [],
        isActive: true,
      });
      await fetchData();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في تحديث الحساب');

      setSuccessMessage('تم تحديث بيانات المستخدم وصلاحياته وإصدارات الأمان بنجاح.');
      setIsEditOpen(false);
      await fetchData();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionLoading(true);
    setActionError(null);

    if (newAccessCode !== confirmNewAccessCode) {
      setActionError('رمز الدخول الجديد وتأكيد الرمز غير متطابقين');
      setActionLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_access_code',
          id: selectedUser.id,
          newAccessCode,
          confirmNewAccessCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في تغيير رمز الدخول');

      setSuccessMessage(`تم تغيير وتشفير رمز الدخول للمستخدم "${selectedUser.displayName}" بنجاح وزيادة إصدار الأمان وإبطال الجلسات السابقة.`);
      setIsChangeCodeOpen(false);
      setNewAccessCode('');
      setConfirmNewAccessCode('');
      await fetchData();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!selectedUser) return;
    const nextStatus = !selectedUser.isActive;
    setActionLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_status',
          id: selectedUser.id,
          isActive: nextStatus,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message || 'تم تحديث حالة الحساب بنجاح.');
        setIsDisableConfirmOpen(false);
        await fetchData();
      } else {
        setActionError(data.error || 'فشل في تحديث حالة الحساب');
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeSessions = async (user: AppUser) => {
    if (!window.confirm(`هل أنت متأكد من إبطال كافة الجلسات المفتوحة للمستخدم "${user.displayName}"؟ سيتطلب منه إعادة تسجيل الدخول فور اتصاله بالإنترنت.`)) {
      return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke_sessions',
          id: user.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message || 'تم إبطال كافة الجلسات بنجاح.');
        await fetchData();
      }
    } catch {
      // Handled
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(userToDelete.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في حذف المستخدم');

      setSuccessMessage(`تم حذف حساب المستخدم "${userToDelete.displayName}" نهائياً من النظام وإلغاء كافة صلاحياته.`);
      setIsDeleteConfirmOpen(false);
      setUserToDelete(null);
      await fetchData();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q);
      const matchesModule = moduleFilter === 'all' || u.allowedModules === moduleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && u.isActive) ||
        (statusFilter === 'disabled' && !u.isActive);
      const matchesStore =
        storeFilter === 'all' ||
        u.defaultStoreId === storeFilter ||
        (u.assignedStoreIds && u.assignedStoreIds.includes(storeFilter));
      return matchesSearch && matchesModule && matchesStatus && matchesStore;
    });
  }, [users, searchQuery, moduleFilter, statusFilter, storeFilter]);

  return (
    <div className="space-y-5">
      {/* Alert / Notification banner */}
      {successMessage && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white font-bold p-1">
            ✕
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" />
            <span>حسابات المستخدمين وصلاحيات الفروع</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {filteredUsers.length} مستخدم
            </span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            إدارة حسابات نقاط البيع والكاشير وتعيين الفروع وصلاحيات الأقسام
          </p>
        </div>

        <button
          onClick={() => {
            setActionError(null);
            setShowAccessCode(false);
            setShowConfirmCode(false);
            setCreateForm({
              username: '',
              displayName: '',
              accessCode: '',
              confirmAccessCode: '',
              allowedModules: 'both',
              defaultStoreId: '',
              assignedStoreIds: [],
              isActive: true,
            });
            setIsCreateOpen(true);
          }}
          className="px-3.5 py-2 bg-slate-100 hover:bg-white text-slate-900 text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-slate-800" />
          <span>إنشاء مستخدم جديد</span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-3 bg-[#101625] border border-slate-800/90 rounded-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="بحث بالاسم أو اسم المستخدم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-1.5 bg-[#0b0f19] border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/20"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Module Filter */}
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-[#0b0f19] border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-sky-500/80"
          >
            <option value="all">كافة الصلاحيات</option>
            <option value="both">Accessories + MSS</option>
            <option value="accessories">إكسسوارات فقط</option>
            <option value="mss">Compu MSS فقط</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-[#0b0f19] border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-sky-500/80"
          >
            <option value="all">كافة الحالات</option>
            <option value="active">النشطة فقط</option>
            <option value="disabled">المعطلة فقط</option>
          </select>

          {/* Store Filter */}
          {stores.length > 0 && (
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#0b0f19] border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-sky-500/80"
            >
              <option value="all">كافة الفروع والمخازن</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={fetchData}
            title="تحديث القائمة"
            className="p-1.5 bg-[#0b0f19] hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#101625] border border-slate-800/90 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#0c101a] border-b border-slate-800 text-slate-400 font-medium text-[11px]">
              <tr>
                <th className="py-2.5 px-3.5 font-normal">المستخدم</th>
                <th className="py-2.5 px-3.5 font-normal">صلاحيات الأقسام</th>
           
                <th className="py-2.5 px-3.5 font-normal text-center">إصدار الأمان</th>
                <th className="py-2.5 px-3.5 font-normal text-center">الحالة</th>
                <th className="py-2.5 px-3.5 font-normal">آخر دخول</th>
                <th className="py-2.5 px-3.5 font-normal text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300 font-mono">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-6 h-6 text-slate-600" />
                      <p className="text-xs font-medium text-slate-300">
                        {loading
                          ? 'جاري التحميل...'
                          : users.length === 0
                            ? 'لا يوجد مستخدمون مسجلون في النظام حتى الآن'
                            : 'لا يوجد مستخدمون مطابقون لمعايير البحث'}
                      </p>
                      {!loading && (
                        <button
                          onClick={() => setIsCreateOpen(true)}
                          className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700"
                        >
                          + إضافة أول مستخدم
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[#131a29] transition-colors">
                    {/* User Profile Cell */}
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2.5 font-sans">
                        <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 font-semibold text-xs shrink-0">
                          {user.displayName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-100 text-xs">{user.displayName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">@{user.username}</div>
                        </div>
                      </div>
                    </td>

                    {/* Module Permissions */}
                    <td className="py-2.5 px-3.5 font-sans">
                      {user.allowedModules === 'both' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-sky-950/40 text-sky-300 border border-sky-800/40">
                          كلا النشاطين (مشترك)
                        </span>
                      )}
                      {user.allowedModules === 'accessories' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/40 text-amber-300 border border-amber-800/40">
                          إكسسوارات فقط
                        </span>
                      )}
                      {user.allowedModules === 'mss' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                          Compu MSS فقط
                        </span>
                      )}
                    </td>

   

                    {/* Security Version */}
                    <td className="py-2.5 px-3.5 text-center">
                      <span
                        title={`إصدار الرمز: ${user.credentialVersion || 1} • إصدار الصلاحيات: ${user.permissionVersion || 1}`}
                        className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800"
                      >
                        <ShieldCheck className="w-3 h-3 text-sky-400" />
                        <span>v{user.credentialVersion || 1}.{user.permissionVersion || 1}</span>
                      </span>
                    </td>

                    {/* Status Pill */}
                    <td className="py-2.5 px-3.5 text-center font-sans">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          نشط
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-950/30 border border-rose-800/40 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          معطل
                        </span>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="py-2.5 px-3.5 text-slate-400 font-mono text-[11px]">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ar-EG') : 'لم يسجل دخول'}
                    </td>

                    {/* Actions Group */}
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center justify-center gap-1">
                        {/* Edit details */}
                        <button
                          onClick={() => {
                            setActionError(null);
                            setSelectedUser(user);
                            setEditForm({
                              id: user.id,
                              displayName: user.displayName,
                              username: user.username,
                              allowedModules: user.allowedModules,
                              defaultStoreId: user.defaultStoreId || '',
                              assignedStoreIds: user.assignedStoreIds || (user.defaultStoreId ? [user.defaultStoreId] : []),
                              isActive: user.isActive,
                            });
                            setIsEditOpen(true);
                          }}
                          title="تعديل البيانات والصلاحيات"
                          className="p-1 rounded bg-[#0b0f19] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>

                        {/* Change access code */}
                        <button
                          onClick={() => {
                            setActionError(null);
                            setSelectedUser(user);
                            setNewAccessCode('');
                            setConfirmNewAccessCode('');
                            setShowAccessCode(false);
                            setShowConfirmCode(false);
                            setIsChangeCodeOpen(true);
                          }}
                          title="تغيير وتشفير رمز الدخول"
                          className="p-1 rounded bg-[#0b0f19] hover:bg-slate-800 text-sky-400 hover:text-sky-300 border border-slate-800 transition-colors cursor-pointer"
                        >
                          <KeyRound className="w-3 h-3" />
                        </button>

                        {/* Revoke sessions */}
                        <button
                          onClick={() => handleRevokeSessions(user)}
                          title="إبطال كافة الجلسات المفتوحة للمستخدم"
                          className="p-1 rounded bg-[#0b0f19] hover:bg-slate-800 text-amber-400 hover:text-amber-300 border border-slate-800 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3 h-3" />
                        </button>

                        {/* Toggle status / Disable */}
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            if (user.isActive) {
                              setIsDisableConfirmOpen(true);
                            } else {
                              handleConfirmToggleStatus();
                            }
                          }}
                          title={user.isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                          className={`p-1 rounded border border-slate-800 transition-colors cursor-pointer ${
                            user.isActive
                              ? 'bg-[#0b0f19] hover:bg-rose-950/40 text-rose-400'
                              : 'bg-[#0b0f19] hover:bg-emerald-950/40 text-emerald-400'
                          }`}
                        >
                          {user.isActive ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                        </button>

                        {/* Permanently delete user */}
                        <button
                          onClick={() => {
                            setActionError(null);
                            setUserToDelete(user);
                            setIsDeleteConfirmOpen(true);
                          }}
                          title="حذف الحساب نهائياً"
                          className="p-1 rounded bg-[#0b0f19] hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 border border-slate-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================================ */}
      {/* MODAL: CREATE USER */}
      {/* ============================================================================ */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#101625] border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-400" />
                <span>إنشاء حساب مستخدم جديد</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-sm p-1"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-900/50 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">الاسم المعروض (الاسم الكامل) *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: محمد أحمد"
                    value={createForm.displayName}
                    onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                    className="w-full p-2 bg-[#0b0f19] border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/20"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">اسم المستخدم (Username) *</label>
                  <input
                    type="text"
                    required
                    placeholder="mohamed"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    className="w-full p-2 bg-[#0b0f19] border border-slate-800 rounded-lg text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              {/* Access Code & Confirmation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">رمز الدخول السري (Access PIN) *</label>
                  <div className="relative">
                    <input
                      type={showAccessCode ? 'text' : 'password'}
                      required
                      placeholder="4 خانات على الأقل"
                      value={createForm.accessCode}
                      onChange={(e) => setCreateForm({ ...createForm, accessCode: e.target.value })}
                      className="w-full p-2 bg-[#0b0f19] border border-slate-800 rounded-lg text-slate-200 font-mono pl-8 placeholder-slate-600 focus:outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccessCode(!showAccessCode)}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showAccessCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">تأكيد رمز الدخول *</label>
                  <div className="relative">
                    <input
                      type={showConfirmCode ? 'text' : 'password'}
                      required
                      placeholder="أعد إدخال الرمز"
                      value={createForm.confirmAccessCode}
                      onChange={(e) => setCreateForm({ ...createForm, confirmAccessCode: e.target.value })}
                      className="w-full p-2 bg-[#0b0f19] border border-slate-800 rounded-lg text-slate-200 font-mono pl-8 placeholder-slate-600 focus:outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmCode(!showConfirmCode)}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showConfirmCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Module Permission Selection */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">صلاحيات الوحدات (الأقسام المصرحة) *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label
                    className={`p-2.5 rounded-lg border flex flex-col justify-between cursor-pointer transition-colors ${
                      createForm.allowedModules === 'both'
                        ? 'bg-sky-950/30 border-sky-600/50 text-slate-100'
                        : 'bg-[#0b0f19] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-sky-400">كلا النشاطين</span>
                      <input
                        type="radio"
                        name="modules"
                        checked={createForm.allowedModules === 'both'}
                        onChange={() => setCreateForm({ ...createForm, allowedModules: 'both' })}
                        className="text-sky-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">إكسسوارات + Compu MSS المشترك</span>
                  </label>

                  <label
                    className={`p-2.5 rounded-lg border flex flex-col justify-between cursor-pointer transition-colors ${
                      createForm.allowedModules === 'accessories'
                        ? 'bg-amber-950/30 border-amber-600/50 text-slate-100'
                        : 'bg-[#0b0f19] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-amber-400">إكسسوارات فقط</span>
                      <input
                        type="radio"
                        name="modules"
                        checked={createForm.allowedModules === 'accessories'}
                        onChange={() => setCreateForm({ ...createForm, allowedModules: 'accessories' })}
                        className="text-amber-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">مبيعات ومخزون المحل فقط</span>
                  </label>

                  <label
                    className={`p-2.5 rounded-lg border flex flex-col justify-between cursor-pointer transition-colors ${
                      createForm.allowedModules === 'mss'
                        ? 'bg-emerald-950/30 border-emerald-600/50 text-slate-100'
                        : 'bg-[#0b0f19] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-emerald-400">Compu MSS فقط</span>
                      <input
                        type="radio"
                        name="modules"
                        checked={createForm.allowedModules === 'mss'}
                        onChange={() => setCreateForm({ ...createForm, allowedModules: 'mss' })}
                        className="text-emerald-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">أجهزة اللابتوب والشاشات فقط</span>
                  </label>
                </div>
              </div>




              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="userActive"
                  checked={createForm.isActive}
                  onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-sky-500"
                />
                <label htmlFor="userActive" className="text-slate-300 font-medium cursor-pointer">
                  تفعيل الحساب فور الإنشاء
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-white text-slate-900 font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-900" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>إنشاء الحساب وتشفيره</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL: EDIT USER */}
      {/* ============================================================================ */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#101625] border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-400" />
                <span>تعديل بيانات المستخدم: {selectedUser.displayName}</span>
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-500 hover:text-slate-300 text-sm p-1">
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-900/50 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleEditUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">الاسم المعروض *</label>
                  <input
                    type="text"
                    required
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    className="w-full p-2 bg-[#0b0f19] border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500/80"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">اسم المستخدم (Username) *</label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full p-2 bg-[#0b0f19] border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-sky-500/80"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">الصلاحيات المصرحة بالوحدات *</label>
                <select
                  value={editForm.allowedModules}
                  onChange={(e) => setEditForm({ ...editForm, allowedModules: e.target.value as ModulePermission })}
                  className="w-full p-2 bg-[#0b0f19] border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500/80 font-medium"
                >
                  <option value="both">كلا النشاطين (Accessories + Compu MSS المشترك)</option>
                  <option value="accessories">إكسسوارات فقط (Accessories Only)</option>
                  <option value="mss">Compu MSS فقط (أجهزة اللابتوب والشاشات)</option>
                </select>
                <p className="text-[10px] text-sky-400 mt-1 font-mono">
                  تعديل الصلاحيات سيزيد تلقائياً إصدار الصلاحيات (Permission Version) لتحديث الأمان.
                </p>
              </div>

     

  

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editUserActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-sky-500"
                />
                <label htmlFor="editUserActive" className="text-slate-300 font-medium cursor-pointer">
                  الحساب نشط ومصرح له بالدخول
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-white text-slate-900 font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-900" /> : <Edit2 className="w-3.5 h-3.5" />}
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL: CHANGE ACCESS CODE */}
      {/* ============================================================================ */}
      {isChangeCodeOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#101625] border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-sky-400" />
                <span>تغيير رمز الدخول: {selectedUser.displayName}</span>
              </h3>
              <button onClick={() => setIsChangeCodeOpen(false)} className="text-slate-500 hover:text-slate-300 text-sm p-1">
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-900/50 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="p-2.5 bg-[#0b0f19] border border-slate-800 rounded-lg text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-sky-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>إبطال الجلسات النشطة:</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                تغيير رمز الدخول سيزيد فوراً إصدار الأمان ويبطل كافة الجلسات المفتوحة للمستخدم، مما يتطلب إعادة تسجيل الدخول فور استعادة الاتصال.
              </p>
            </div>

            <form onSubmit={handleChangeCode} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">رمز الدخول الجديد *</label>
                <div className="relative">
                  <input
                    type={showAccessCode ? 'text' : 'password'}
                    required
                    placeholder="4 خانات على الأقل"
                    value={newAccessCode}
                    onChange={(e) => setNewAccessCode(e.target.value)}
                    className="w-full p-2 bg-[#0b0f19] border border-slate-800 rounded-lg text-slate-200 font-mono pl-8 focus:outline-none focus:border-sky-500/80"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessCode(!showAccessCode)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showAccessCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">تأكيد رمز الدخول الجديد *</label>
                <div className="relative">
                  <input
                    type={showConfirmCode ? 'text' : 'password'}
                    required
                    placeholder="أعد إدخال الرمز الجديد"
                    value={confirmNewAccessCode}
                    onChange={(e) => setConfirmNewAccessCode(e.target.value)}
                    className="w-full p-2 bg-[#0b0f19] border border-slate-800 rounded-lg text-slate-200 font-mono pl-8 focus:outline-none focus:border-sky-500/80"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmCode(!showConfirmCode)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirmCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsChangeCodeOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newAccessCode || !confirmNewAccessCode}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-white text-slate-900 font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-900" /> : <KeyRound className="w-3.5 h-3.5" />}
                  <span>تحديث وتشفير الرمز</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL: DISABLE USER CONFIRMATION */}
      {/* ============================================================================ */}
      {isDisableConfirmOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#101625] border border-slate-800 rounded-xl p-5 shadow-2xl space-y-3.5 text-center">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-100">
                تأكيد تعطيل حساب: {selectedUser.displayName}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                تعطيل الحساب سيمنع المستخدم فوراً من تسجيل الدخول وسيقوم بإبطال كافة الجلسات النشطة. يمكن إعادة تفعيله في أي وقت.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDisableConfirmOpen(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmToggleStatus}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {actionLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>نعم، تعطيل الحساب الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL: PERMANENT USER DELETION CONFIRMATION */}
      {/* ============================================================================ */}
      {isDeleteConfirmOpen && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#101625] border border-rose-900/40 rounded-xl p-5 shadow-2xl space-y-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5 text-rose-500" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-semibold text-slate-100">
                تأكيد حذف حساب المستخدم نهائياً
              </h3>
              <p className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/40 p-2 rounded-lg leading-relaxed font-mono">
                تنبيه أمني: هذا الإجراء نهائي ولا يمكن التراجع عنه.
              </p>
            </div>

            {/* User Account Info Card */}
            <div className="p-3 bg-[#0b0f19] rounded-lg border border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">الاسم:</span>
                <span className="font-semibold text-slate-200">{userToDelete.displayName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">اسم المستخدم:</span>
                <span className="text-sky-400">@{userToDelete.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">الصلاحيات:</span>
                <span className="text-slate-300">{userToDelete.allowedModules}</span>
              </div>
            </div>

            {/* Historical Business Data Preservation Notice */}
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-400 leading-relaxed">
              لن يتم حذف أي فواتير أو حركات مخزون سابقة أنشأها المستخدم، للحفاظ على دقة سجلات التدقيق المالي.
            </div>

            {actionError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-900/60 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setUserToDelete(null);
                  setActionError(null);
                }}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>تأكيد الحذف النهائي</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

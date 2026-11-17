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
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

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
    <div className="space-y-6">
      {/* Alert / Notification banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-primary" />
            <span>إدارة مستخدمي الفروع والصلاحيات</span>
          </h2>
          <p className="text-xs text-slate-400">
            إنشاء حسابات الموظفين، تشفير رموز الدخول (Bcrypt)، تعيين صلاحيات الوحدات، وإبطال الجلسات المركزية
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
          className="px-4 py-2.5 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-semibold rounded-lg shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>إنشاء مستخدم جديد</span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-4 bg-brand-card border border-brand-border rounded-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="بحث بالاسم أو اسم المستخدم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-10 py-2 bg-brand-surface border border-brand-border rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-primary"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Module Filter */}
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value as any)}
            className="px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
          >
            <option value="all">كافة الصلاحيات</option>
            <option value="both">كلا النشاطين (Accessories + MSS)</option>
            <option value="accessories">إكسسوارات فقط</option>
            <option value="mss">Compu MSS فقط</option>
          </select>

          {/* Store Filter */}
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
          >
            <option value="all">كافة الفروع والمخازن</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
          >
            <option value="all">كافة الحالات</option>
            <option value="active">النشطة فقط</option>
            <option value="disabled">المعطلة فقط</option>
          </select>

          <button
            onClick={fetchData}
            title="تحديث القائمة"
            className="p-2 bg-brand-surface hover:bg-slate-800 border border-brand-border rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-brand-surface/80 border-b border-brand-border text-slate-400 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">المستخدم</th>
                <th className="py-3 px-4">الصلاحيات المصرحة</th>
                <th className="py-3 px-4">الفروع المصرح بها</th>
                <th className="py-3 px-4 text-center">إصدار الأمان</th>
                <th className="py-3 px-4 text-center">الحالة</th>
                <th className="py-3 px-4">آخر دخول</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-slate-300">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    {loading ? 'جاري التحميل...' : 'لا يوجد مستخدمون مطابقون لمعايير البحث'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">{user.displayName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">@{user.username}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      {user.allowedModules === 'both' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/50">
                          كلا النشاطين (مشترك)
                        </span>
                      )}
                      {user.allowedModules === 'accessories' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/50">
                          إكسسوارات فقط
                        </span>
                      )}
                      {user.allowedModules === 'mss' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                          Compu MSS فقط
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{user.defaultStoreName || 'بدون فرع افتراضي'}</span>
                      </div>
                      {(user.assignedStoreIds && user.assignedStoreIds.length > 1) && (
                        <span className="text-[10px] text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                          +{user.assignedStoreIds.length - 1} فروع إضافية
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        title={`إصدار الرمز: ${user.credentialVersion || 1} • إصدار الصلاحيات: ${user.permissionVersion || 1}`}
                        className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-brand-border"
                      >
                        <ShieldCheck className="w-3 h-3 text-brand-primary" />
                        <span>v{user.credentialVersion || 1}.{user.permissionVersion || 1}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          نشط
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          معطل
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ar-EG') : 'لم يسجل دخول'}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
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
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
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
                          className="p-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 text-brand-primary border border-blue-800/40 transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {/* Revoke sessions */}
                        <button
                          onClick={() => handleRevokeSessions(user)}
                          title="إبطال كافة الجلسات المفتوحة للمستخدم"
                          className="p-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/40 text-amber-400 border border-amber-900/40 transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
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
                          className={`p-1.5 rounded-lg transition-colors ${
                            user.isActive
                              ? 'bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 border border-rose-900/40'
                              : 'bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/40'
                          }`}
                        >
                          {user.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-brand-card border border-brand-border rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-primary" />
                <span>إنشاء حساب مستخدم جديد</span>
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">الاسم المعروض (الاسم الكامل) *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: محمود مسعود"
                    value={createForm.displayName}
                    onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                    className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    اسم المستخدم (Username) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: masoud"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 font-mono focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* Access Code and Confirm Access Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">رمز الدخول الأولي *</label>
                  <div className="relative">
                    <input
                      type={showAccessCode ? 'text' : 'password'}
                      required
                      placeholder="4 خانات فأكثر"
                      value={createForm.accessCode}
                      onChange={(e) => setCreateForm({ ...createForm, accessCode: e.target.value })}
                      className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 font-mono pl-10 focus:outline-none focus:border-brand-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccessCode(!showAccessCode)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showAccessCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">تأكيد رمز الدخول *</label>
                  <div className="relative">
                    <input
                      type={showConfirmCode ? 'text' : 'password'}
                      required
                      placeholder="أعد إدخال الرمز"
                      value={createForm.confirmAccessCode}
                      onChange={(e) => setCreateForm({ ...createForm, confirmAccessCode: e.target.value })}
                      className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 font-mono pl-10 focus:outline-none focus:border-brand-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmCode(!showConfirmCode)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showConfirmCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Module selection */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">صلاحية الوحدات المصرحة *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label
                    className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-all ${
                      createForm.allowedModules === 'both'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-200'
                        : 'bg-brand-surface border-brand-border text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="module"
                      value="both"
                      checked={createForm.allowedModules === 'both'}
                      onChange={() => setCreateForm({ ...createForm, allowedModules: 'both' })}
                      className="sr-only"
                    />
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>كلا النشاطين</span>
                      {createForm.allowedModules === 'both' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </div>
                    <span className="text-[10px] mt-1 text-slate-400">إكسسوارات + Compu MSS المشترك</span>
                  </label>

                  <label
                    className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-all ${
                      createForm.allowedModules === 'accessories'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-brand-surface border-brand-border text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="module"
                      value="accessories"
                      checked={createForm.allowedModules === 'accessories'}
                      onChange={() => setCreateForm({ ...createForm, allowedModules: 'accessories' })}
                      className="sr-only"
                    />
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>إكسسوارات فقط</span>
                      {createForm.allowedModules === 'accessories' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <span className="text-[10px] mt-1 text-slate-400">نظام الإكسسوارات المحلي فقط</span>
                  </label>

                  <label
                    className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-all ${
                      createForm.allowedModules === 'mss'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200'
                        : 'bg-brand-surface border-brand-border text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="module"
                      value="mss"
                      checked={createForm.allowedModules === 'mss'}
                      onChange={() => setCreateForm({ ...createForm, allowedModules: 'mss' })}
                      className="sr-only"
                    />
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Compu MSS فقط</span>
                      {createForm.allowedModules === 'mss' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <span className="text-[10px] mt-1 text-slate-400">أجهزة اللابتوب والشاشات فقط</span>
                  </label>
                </div>
              </div>

              {/* Default Store */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">الفرع أو المخزن الافتراضي</label>
                <select
                  value={createForm.defaultStoreId || ''}
                  onChange={(e) => {
                    const stId = e.target.value;
                    const assigned = createForm.assignedStoreIds || [];
                    const nextAssigned = stId && !assigned.includes(stId) ? [...assigned, stId] : assigned;
                    setCreateForm({ ...createForm, defaultStoreId: stId, assignedStoreIds: nextAssigned });
                  }}
                  className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary"
                >
                  <option value="">بدون ربط افتراضي</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) - {s.type === 'store' ? 'محل' : 'مخزن'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Stores Multi-selection */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">الفروع والمخازن المصرح للمستخدم بالعمل عليها</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-brand-surface/60 rounded-xl border border-brand-border max-h-36 overflow-y-auto">
                  {stores.map((store) => {
                    const isChecked = createForm.assignedStoreIds?.includes(store.id);
                    return (
                      <label key={store.id} className="flex items-center gap-2 text-slate-300 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const cur = createForm.assignedStoreIds || [];
                            const next = e.target.checked ? [...cur, store.id] : cur.filter((id) => id !== store.id);
                            setCreateForm({ ...createForm, assignedStoreIds: next });
                          }}
                          className="rounded bg-brand-surface border-brand-border text-brand-primary"
                        />
                        <span className="truncate">
                          {store.name} <span className="text-[10px] text-slate-500 font-mono">({store.code})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="userActive"
                  checked={createForm.isActive}
                  onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                  className="rounded bg-brand-surface border-brand-border text-brand-primary"
                />
                <label htmlFor="userActive" className="text-slate-300 font-medium cursor-pointer">
                  تفعيل الحساب فور الإنشاء
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-brand-primary hover:bg-brand-secondary text-white font-semibold rounded-lg shadow-lg shadow-brand-primary/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>إنشاء وتشفير الحساب</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-brand-card border border-brand-border rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-brand-primary" />
                <span>تعديل بيانات المستخدم: {selectedUser.displayName}</span>
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleEditUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">الاسم المعروض *</label>
                  <input
                    type="text"
                    required
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">اسم المستخدم (Username) *</label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 font-mono focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">الصلاحيات المصرحة بالوحدات *</label>
                <select
                  value={editForm.allowedModules}
                  onChange={(e) => setEditForm({ ...editForm, allowedModules: e.target.value as ModulePermission })}
                  className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary font-medium"
                >
                  <option value="both">كلا النشاطين (Accessories + Compu MSS المشترك)</option>
                  <option value="accessories">إكسسوارات فقط (Accessories Only)</option>
                  <option value="mss">Compu MSS فقط (أجهزة اللابتوب والشاشات)</option>
                </select>
                <p className="text-[10px] text-brand-primary mt-1">
                  تعديل الصلاحيات سيقوم تلقائياً بزيادة إصدار الصلاحيات (Permission Version) وتحديثه على التطبيق.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">الفرع أو المخزن الافتراضي</label>
                <select
                  value={editForm.defaultStoreId || ''}
                  onChange={(e) => setEditForm({ ...editForm, defaultStoreId: e.target.value })}
                  className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 focus:outline-none focus:border-brand-primary"
                >
                  <option value="">بدون ربط افتراضي</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Stores Multi-selection */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">الفروع والمخازن المصرح بها</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-brand-surface/60 rounded-xl border border-brand-border max-h-36 overflow-y-auto">
                  {stores.map((store) => {
                    const isChecked = editForm.assignedStoreIds?.includes(store.id);
                    return (
                      <label key={store.id} className="flex items-center gap-2 text-slate-300 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const cur = editForm.assignedStoreIds || [];
                            const next = e.target.checked ? [...cur, store.id] : cur.filter((id) => id !== store.id);
                            setEditForm({ ...editForm, assignedStoreIds: next });
                          }}
                          className="rounded bg-brand-surface border-brand-border text-brand-primary"
                        />
                        <span className="truncate">
                          {store.name} <span className="text-[10px] text-slate-500 font-mono">({store.code})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editUserActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="rounded bg-brand-surface border-brand-border text-brand-primary"
                />
                <label htmlFor="editUserActive" className="text-slate-300 font-medium cursor-pointer">
                  الحساب نشط ومصرح له بالدخول
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-brand-primary hover:bg-brand-secondary text-white font-semibold rounded-lg shadow-lg shadow-brand-primary/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-brand-card border border-brand-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-brand-primary" />
                <span>تغيير رمز الدخول: {selectedUser.displayName}</span>
              </h3>
              <button onClick={() => setIsChangeCodeOpen(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="p-3 bg-blue-950/30 border border-blue-900/40 rounded-xl text-xs text-blue-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-brand-primary shrink-0" />
                <span>الأمان وإبطال الجلسات السابقة:</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                تغيير رمز الدخول سيقوم فوراً بزيادة إصدار الأمان وإبطال كافة الجلسات المفتوحة للمستخدم، بحيث يُطلب منه
                إعادة تسجيل الدخول فور استعادة الاتصال.
              </p>
            </div>

            <form onSubmit={handleChangeCode} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">رمز الدخول الجديد *</label>
                <div className="relative">
                  <input
                    type={showAccessCode ? 'text' : 'password'}
                    required
                    placeholder="4 خانات على الأقل"
                    value={newAccessCode}
                    onChange={(e) => setNewAccessCode(e.target.value)}
                    className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 font-mono pl-10 focus:outline-none focus:border-brand-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessCode(!showAccessCode)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showAccessCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">تأكيد رمز الدخول الجديد *</label>
                <div className="relative">
                  <input
                    type={showConfirmCode ? 'text' : 'password'}
                    required
                    placeholder="أعد إدخال الرمز الجديد"
                    value={confirmNewAccessCode}
                    onChange={(e) => setConfirmNewAccessCode(e.target.value)}
                    className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 font-mono pl-10 focus:outline-none focus:border-brand-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmCode(!showConfirmCode)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirmCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setIsChangeCodeOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newAccessCode || !confirmNewAccessCode}
                  className="px-5 py-2 bg-brand-primary hover:bg-brand-secondary text-white font-semibold rounded-lg shadow-lg shadow-brand-primary/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-brand-card border border-rose-900/50 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-white">
                تأكيد تعطيل حساب: {selectedUser.displayName}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                تعطيل الحساب سيمنع المستخدم فوراً من تسجيل الدخول وسيقوم بإبطال كافة الجلسات النشطة.
                <br />
                <span className="text-slate-400 text-[11px]">
                  لن يتم حذف بيانات الحساب ويمكنك إعادة تفعيله في أي وقت.
                </span>
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setIsDisableConfirmOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmToggleStatus}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-lg shadow-rose-600/25 flex items-center gap-1.5 transition-all"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>نعم، تعطيل الحساب الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

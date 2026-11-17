'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Warehouse,
  Plus,
  GitMerge,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Archive,
  Users,
  Smartphone,
  Info,
  RefreshCw,
  ExternalLink,
  Layers
} from 'lucide-react';
import { SystemStore, AppUser, StoreAssignedUser } from '@/types/admin';
import { StoreMergeWizardModal } from './StoreMergeWizardModal';
import { StoreDetailsModal } from './StoreDetailsModal';

export function StoresView() {
  const [stores, setStores] = useState<SystemStore[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'store' | 'warehouse' | 'combined'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<SystemStore | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    type: 'store' as 'store' | 'warehouse' | 'combined',
    description: '',
    isActive: true,
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchStoresAndUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const [storesRes, usersRes] = await Promise.all([
        fetch('/api/stores'),
        fetch('/api/users')
      ]);

      if (!storesRes.ok) throw new Error('Failed to fetch locations');
      const storesData = await storesRes.json();
      setStores(storesData.stores || []);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
    } catch (err: any) {
      console.error('Fetch stores error:', err);
      setError(err.message || 'Error loading stores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoresAndUsers();
  }, []);

  const filteredStores = useMemo(() => {
    return stores.filter(store => {
      // Search
      const matchesSearch =
        store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        store.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (store.description && store.description.toLowerCase().includes(searchTerm.toLowerCase()));

      // Type
      const matchesType = typeFilter === 'all' || store.type === typeFilter;

      // Status
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = store.isActive && !store.isArchived;
      if (statusFilter === 'inactive') matchesStatus = !store.isActive && !store.isArchived;
      if (statusFilter === 'archived') matchesStatus = !!store.isArchived;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [stores, searchTerm, typeFilter, statusFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const total = stores.length;
    const active = stores.filter(s => s.isActive && !s.isArchived).length;
    const retail = stores.filter(s => s.type === 'store').length;
    const warehouses = stores.filter(s => s.type === 'warehouse').length;
    const combined = stores.filter(s => s.type === 'combined').length;
    const archived = stores.filter(s => s.isArchived).length;

    return { total, active, retail, warehouses, combined, archived };
  }, [stores]);

  const handleOpenDetails = (store: SystemStore) => {
    setSelectedStore(store);
    setIsDetailsModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.code.trim()) {
      setCreateError('Name and code are required');
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create location');

      setIsCreateModalOpen(false);
      setCreateForm({
        name: '',
        code: '',
        type: 'store',
        description: '',
        isActive: true,
      });
      fetchStoresAndUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Creation error');
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Notice */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white tracking-tight">Stores, Warehouses & Partners</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Manage physical locations, retail shops, and warehouses independently from user accounts.
              Inventory ownership is tied permanently to locations (&quot;Users Are Not Warehouses&quot;).
              Safely assign partners or merge physical branches while preserving complete historical records.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMergeModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <GitMerge className="w-4 h-4 text-amber-400" />
              Merge Locations
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              Add Location
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-400">Total Locations</div>
          <div className="text-2xl font-bold text-white mt-1">{kpis.total}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs font-medium text-emerald-400">Active Locations</div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">{kpis.active}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs font-medium text-indigo-400">Retail Stores</div>
          <div className="text-2xl font-bold text-indigo-300 mt-1">{kpis.retail}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs font-medium text-amber-400">Warehouses</div>
          <div className="text-2xl font-bold text-amber-300 mt-1">{kpis.warehouses}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs font-medium text-purple-400">Combined</div>
          <div className="text-2xl font-bold text-purple-300 mt-1">{kpis.combined}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs font-medium text-rose-400">Archived / Merged</div>
          <div className="text-2xl font-bold text-rose-300 mt-1">{kpis.archived}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, code or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Type Filter */}
          <div className="flex items-center gap-1.5 bg-slate-800/70 p-1 rounded-lg border border-slate-700/60">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('store')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === 'store' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Stores
            </button>
            <button
              onClick={() => setTypeFilter('warehouse')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === 'warehouse' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Warehouses
            </button>
            <button
              onClick={() => setTypeFilter('combined')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === 'combined' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Combined
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-800/70 p-1 rounded-lg border border-slate-700/60">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === 'active' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === 'inactive' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Inactive
            </button>
            <button
              onClick={() => setStatusFilter('archived')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === 'archived' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Archived
            </button>
          </div>

          <button
            onClick={fetchStoresAndUsers}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700/80 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid of Locations */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Loading locations & assigned partners...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchStoresAndUsers}
            className="text-xs underline hover:text-rose-300 font-medium"
          >
            Retry
          </button>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 border border-slate-800 rounded-xl">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-base font-medium text-slate-300">No locations found</p>
          <p className="text-sm text-slate-500 mt-1">
            Try adjusting your search query or status filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStores.map(store => {
            const isWarehouse = store.type === 'warehouse';
            const isCombined = store.type === 'combined';
            const isArchived = store.isArchived;

            return (
              <div
                key={store.id}
                className={`bg-slate-900 border rounded-xl p-5 flex flex-col justify-between transition-all hover:border-slate-700 ${
                  isArchived
                    ? 'border-slate-800/60 opacity-60 bg-slate-950/40'
                    : 'border-slate-800 shadow-sm'
                }`}
              >
                <div>
                  {/* Top Badge Row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${
                        isWarehouse
                          ? 'bg-amber-500/10 text-amber-400'
                          : isCombined
                          ? 'bg-purple-500/10 text-purple-400'
                          : 'bg-indigo-500/10 text-indigo-400'
                      }`}>
                        {isWarehouse ? <Warehouse className="w-4 h-4" /> : isCombined ? <Layers className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-base leading-tight">
                          {store.name}
                        </h3>
                        <span className="font-mono text-xs text-slate-400 tracking-wider">
                          {store.code}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    {isArchived ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <Archive className="w-3 h-3" />
                        Archived
                      </span>
                    ) : store.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <XCircle className="w-3 h-3" />
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Description if present */}
                  {store.description && (
                    <p className="text-xs text-slate-400 mb-4 line-clamp-2 italic">
                      {store.description}
                    </p>
                  )}

                  {/* Merge lineage notice if archived via merge */}
                  {store.mergedIntoName && (
                    <div className="mb-4 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-center gap-2">
                      <GitMerge className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Merged into <strong>{store.mergedIntoName}</strong></span>
                    </div>
                  )}

                  {/* Type badge & Metadata */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide bg-slate-800 text-slate-300 border border-slate-700">
                      {store.type}
                    </span>

                    {/* Device count badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-800/80 text-slate-300 border border-slate-700/60">
                      <Smartphone className="w-3 h-3 text-indigo-400" />
                      {store.deviceCount ?? 0} Devices
                    </span>

                    {/* Partner / User count badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-800/80 text-slate-300 border border-slate-700/60">
                      <Users className="w-3 h-3 text-emerald-400" />
                      {(store.assignedUsers || []).length} Partners
                    </span>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 font-mono">
                    Created {new Date(store.createdAt).toLocaleDateString()}
                  </div>

                  <button
                    onClick={() => handleOpenDetails(store)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors"
                  >
                    Manage & Partners
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details & Partner Management Modal */}
      {isDetailsModalOpen && selectedStore && (
        <StoreDetailsModal
          storeId={selectedStore.id}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedStore(null);
          }}
          onRefreshParent={fetchStoresAndUsers}
        />
      )}

      {/* Store Merge 5-Step Wizard Modal */}
      {isMergeModalOpen && (
        <StoreMergeWizardModal
          availableStores={stores.filter(s => !s.isArchived)}
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          onSuccess={() => {
            setIsMergeModalOpen(false);
            fetchStoresAndUsers();
          }}
        />
      )}

      {/* Create Location Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Create New Location</h3>
                  <p className="text-xs text-slate-400">Add a retail store, warehouse, or combined facility</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Location Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. فرع وسط البلد or Main Hub"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Code / Identifier *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DOWNTOWN_01 or SHOP_1"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Must be unique across all active locations.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Location Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, type: 'store' })}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                      createForm.type === 'store'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Retail Store</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, type: 'warehouse' })}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                      createForm.type === 'warehouse'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Warehouse className="w-4 h-4" />
                    <span>Warehouse</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, type: 'combined' })}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                      createForm.type === 'combined'
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Combined</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Description / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Address details, inventory notes, or operational role..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="createIsActive"
                  checked={createForm.isActive}
                  onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="createIsActive" className="text-xs text-slate-300">
                  Location is active immediately
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {createSubmitting ? 'Creating...' : 'Create Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StoresView;

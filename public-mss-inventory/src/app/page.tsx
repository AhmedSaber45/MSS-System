'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '../components/Header';
import { StatsBanner } from '../components/StatsBanner';
import { SearchAndFilters } from '../components/SearchAndFilters';
import { InventoryTable } from '../components/InventoryTable';
import { InventoryCard } from '../components/InventoryCard';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import {
  fetchPublicInventory,
  subscribeToLiveInventory,
} from '../services/publicInventoryService';
import type {
  PublicInventoryItem,
  DynamicStore,
  InventoryFilters,
  InventoryStats,
} from '../types/inventory';

export default function PublicInventoryPage() {
  const [items, setItems] = useState<PublicInventoryItem[]>([]);
  const [stores, setStores] = useState<DynamicStore[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [filters, setFilters] = useState<InventoryFilters>({
    searchQuery: '',
    selectedBranch: 'all',
    selectedStatus: 'AVAILABLE', // Default selection is Available (متوفر)
    selectedCategory: 'all',
    sortBy: 'name-asc',
  });

  const loadInventory = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }

    try {
      const result = await fetchPublicInventory();
      if (result.error && result.items.length === 0) {
        setError(result.error);
      } else {
        setItems(result.items);
        setStores(result.stores);
        setError(null);
      }
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل بيانات الأجهزة المتوفرة');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch and Realtime sync listener
  useEffect(() => {
    loadInventory();

    const unsubscribe = subscribeToLiveInventory(() => {
      loadInventory(false);
    });

    return () => {
      unsubscribe();
    };
  }, [loadInventory]);

  // Derived categories from loaded items
  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    items.forEach((item) => {
      if (item.category) categorySet.add(item.category);
    });
    return Array.from(categorySet).sort();
  }, [items]);

  // Derived inventory stats
  const stats: InventoryStats = useMemo(() => {
    const uniqueModelIds = new Set(items.map((i) => i.model_id));
    let availableCount = 0;
    let reservedCount = 0;
    let soldCount = 0;
    const branchSet = new Set<string>();

    items.forEach((i) => {
      if (i.branch_name) branchSet.add(i.branch_name);
      if (i.status === 'AVAILABLE') availableCount += i.quantity || 1;
      else if (i.status === 'RESERVED') reservedCount += i.quantity || 1;
      else if (i.status === 'SOLD') soldCount += i.quantity || 1;
    });

    return {
      totalModels: uniqueModelIds.size,
      availableCount,
      reservedCount,
      soldCount,
      totalDevices: availableCount + reservedCount + soldCount,
      branchesCount: branchSet.size,
    };
  }, [items]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Status filter
    if (filters.selectedStatus !== 'ALL') {
      result = result.filter((item) => item.status === filters.selectedStatus);
    }

    // Branch filter (dynamic)
    if (filters.selectedBranch !== 'all') {
      result = result.filter((item) => item.branch_name === filters.selectedBranch);
    }

    // Category filter
    if (filters.selectedCategory !== 'all') {
      result = result.filter((item) => item.category === filters.selectedCategory);
    }

    // Search query filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.trim().toLowerCase();
      result = result.filter((item) => {
        const textToSearch = [
          item.model_name,
          item.brand,
          item.category,
          item.processor,
          item.gpu,
          item.ram,
          item.storage,
          item.screen_size,
          item.specifications,
          item.branch_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return textToSearch.includes(query);
      });
    }

    // Sort
    result.sort((a, b) => {
      if (filters.sortBy === 'price-asc') {
        return a.selling_price - b.selling_price;
      }
      if (filters.sortBy === 'price-desc') {
        return b.selling_price - a.selling_price;
      }
      if (filters.sortBy === 'qty-desc') {
        return b.quantity - a.quantity;
      }
      // 'name-asc' default
      const nameA = `${a.brand} ${a.model_name}`.toLowerCase();
      const nameB = `${b.brand} ${b.model_name}`.toLowerCase();
      return nameA.localeCompare(nameB, 'ar');
    });

    return result;
  }, [items, filters]);

  const hasActiveFilters = Boolean(
    filters.searchQuery.trim() ||
    filters.selectedBranch !== 'all' ||
    filters.selectedStatus !== 'AVAILABLE' ||
    filters.selectedCategory !== 'all' ||
    filters.sortBy !== 'name-asc'
  );

  const handleClearFilters = () => {
    setFilters({
      searchQuery: '',
      selectedBranch: 'all',
      selectedStatus: 'AVAILABLE',
      selectedCategory: 'all',
      sortBy: 'name-asc',
    });
  };

  const handleFilterChange = (newFilters: Partial<InventoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <Header
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRefresh={() => loadInventory(true)}
        isLive={!error}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        
        {/* Inventory Statistics */}
        <StatsBanner stats={stats} />

        {/* Search, Status, Branch, and Category Filters */}
        <SearchAndFilters
          filters={filters}
          stores={stores}
          categories={categories}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Active Results Summary */}
        <div className="flex items-center justify-between mb-3.5 text-xs text-slate-500 font-medium">
          <div>
            النتائج المعروضة:{' '}
            <span className="font-bold text-slate-800 font-mono">
              {filteredItems.length}
            </span>{' '}
            سجل
          </div>
          <div className="flex items-center gap-3">
            {filters.selectedBranch !== 'all' && (
              <span className="text-teal-800 font-semibold">
                الفرع: {filters.selectedBranch}
              </span>
            )}
            <span className="text-slate-600">
              الحالة:{' '}
              <strong className="text-slate-900">
                {filters.selectedStatus === 'AVAILABLE'
                  ? 'متوفر'
                  : filters.selectedStatus === 'RESERVED'
                  ? 'محجوز'
                  : filters.selectedStatus === 'SOLD'
                  ? 'مباع'
                  : 'كافة الحالات'}
              </strong>
            </span>
          </div>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadInventory(true)} />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            hasFilters={hasActiveFilters}
            onResetFilters={handleClearFilters}
          />
        ) : (
          <>
            {/* Desktop / Tablet Table View */}
            <InventoryTable items={filteredItems} />

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredItems.map((item) => (
                <InventoryCard key={item.id} item={item} />
              ))}
            </div>
          </>
        )}

      </main>
    </div>
  );
}

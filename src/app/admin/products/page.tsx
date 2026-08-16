'use client';

import React, { useState, useEffect } from 'react';
import { BulkEditModal } from '@/components/BulkEditModal';
import { useBulkEdit } from '@/hooks/useBulkEdit';
import { Product } from '@/types/product';

/**
 * AdminProductsPage
 * 
 * Example page showing how to use the BulkEditModal with Shopify-like functionality:
 * - Select multiple products via checkboxes
 * - Click "Bulk Edit" to open the spreadsheet-like editor
 * - Choose which columns to display and edit
 * - Edit cells inline with Excel-like features:
 *   - Arrow keys to navigate
 *   - Shift+Click for adjacent cell ranges
 *   - Alt/Cmd+Click for non-adjacent multi-select
 *   - Drag the fill handle (green square) to auto-fill cells below
 * - Save changes to Firestore
 */

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { submitBulkUpdates, isLoading: isSubmitting } = useBulkEdit();

  // Fetch all products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleSelectProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const handleBulkEditSave = async (
    updates: Array<{ id: string; changes: Partial<Product> }>
  ) => {
    try {
      const result = await submitBulkUpdates(updates);
      console.log('Bulk update successful:', result);

      // Update local state
      setProducts(prev =>
        prev.map(p => {
          const update = updates.find(u => u.id === p.id);
          return update ? { ...p, ...update.changes } : p;
        })
      );

      // Clear selection
      setSelectedProducts(new Set());
      setIsBulkEditOpen(false);

      // Show success message
      alert(`Successfully updated ${result.results.updated.length} product(s)`);
    } catch (error) {
      console.error('Bulk edit failed:', error);
      throw error;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading products...</div>;
  }

  const selectedProductsList = products.filter(p => selectedProducts.has(p.id));

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Products</h1>
        <p className="text-gray-600">Manage your product catalog</p>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {selectedProducts.size} of {products.length} selected
          </span>
        </div>
        {selectedProducts.size > 0 && (
          <button
            onClick={() => setIsBulkEditOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            Bulk Edit ({selectedProducts.size})
          </button>
        )}
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedProducts.size === products.length && products.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Product</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Price</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Compare At</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Stock</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, idx) => (
              <tr
                key={product.id}
                className={`border-b border-gray-200 hover:bg-gray-50 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product.id)}
                    onChange={() => handleSelectProduct(product.id)}
                    className="w-4 h-4"
                  />
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 truncate">
                  {product.title}
                </td>
                <td className="px-4 py-3 text-gray-600">${product.price || '—'}</td>
                <td className="px-4 py-3 text-gray-600">${product.compareAtPrice || '—'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {product.inventoryQuantity || 0} units
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      product.available
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {product.available ? 'Active' : 'Sold Out'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk Edit Modal */}
      <BulkEditModal
        products={selectedProductsList}
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        onSave={handleBulkEditSave}
      />
    </div>
  );
}

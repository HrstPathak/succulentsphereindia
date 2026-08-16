'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Product } from '@/types/product';

interface BulkEditColumn {
  key: keyof Product;
  label: string;
  type: 'text' | 'number' | 'checkbox' | 'select';
  options?: { label: string; value: any }[];
}

const AVAILABLE_COLUMNS: BulkEditColumn[] = [
  { key: 'title', label: 'Product Name', type: 'text' },
  { key: 'price', label: 'Sale Price', type: 'number' },
  { key: 'compareAtPrice', label: 'Regular Price', type: 'number' },
  { key: 'available', label: 'In Stock', type: 'checkbox' },
  { key: 'inventoryQuantity', label: 'Quantity', type: 'number' },
  { key: 'status', label: 'Status', type: 'select', options: [
    { label: 'Active', value: 'active' },
    { label: 'Sold Out', value: 'sold out' },
  ]},
  { key: 'availability', label: 'Availability', type: 'select', options: [
    { label: 'In Stock', value: 'InStock' },
    { label: 'Out of Stock', value: 'OutOfStock' },
  ]},
  // NOTE: image, images, and imageAlt are intentionally excluded from bulk edit
  // Images should only be updated via the dedicated image upload in individual product editor
];

interface CellSelection {
  row: number;
  col: number;
}

interface DragState {
  start: CellSelection | null;
  end: CellSelection | null;
  isActive: boolean;
}

export interface BulkEditModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Array<{ id: string; changes: Partial<Product> }>) => Promise<void>;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  products,
  isOpen,
  onClose,
  onSave,
}) => {
  const [selectedColumns, setSelectedColumns] = useState<BulkEditColumn[]>(AVAILABLE_COLUMNS.slice(0, 3));
  const [editData, setEditData] = useState<Partial<Product>[]>([]);
  const [selectedCells, setSelectedCells] = useState<CellSelection[]>([]);
  const [dragState, setDragState] = useState<DragState>({ start: null, end: null, isActive: false });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Initialize edit data
  useEffect(() => {
    if (isOpen) {
      setEditData(products.map(p => ({ ...p })));
      setSelectedCells([]);
      setError(null);
    }
  }, [isOpen, products]);

  const handleColumnToggle = (column: BulkEditColumn) => {
    setSelectedColumns(prev =>
      prev.find(c => c.key === column.key)
        ? prev.filter(c => c.key !== column.key)
        : [...prev, column]
    );
  };

  const handleCellChange = (rowIdx: number, colIdx: number, value: any) => {
    const columnKey = selectedColumns[colIdx].key;
    setEditData(prev => {
      const updated = [...prev];
      updated[rowIdx] = { ...updated[rowIdx], [columnKey]: value };
      return updated;
    });
  };

  const handleCellClick = (rowIdx: number, colIdx: number, e: React.MouseEvent) => {
    const isShift = e.shiftKey;
    const isAlt = e.altKey || e.metaKey;

    if (isShift && selectedCells.length > 0) {
      // Range selection
      const lastCell = selectedCells[selectedCells.length - 1];
      const newSelection: CellSelection[] = [];
      const startRow = Math.min(lastCell.row, rowIdx);
      const endRow = Math.max(lastCell.row, rowIdx);
      const startCol = Math.min(lastCell.col, colIdx);
      const endCol = Math.max(lastCell.col, colIdx);

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          newSelection.push({ row: r, col: c });
        }
      }
      setSelectedCells(newSelection);
    } else if (isAlt) {
      // Multi-select (non-adjacent)
      const exists = selectedCells.find(c => c.row === rowIdx && c.col === colIdx);
      if (exists) {
        setSelectedCells(prev => prev.filter(c => !(c.row === rowIdx && c.col === colIdx)));
      } else {
        setSelectedCells(prev => [...prev, { row: rowIdx, col: colIdx }]);
      }
    } else {
      // Single select
      setSelectedCells([{ row: rowIdx, col: colIdx }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>, rowIdx: number, colIdx: number) => {
    if (selectedCells.length === 0) return;

    const lastCell = selectedCells[selectedCells.length - 1];
    let newRow = lastCell.row;
    let newCol = lastCell.col;

    if (e.key === 'ArrowUp') {
      newRow = Math.max(0, newRow - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      newRow = Math.min(editData.length - 1, newRow + 1);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      newCol = Math.max(0, newCol - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      newCol = Math.min(selectedColumns.length - 1, newCol + 1);
      e.preventDefault();
    } else {
      return;
    }

    setSelectedCells([{ row: newRow, col: newCol }]);
  };

  const startDragFill = (rowIdx: number, colIdx: number) => {
    setDragState({ start: { row: rowIdx, col: colIdx }, end: null, isActive: true });
  };

  const handleDragOverCell = (rowIdx: number, colIdx: number) => {
    if (dragState.isActive && dragState.start) {
      setDragState(prev => ({ ...prev, end: { row: rowIdx, col: colIdx } }));
    }
  };

  const handleDragEnd = () => {
    if (dragState.isActive && dragState.start && dragState.end) {
      const startRow = Math.min(dragState.start.row, dragState.end.row);
      const endRow = Math.max(dragState.start.row, dragState.end.row);
      const colIdx = dragState.start.col;

      const sourceValue = editData[dragState.start.row][selectedColumns[colIdx].key];

      setEditData(prev => {
        const updated = [...prev];
        for (let r = startRow; r <= endRow; r++) {
          updated[r] = { ...updated[r], [selectedColumns[colIdx].key]: sourceValue };
        }
        return updated;
      });
    }

    setDragState({ start: null, end: null, isActive: false });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const updates = products.map((original, idx) => {
        const changes: Partial<Product> = {};
        let hasChanges = false;

        selectedColumns.forEach(col => {
          if (editData[idx][col.key] !== original[col.key]) {
            changes[col.key] = editData[idx][col.key];
            hasChanges = true;
          }
        });

        return { id: original.id, changes };
      }).filter(item => Object.keys(item.changes).length > 0);

      if (updates.length === 0) {
        setError('No changes to save');
        return;
      }

      await onSave(updates);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Bulk Edit Products ({products.length})</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Column Selector */}
        <div className="border-b p-4 bg-gray-50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">Columns:</span>
            {AVAILABLE_COLUMNS.map(col => (
              <label key={col.key} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={selectedColumns.some(c => c.key === col.key)}
                  onChange={() => handleColumnToggle(col)}
                  className="w-4 h-4"
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table ref={tableRef} className="w-full border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 bg-gray-100 border-b">
                <th className="w-12 p-2 text-center border-r text-xs font-medium text-gray-600">#</th>
                {selectedColumns.map(col => (
                  <th
                    key={col.key}
                    className="min-w-48 p-2 text-left border-r font-medium text-gray-700 bg-gray-50"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {editData.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-b hover:bg-gray-50">
                  <td className="w-12 p-2 text-center border-r text-xs text-gray-500 bg-gray-50">
                    {rowIdx + 1}
                  </td>
                  {selectedColumns.map((col, colIdx) => {
                    const cellKey = `${rowIdx}-${colIdx}`;
                    const isSelected = selectedCells.some(c => c.row === rowIdx && c.col === colIdx);
                    const isFillSource = dragState.start?.row === rowIdx && dragState.start?.col === colIdx;
                    const isFillTarget =
                      dragState.isActive &&
                      dragState.start &&
                      dragState.end &&
                      rowIdx >= Math.min(dragState.start.row, dragState.end.row) &&
                      rowIdx <= Math.max(dragState.start.row, dragState.end.row) &&
                      colIdx === dragState.start.col;

                    return (
                      <td
                        key={cellKey}
                        className={`p-0 border-r relative ${isSelected ? 'bg-blue-50' : ''} ${
                          isFillTarget ? 'bg-blue-100' : ''
                        }`}
                        onClick={e => handleCellClick(rowIdx, colIdx, e)}
                        onMouseMove={() => handleDragOverCell(rowIdx, colIdx)}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={() => {
                          if (dragState.isActive) {
                            handleDragOverCell(rowIdx, colIdx);
                          }
                        }}
                      >
                        <div className="relative">
                          <input
                            type={col.type === 'number' ? 'number' : col.type === 'checkbox' ? 'checkbox' : 'text'}
                            value={col.type === 'checkbox' ? undefined : String(row[col.key] ?? '')}
                            checked={col.type === 'checkbox' ? Boolean(row[col.key] ?? false) : undefined}
                            onChange={e => {
                              const value =
                                col.type === 'checkbox'
                                  ? e.target.checked
                                  : col.type === 'number'
                                  ? e.target.value === ''
                                    ? undefined
                                    : Number(e.target.value)
                                  : e.target.value;
                              handleCellChange(rowIdx, colIdx, value);
                            }}
                            onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
                            className={`w-full p-2 border-0 outline-none ${
                              isSelected ? 'ring-2 ring-blue-500' : ''
                            } ${isFillSource ? 'ring-2 ring-green-500' : ''}`}
                          />
                          {/* Fill Handle */}
                          {isSelected && (
                            <div
                              ref={dragHandleRef}
                              onMouseDown={() => startDragFill(rowIdx, colIdx)}
                              className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 cursor-ns-resize hover:bg-green-700 rounded-bl"
                              title="Drag to fill cells below"
                            />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-between items-center">
          <div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="text-xs text-gray-600 mt-1">
              Tip: Use arrow keys to navigate, Shift+Click for range, Alt/Cmd+Click for multiple
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || selectedColumns.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

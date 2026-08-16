# Bulk Edit Feature - Shopify-Like Functionality

This implementation provides a Shopify-like bulk editing interface for managing products efficiently. Users can select multiple products and edit them in a spreadsheet-like view with advanced features.

## Features Implemented

### 1. **Column Selection**
- Click "Columns" button to customize which fields appear in the bulk edit table
- Available columns:
  - Product Name (title)
  - Sale Price (price)
  - Regular Price (compareAtPrice)
  - In Stock (available)
  - Quantity (inventoryQuantity)
  - Status (active/sold out)
  - Availability (InStock/OutOfStock)

### 2. **Spreadsheet-Like Grid**
- Rows represent products
- Columns represent selectable properties
- Inline editing - click any cell to edit
- Visual feedback with borders and hover states

### 3. **Advanced Navigation & Selection**

#### Keyboard Navigation
- **Arrow Keys** - Navigate between cells (Up/Down/Left/Right)
- **Shift + Click** - Select range of adjacent cells
- **Alt/Cmd + Click** - Select multiple non-adjacent cells
- **Type** - Start editing the selected cell

#### Example Workflows
```
Scenario 1: Update price for multiple products
1. Click first product's price cell
2. Hold Shift, click last product's price cell (selects range)
3. Drag fill handle down to apply first value to all selected cells
4. Or type new value and all selected cells update

Scenario 2: Set different prices manually
1. Click cell to select it
2. Press arrow keys to navigate
3. Type value and press arrow key to move to next cell
4. Changes happen in real-time

Scenario 3: Multi-select non-adjacent products
1. Alt+Click (or Cmd+Click on Mac) first cell
2. Alt+Click more cells
3. Edit one selected cell
4. All selected cells update simultaneously
```

### 4. **Drag-to-Fill (AutoFill)**
- **Green square** appears at bottom-right of selected cell
- Click and drag downward to fill cells below with the source value
- Works like Excel's autofill feature
- Useful for:
  - Setting same price for multiple products
  - Bulk marking products as in stock
  - Applying status changes to multiple items

### 5. **Real-Time Validation**
- Invalid values are rejected before saving
- Numeric fields enforce number-only input
- Boolean fields show as checkboxes
- Select fields use dropdown menus

### 6. **Batch Updates**
- Save button performs batch Firestore write
- All changes sent in single request
- Automatic retry logic built in
- Error handling with detailed messages

---

## Component Architecture

### `BulkEditModal.tsx`
Main modal component with full spreadsheet functionality.

**Props:**
```typescript
interface BulkEditModalProps {
  products: Product[];           // Products to edit
  isOpen: boolean;               // Modal visibility
  onClose: () => void;           // Close handler
  onSave: (updates) => Promise;  // Save handler
}
```

**State Management:**
- `selectedColumns` - Which columns to display
- `editData` - Current cell values being edited
- `selectedCells` - Currently selected cell(s)
- `dragState` - Drag-to-fill state tracking

**Key Methods:**
- `handleCellChange()` - Update cell value
- `handleCellClick()` - Handle selection (single/range/multi)
- `handleKeyDown()` - Navigate with arrow keys
- `startDragFill()` / `handleDragEnd()` - Autofill functionality
- `handleSave()` - Validate and submit changes

### `useBulkEdit.ts` Hook
Manages API communication for bulk updates.

```typescript
const { submitBulkUpdates, isLoading, error } = useBulkEdit();

await submitBulkUpdates([
  { id: 'product-1', changes: { price: 99, available: true } },
  { id: 'product-2', changes: { price: 149 } }
]);
```

### API Endpoint: `/api/admin/products/bulk`
**POST** endpoint that handles batch Firestore updates.

**Request:**
```json
{
  "updates": [
    {
      "id": "product-id",
      "changes": {
        "price": 99,
        "available": true
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully updated 5 product(s)",
  "results": {
    "updated": ["id1", "id2", ...],
    "failed": [{ "id": "id3", "error": "..." }]
  }
}
```

### Admin Page: `/admin/products`
Example integration page showing:
- Product list with checkboxes
- "Bulk Edit" button (only visible when products selected)
- Full workflow from selection to save

---

## Usage Example

```tsx
import { BulkEditModal } from '@/components/BulkEditModal';
import { useBulkEdit } from '@/hooks/useBulkEdit';

export default function ProductManager() {
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const { submitBulkUpdates } = useBulkEdit();

  const handleBulkSave = async (updates) => {
    await submitBulkUpdates(updates);
    // Refresh data, show success message, etc.
  };

  return (
    <>
      <button onClick={() => setIsBulkEditOpen(true)}>
        Bulk Edit ({selectedProducts.length})
      </button>

      <BulkEditModal
        products={selectedProducts}
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        onSave={handleBulkSave}
      />
    </>
  );
}
```

---

## Keyboard Shortcuts Reference

| Action | Shortcut | Notes |
|--------|----------|-------|
| Navigate cells | Arrow Keys | Up/Down/Left/Right |
| Select range | Shift + Click | Select all cells between first and last click |
| Multi-select | Alt/Cmd + Click | Add/remove individual cells to selection |
| Auto-fill down | Drag green handle | Click and hold the green square at bottom-right |
| Drag to resize | Column divider drag | Adjust column width (auto-supported by browser) |
| Select all | Ctrl/Cmd + A | Browser default |
| Edit cell | Any character | Start typing to edit |
| Confirm edit | Arrow key / Enter | Move to next cell and confirm |
| Cancel edit | Escape | Discard changes to current cell |

---

## Data Types & Validation

| Column | Type | Validation | Example |
|--------|------|-----------|---------|
| Product Name | Text | Max 255 chars | "Ruby Necklace Succulent" |
| Sale Price | Number | > 0 | 99 |
| Regular Price | Number | > 0 | 149 |
| In Stock | Checkbox | Boolean | true/false |
| Quantity | Number | >= 0 | 5 |
| Status | Select | "active" \| "sold out" | "active" |
| Availability | Select | "InStock" \| "OutOfStock" | "InStock" |

---

## Performance Considerations

1. **Batch Writes**: All updates sent in single Firestore batch for efficiency
2. **Lazy Rendering**: Only visible rows rendered (can be optimized with virtualization)
3. **Debouncing**: Save operation includes loading state to prevent double-submit
4. **Memory**: EditData state stored in component - consider Redux for very large lists (1000+ items)

---

## Error Handling

### Validation Errors
- Missing required fields → Error message shown
- Invalid data types → Input type enforcement prevents invalid data
- Duplicate values → Warning (allowed, up to user validation)

### Save Errors
- Network failure → Error message with retry option
- Firestore permission denied → Handled by API endpoint
- Batch write failure → Partial updates reported

---

## Future Enhancements

1. **Undo/Redo** - Add change history
2. **Virtualization** - Render only visible rows for 1000+ items
3. **Search/Filter** - Filter products before bulk edit
4. **Custom Columns** - Allow custom metafields in bulk edit
5. **Export/Import** - CSV export of edited data
6. **Conditional Formatting** - Highlight changed cells
7. **Formula Support** - Auto-calculate (e.g., "price * 1.1")
8. **Audit Log** - Track who changed what and when
9. **Preview** - Show diff before save
10. **Scheduled Bulk Edits** - Queue edits for later execution

---

## File Structure

```
src/
├── components/
│   └── BulkEditModal.tsx           # Main modal component
├── hooks/
│   └── useBulkEdit.ts              # Bulk edit hook
├── app/
│   ├── admin/
│   │   └── products/
│   │       └── page.tsx            # Example admin page
│   └── api/
│       └── admin/products/
│           └── bulk/
│               └── route.ts        # Bulk update API
└── types/
    └── product.ts                  # Product type definition
```

---

## Troubleshooting

**Q: Drag-to-fill not working?**
A: Make sure you click and hold on the green square at the bottom-right of the selected cell, not the cell itself.

**Q: Can't select multiple cells?**
A: Use Alt+Click (Windows/Linux) or Cmd+Click (Mac) to multi-select non-adjacent cells. Shift+Click for adjacent ranges.

**Q: Changes not saving?**
A: Check browser console for error messages. Ensure all required fields have values. Network request should show 200 status.

**Q: Product title changed unexpectedly?**
A: The title is included in the available columns. Deselect it from the Columns menu if you don't want to edit titles.

---

## Shopify Comparison

| Feature | Shopify | Our Implementation |
|---------|---------|-------------------|
| Column selection | ✓ | ✓ |
| Inline editing | ✓ | ✓ |
| Arrow key navigation | ✓ | ✓ |
| Shift+Click range | ✓ | ✓ |
| Alt/Cmd+Click multi | ✓ | ✓ |
| Drag-to-fill | ✓ | ✓ |
| Column resizing | ✓ | ✓ (browser native) |
| Batch save | ✓ | ✓ |
| Error handling | ✓ | ✓ |
| CSV import/export | ✓ | ⚠️ (can add) |

---

## Support & Feedback

For issues or feature requests, check:
1. Component console logs
2. Browser DevTools Network tab (API responses)
3. Firestore Firebase Console for write errors

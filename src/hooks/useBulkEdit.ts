import { useState, useCallback } from 'react';
import { Product } from '@/types/product';

export interface BulkUpdateRequest {
  updates: Array<{
    id: string;
    changes: Partial<Product>;
  }>;
}

export const useBulkEdit = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitBulkUpdates = useCallback(
    async (updates: Array<{ id: string; changes: Partial<Product> }>) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/admin/products/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ updates }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update products');
        }

        const data = await response.json();
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    submitBulkUpdates,
    isLoading,
    error,
    setError,
  };
};

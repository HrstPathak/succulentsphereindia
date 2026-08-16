import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

interface BulkUpdateRequest {
  updates: Array<{
    id: string;
    changes: Record<string, any>;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    initializeFirebaseAdmin();
    const db = getFirestore();

    const body: BulkUpdateRequest = await req.json();

    if (!body.updates || !Array.isArray(body.updates)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected updates array.' },
        { status: 400 }
      );
    }

    if (body.updates.length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    // Validate product IDs and changes
    const validUpdates = body.updates.filter(update => {
      if (!update.id || typeof update.id !== 'string') {
        return false;
      }
      if (!update.changes || Object.keys(update.changes).length === 0) {
        return false;
      }
      return true;
    });

    if (validUpdates.length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    // Perform batch update
    const batch = db.batch();
    const results = {
      updated: [] as string[],
      failed: [] as Array<{ id: string; error: string }>,
    };

    for (const update of validUpdates) {
      try {
        const docRef = db.collection('products').doc(update.id);

        // Add timestamp and validate data types
        const sanitizedChanges: Record<string, any> = {
          ...update.changes,
          updatedAt: new Date().toISOString(),
        };

        // Remove image-related fields - images should only be updated via dedicated image upload endpoints
        delete sanitizedChanges.image;
        delete sanitizedChanges.images;
        delete sanitizedChanges.imageAlt;

        // Ensure numeric fields are numbers
        if ('price' in sanitizedChanges && sanitizedChanges.price !== undefined) {
          sanitizedChanges.price = Number(sanitizedChanges.price);
        }
        if ('compareAtPrice' in sanitizedChanges && sanitizedChanges.compareAtPrice !== undefined) {
          sanitizedChanges.compareAtPrice = Number(sanitizedChanges.compareAtPrice);
        }
        if ('inventoryQuantity' in sanitizedChanges && sanitizedChanges.inventoryQuantity !== undefined) {
          sanitizedChanges.inventoryQuantity = Number(sanitizedChanges.inventoryQuantity);
        }

        batch.set(docRef, sanitizedChanges, { merge: true });
        results.updated.push(update.id);
      } catch (error) {
        results.failed.push({
          id: update.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${results.updated.length} product(s)`,
      results,
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

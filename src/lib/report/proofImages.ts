import { db, doc, collection, getDocs, writeBatch } from "@/lib/firebase";
import { UploadedImage } from "@/types/preReport";

/**
 * Proof image persistence.
 *
 * Images were previously embedded in the report document's
 * preReportConfig, which silently capped uploads around six images:
 * Firestore documents are limited to 1MB, and each compressed proof
 * image is ~100–150KB. Storing each image as its own document in a
 * subcollection removes that ceiling while staying on the free tier.
 */

export const MAX_PROOF_IMAGES = 20;

export async function saveProofImages(reportId: string, images: UploadedImage[]): Promise<void> {
  const colRef = collection(db, "reports", reportId, "proofImages");
  const existing = await getDocs(colRef);

  const batch = writeBatch(db);
  const keep = new Set(images.map(i => i.id));
  existing.forEach(d => {
    if (!keep.has(d.id)) batch.delete(d.ref);
  });
  images.forEach((img, i) => {
    batch.set(doc(db, "reports", reportId, "proofImages", img.id), { ...img, order: i });
  });
  await batch.commit();
}

export async function loadProofImages(reportId: string): Promise<UploadedImage[]> {
  const snap = await getDocs(collection(db, "reports", reportId, "proofImages"));
  const list: Array<UploadedImage & { order?: number }> = [];
  snap.forEach(d => list.push(d.data() as UploadedImage & { order?: number }));
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return list.map(({ order: _order, ...img }) => img as UploadedImage);
}

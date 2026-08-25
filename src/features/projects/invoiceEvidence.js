const INVOICE_CATEGORY = 'Lieferantenrechnungen';

const hasDurableFileIdentity = item => Boolean(
  item?.id && (
    item?.name || item?.preview || item?.url || item?.storagePath ||
    item?.supabasePath || item?.oneDriveItemId || item?.oneDrivePath
  )
);

/**
 * A generic "Sonstiges" attachment is never invoice evidence.
 * Only an actual file explicitly assigned to the invoice category counts.
 */
export const hasSupplierInvoice = project => (
  Array.isArray(project?.images) && project.images.some(item =>
    item?.assignedTo === INVOICE_CATEGORY &&
    item?.deleted !== true &&
    hasDurableFileIdentity(item)
  )
);

export { INVOICE_CATEGORY };

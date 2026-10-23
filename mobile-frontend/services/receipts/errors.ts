export class ReceiptSaveUnavailableError extends Error {
  constructor(reason: 'app_update_required' | 'permission_denied' | 'permission_blocked') {
    const messages = {
      app_update_required: 'Update JamJade to save receipts to your gallery, then try again.',
      permission_denied: 'Allow photo saving to save your receipt to the gallery.',
      permission_blocked: 'Allow photo saving in your phone settings, then try again.',
    };
    super(messages[reason]);
    this.name = 'ReceiptSaveUnavailableError';
  }
}

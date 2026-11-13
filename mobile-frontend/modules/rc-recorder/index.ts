import { requireOptionalNativeModule } from 'expo';

export type RcRecorderNative = {
  rentalMonitoringDiscardStart?(): Promise<null>;
  rentalMonitoringPrepare?(owner: string, booking: string): Promise<string>;
  rentalMonitoringStart?(config: string): Promise<null>;
  rentalMonitoringStop?(): Promise<null>;
  rentalMonitoringLock?(): Promise<null>;
  rentalMonitoringRecover?(config: string): Promise<null>;
  rentalMonitoringDiscardCompleted?(owner: string, booking: string, session: string): Promise<null>;
  rentalMonitoringStatus?(owner: string): Promise<string>;
  startDriveMonitoring?(config: string, runtime: string): Promise<null>;
  configureDriveUpload?(config: string): Promise<null>;
  enqueueDriveBatch?(config: string): Promise<null>;
  driveUploadStatus?(): Promise<string>;
  driveStartIdentity?(config: string): Promise<string>;
  clearDriveStartIdentity?(): Promise<null>;
  beginRentalMotion?(seconds: number): Promise<string>;
  readRentalMotion?(id: string): Promise<string>;
  cancelRentalMotion?(id: string): Promise<null>;
  collectionAction(config: string): Promise<string>;
  beginCheck(): Promise<null>;
  cancelCheck(): Promise<null>;
  collection(id: string): Promise<string>;
  saveObservation(id: string, config: string): Promise<string>;
  collectionReceipt(id: string, config: string): Promise<null>;
  authorize(ownerId: string, validForSeconds: number): Promise<null>;
  lock(): Promise<null>;
  start(config: string): Promise<null>;
  stop(): Promise<null>;
  status(): Promise<string>;
  collectionPage(offset: number, filter: string): Promise<string>;
  listCollection(offset: number, filter: string): Promise<string>;
  list(offset: number): Promise<string>;
  groups(): Promise<string>;
  createGroup(config: string): Promise<string>;
  details(id: string): Promise<string>;
  exportManifest(id: string): Promise<string>;
  exportChunk(id: string, channel: string, index: number): Promise<string>;
  setTransfer(id: string, value: string): Promise<null>;
  delete(id: string): Promise<null>;
};

// Old development clients and Expo Go can open the app but cannot claim native recording support.
export default requireOptionalNativeModule<RcRecorderNative>('JamJadeRcRecorder');

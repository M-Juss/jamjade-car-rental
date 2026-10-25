import { requireOptionalNativeModule } from 'expo';

export type RcRecorderNative = {
  authorize(ownerId: string, validForSeconds: number): Promise<null>;
  lock(): Promise<null>;
  start(config: string): Promise<null>;
  stop(): Promise<null>;
  status(): Promise<string>;
  list(offset: number): Promise<string>;
  groups(): Promise<string>;
  createGroup(config: string): Promise<string>;
  details(id: string): Promise<string>;
  delete(id: string): Promise<null>;
};

// Old development clients and Expo Go can open the app but cannot claim native recording support.
export default requireOptionalNativeModule<RcRecorderNative>('JamJadeRcRecorder');

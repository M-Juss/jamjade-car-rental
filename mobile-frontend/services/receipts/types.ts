import type { RefObject } from 'react';
import type { View } from 'react-native';

export type ReceiptImageTarget = {
  view: RefObject<View | null>;
  width: number;
  height: number;
};

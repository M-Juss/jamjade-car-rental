import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import type { OpaqueColorValue, StyleProp, TextStyle } from 'react-native';

export function IconSymbol({ name, size = 24, color, style }: {
  name: ComponentProps<typeof MaterialIcons>['name'];
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return <MaterialIcons name={name} size={size} color={color} style={style} />;
}

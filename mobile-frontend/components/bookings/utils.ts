export const bookingColors = {
  brand: '#346EF6',
  emerald: '#047857',
  emeraldDark: '#065F46',
  ink: '#17315F',
  muted: '#6C7A96',
  paleBlue: '#EEF4FF',
  screen: '#F8FAFF',
};

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

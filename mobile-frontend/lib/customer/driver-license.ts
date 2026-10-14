export function formatDriverLicenseNumber(value: string) {
  const characters = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);

  return [characters.slice(0, 3), characters.slice(3, 5), characters.slice(5)]
    .filter(Boolean)
    .join('-');
}

export function isValidDriverLicenseNumber(value: string) {
  const number = value.trim();
  const characters = number.replace(/-/g, '');

  return /^[A-Z0-9-]+$/i.test(number) && characters.length >= 1 && characters.length <= 11;
}

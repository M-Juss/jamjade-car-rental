import { z } from 'zod';

const pricePattern = /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/;

const priceField = z
  .string()
  .trim()
  .refine((value) => value === '' || pricePattern.test(value), 'Use digits and one decimal point, with up to 2 decimal places.')
  .transform((value) => (value === '' ? undefined : Number(value)))
  .pipe(z.number().finite().nonnegative('Enter a valid price of zero or more.').optional());

export const browsePriceRangeSchema = z
  .object({
    minPrice: priceField,
    maxPrice: priceField,
  })
  .refine(
    ({ minPrice, maxPrice }) => minPrice === undefined || maxPrice === undefined || maxPrice >= minPrice,
    {
      message: 'Maximum price must be at least the minimum price.',
      path: ['maxPrice'],
    },
  );

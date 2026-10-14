import { z } from 'zod';

const priceField = z
  .string()
  .trim()
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

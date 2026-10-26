import { z } from 'zod';

export const nativeManifestUploadSchema = z.object({ manifest_json: z.string().min(1).max(1048576) }).strict();
export const nativeChunkUploadSchema = z.object({
  channel: z.enum(['accelerometer', 'gyroscope', 'gravity', 'linear_acceleration', 'rotation_vector']),
  chunk_index: z.number().int().min(0).max(9999), payload: z.string().min(1).max(1048576),
}).strict();
export const nativeUploadIdSchema = z.uuid();

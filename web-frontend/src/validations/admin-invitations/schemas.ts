import { z } from "zod";

export const adminInvitationEmailSchema = z.string().trim().email().max(160);

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { uploadBase64File } from "../../lib/s3";

export const uploadRouter = router({
  image: protectedProcedure
    .input(
      z.object({
        base64: z.string().min(1),
        mimeType: z.string().min(1),
        filename: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return uploadBase64File(input.base64, input.mimeType, ctx.user.id, input.filename);
    }),
});

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const systemRouter = router({
  notifyOwner: protectedProcedure
    .input(z.object({ message: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      console.log(`[notifyOwner] from user ${ctx.user.id}: ${input.message}`);
      return { success: true };
    }),
});

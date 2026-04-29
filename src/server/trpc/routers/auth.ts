import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../init";

export const authRouter = createTRPCRouter({
  getSession: publicProcedure.query(({ ctx }) => {
    return {
      user: ctx.user,
      session: ctx.session,
    };
  }),

  me: protectedProcedure.query(({ ctx }) => {
    return ctx.user;
  }),
});

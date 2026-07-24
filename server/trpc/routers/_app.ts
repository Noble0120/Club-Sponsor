import { router } from "../trpc";
import { authRouter } from "./auth";
import { clubsRouter } from "./clubs";
import { userManagementRouter } from "./userManagement";
import { matchesRouter } from "./matches";
import { sponsorsRouter } from "./sponsors";
import { contractsRouter } from "./contracts";
import { benefitsRouter } from "./benefits";
import { recordsRouter } from "./records";
import { uploadRouter } from "./upload";
import { dashboardRouter } from "./dashboard";
import { reportsRouter } from "./reports";
import { workflowRouter } from "./workflow";
import { systemRouter } from "./system";

export const appRouter = router({
  auth: authRouter,
  clubs: clubsRouter,
  userManagement: userManagementRouter,
  matches: matchesRouter,
  sponsors: sponsorsRouter,
  contracts: contractsRouter,
  benefits: benefitsRouter,
  records: recordsRouter,
  upload: uploadRouter,
  dashboard: dashboardRouter,
  reports: reportsRouter,
  workflow: workflowRouter,
  system: systemRouter,
});

export type AppRouter = typeof appRouter;

import { router } from "../trpc";
import { authRouter } from "./auth";
import { clubsRouter } from "./clubs";
import { userManagementRouter } from "./userManagement";
import { matchesRouter } from "./matches";
import { companiesRouter } from "./companies";
import { companyActivitiesRouter } from "./companyActivities";
import { contractsRouter } from "./contracts";
import { assetsRouter } from "./assets";
import { deliveriesRouter } from "./deliveries";
import { tasksRouter } from "./tasks";
import { uploadRouter } from "./upload";
import { dashboardRouter } from "./dashboard";
import { reportsRouter } from "./reports";
import { systemRouter } from "./system";

export const appRouter = router({
  auth: authRouter,
  clubs: clubsRouter,
  userManagement: userManagementRouter,
  matches: matchesRouter,
  companies: companiesRouter,
  companyActivities: companyActivitiesRouter,
  contracts: contractsRouter,
  assets: assetsRouter,
  deliveries: deliveriesRouter,
  tasks: tasksRouter,
  upload: uploadRouter,
  dashboard: dashboardRouter,
  reports: reportsRouter,
  system: systemRouter,
});

export type AppRouter = typeof appRouter;

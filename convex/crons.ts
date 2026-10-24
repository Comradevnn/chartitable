import { cronJobs } from "convex/server";
import { internal } from "./lib/builders";

const crons = cronJobs();
crons.interval("milestone check", { minutes: 5 }, internal.milestones.check, {});
export default crons;

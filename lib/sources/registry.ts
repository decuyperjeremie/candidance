/**
 * Connector registry: name -> factory. Adding a site = add its file and one
 * line here; aggregation/discovery code never changes (see design.md).
 */

import { getConfig, type JobSourceName } from "@/lib/config";
import { FranceTravailSource } from "./france-travail";
import { ApecSource } from "./apec";
import { WelcomeToTheJungleSource } from "./welcome-to-the-jungle";
import {
  GlassdoorSource,
  IndeedSource,
  LinkedinSource,
} from "./best-effort";
import type { JobSource } from "./types";

const FACTORIES: Record<JobSourceName, () => JobSource> = {
  "france-travail": () => new FranceTravailSource(),
  apec: () => new ApecSource(),
  "welcome-to-the-jungle": () => new WelcomeToTheJungleSource(),
  linkedin: () => new LinkedinSource(),
  indeed: () => new IndeedSource(),
  glassdoor: () => new GlassdoorSource(),
};

/** Instantiate a single connector by name. */
export function getJobSource(name: JobSourceName): JobSource {
  return FACTORIES[name]();
}

/** The connectors enabled via JOB_SOURCES (default: france-travail only). */
export function getEnabledJobSources(): JobSource[] {
  return getConfig().jobSources.map(getJobSource);
}

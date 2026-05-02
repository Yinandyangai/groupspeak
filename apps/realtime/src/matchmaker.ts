import { prisma } from "@groupspeak/db";
import {
  SHADOW_QUEUE_THRESHOLD,
  type EnqueuePayload,
  type Intent,
  type Mode,
  type Topic,
} from "@groupspeak/shared";
import { redis, k } from "./redis.js";
import { logger } from "./logger.js";

const MATCHMAKER_CONFIG = {
  MAX_GROUP_SIZE: 5,
  MIN_GROUP_SIZE: 2,
};

// minimal export to prevent runtime crash
export interface QueueEntry {
  userId: string;
  displayName: string;
  vibeScore: number;
  intent: Intent;
  mode: Mode;
  topics: Topic[];
  groupSize: number;
}

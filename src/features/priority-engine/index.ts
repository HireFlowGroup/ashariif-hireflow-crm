export type {
  LeadPriority,
  PriorityBreakdownPayload,
  PriorityComponentDetail,
  PriorityComponents,
  PriorityFactor,
  PriorityInput,
  PriorityInputContact,
  PriorityProfile,
} from "@/features/priority-engine/domain/priority.types";
export {
  priorityColorClass,
  priorityFromScore,
} from "@/features/priority-engine/domain/priority.types";
export {
  getPriorityEngineConfig,
  INVERTED_PRIORITY_COMPONENTS,
  PRIORITY_COMPONENT_LABELS,
  PRIORITY_COMPONENT_LABELS_NL,
  PRIORITY_COMPONENT_ORDER,
  type PriorityComponentKey,
  type PriorityEngineConfig,
  type PriorityWeights,
} from "@/features/priority-engine/config/priority-engine.config";
export {
  computePriority,
  priorityInputFromCandidate,
  priorityProfileToBreakdown,
} from "@/features/priority-engine/services/priority-engine.service";

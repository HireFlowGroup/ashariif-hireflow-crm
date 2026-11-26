const DEPARTMENT_OR_CATEGORY_PATTERN =
  /^(sales\s*&\s*marketing|marketing\s*&\s*communications?|research\s*&\s*development|r&d|engineering|operations|finance|human resources|hr|it|legal|customer service|support|administration|product|design|data)(\s*&\s*\w+)?$/i;

const TEAM_OR_AREA_PATTERN =
  /^(het|the)\s+(sales|marketing|engineering|development|hr|finance)\s+(team|afdeling|department)$/i;

/** Department / nav bucket labels — not job titles. */
export function isDepartmentOrCategoryVacancyLabel(title: string): boolean {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (normalized.length < 3) return true;
  if (DEPARTMENT_OR_CATEGORY_PATTERN.test(normalized)) return true;
  if (TEAM_OR_AREA_PATTERN.test(normalized)) return true;
  if (/^(alle vacatures|all jobs|open roles|our teams?)$/i.test(normalized)) return true;
  return false;
}
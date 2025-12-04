/**
 * Resource filtering utilities to match F5 Console display format
 *
 * The F5 XC API returns verbose responses with system metadata, form configurations,
 * and null values. The F5 Console displays a cleaner view by filtering these out.
 */

/**
 * Fields that are system/internal and not shown in F5 Console
 */
const SYSTEM_FIELDS = [
  'create_form',
  'replace_form',
  'deleted_referred_objects',
  'disabled_referred_objects',
  'referring_objects',
  'resource_version',
  'system_metadata',
] as const;

/**
 * Fields that contain runtime status - optionally filtered
 */
const STATUS_FIELDS = ['status'] as const;

/**
 * Metadata fields to remove if empty
 */
const EMPTY_METADATA_FIELDS = ['description'] as const;

/**
 * Filter options for resource display
 */
export interface ResourceFilterOptions {
  /** Remove system/internal fields (create_form, replace_form, etc.) */
  removeSystemFields: boolean;
  /** Remove status array (runtime information) */
  removeStatus: boolean;
  /** Remove null values from the response */
  removeNullValues: boolean;
  /** Remove empty strings from the response */
  removeEmptyStrings: boolean;
  /** Remove empty arrays from the response */
  removeEmptyArrays: boolean;
  /** Remove empty objects from the response */
  removeEmptyObjects: boolean;
}

/**
 * Default filter options that match F5 Console display
 */
export const CONSOLE_VIEW_OPTIONS: ResourceFilterOptions = {
  removeSystemFields: true,
  removeStatus: true,
  removeNullValues: true,
  removeEmptyStrings: true,
  removeEmptyArrays: false, // Console keeps empty arrays
  removeEmptyObjects: false, // Console keeps empty objects (they represent config flags)
};

/**
 * Full API response options (no filtering)
 */
export const FULL_API_OPTIONS: ResourceFilterOptions = {
  removeSystemFields: false,
  removeStatus: false,
  removeNullValues: false,
  removeEmptyStrings: false,
  removeEmptyArrays: false,
  removeEmptyObjects: false,
};

/**
 * Check if a value is an empty object
 */
function isEmptyObject(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

/**
 * Check if a value should be removed based on options
 */
function shouldRemoveValue(value: unknown, options: ResourceFilterOptions): boolean {
  if (value === null && options.removeNullValues) {
    return true;
  }
  if (value === '' && options.removeEmptyStrings) {
    return true;
  }
  if (Array.isArray(value) && value.length === 0 && options.removeEmptyArrays) {
    return true;
  }
  if (isEmptyObject(value) && options.removeEmptyObjects) {
    return true;
  }
  return false;
}

/**
 * Recursively filter an object based on options
 */
function filterObject(
  obj: Record<string, unknown>,
  options: ResourceFilterOptions,
  isTopLevel = false,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip system fields at top level
    if (isTopLevel && options.removeSystemFields) {
      if ((SYSTEM_FIELDS as readonly string[]).includes(key)) {
        continue;
      }
    }

    // Skip status at top level if requested
    if (isTopLevel && options.removeStatus) {
      if ((STATUS_FIELDS as readonly string[]).includes(key)) {
        continue;
      }
    }

    // Handle metadata specially
    if (key === 'metadata' && typeof value === 'object' && value !== null) {
      const filteredMetadata = filterMetadata(value as Record<string, unknown>, options);
      result[key] = filteredMetadata;
      continue;
    }

    // Skip values that should be removed
    if (shouldRemoveValue(value, options)) {
      continue;
    }

    // Recursively filter nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const filtered = filterObject(value as Record<string, unknown>, options, false);
      // Don't skip empty objects after filtering unless removeEmptyObjects is true
      if (!isEmptyObject(filtered) || !options.removeEmptyObjects) {
        result[key] = filtered;
      }
    } else if (Array.isArray(value)) {
      // Filter array elements
      const filteredArray = (value as unknown[])
        .map((item): unknown => {
          if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
            return filterObject(item as Record<string, unknown>, options, false);
          }
          return item;
        })
        .filter((item) => !shouldRemoveValue(item, options));

      if (filteredArray.length > 0 || !options.removeEmptyArrays) {
        result[key] = filteredArray;
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Filter metadata object, removing empty fields like description
 */
function filterMetadata(
  metadata: Record<string, unknown>,
  options: ResourceFilterOptions,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Remove empty metadata fields
    if ((EMPTY_METADATA_FIELDS as readonly string[]).includes(key)) {
      if (value === '' || value === null) {
        continue;
      }
    }

    // Skip values that should be removed
    if (shouldRemoveValue(value, options)) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

/**
 * Filter a resource object to match F5 Console display format
 *
 * @param resource - The raw API response
 * @param options - Filter options (defaults to CONSOLE_VIEW_OPTIONS)
 * @returns Filtered resource object
 */
export function filterResource(
  resource: Record<string, unknown>,
  options: ResourceFilterOptions = CONSOLE_VIEW_OPTIONS,
): Record<string, unknown> {
  return filterObject(resource, options, true);
}

/**
 * View mode for resource display
 */
export type ViewMode = 'console' | 'full';

/**
 * Get filter options for a view mode
 */
export function getFilterOptionsForViewMode(mode: ViewMode): ResourceFilterOptions {
  switch (mode) {
    case 'console':
      return CONSOLE_VIEW_OPTIONS;
    case 'full':
      return FULL_API_OPTIONS;
    default:
      return CONSOLE_VIEW_OPTIONS;
  }
}

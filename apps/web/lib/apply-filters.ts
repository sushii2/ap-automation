import {
  isFilterComplete,
  type FilterField,
  type FilterValue,
} from "@workspace/ui/components/ui/cubby-ui/filters/filters"

/** Reads the value a filter field compares against from a row. */
export type FilterAccessors<T> = Record<string, (row: T) => unknown>

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === ""

function matches(actual: unknown, { operator, value }: FilterValue): boolean {
  const text = String(actual ?? "").toLowerCase()
  const needle = String(value ?? "").toLowerCase()
  const list = Array.isArray(value) ? value.map(String) : []
  const actualList = Array.isArray(actual) ? actual.map(String) : [String(actual)]

  switch (operator) {
    case "is":
      return text === needle
    case "is_not":
      return text !== needle
    case "is_empty":
      return isEmpty(actual)
    case "is_not_empty":
      return !isEmpty(actual)
    case "is_any_of":
      return actualList.some((item) => list.includes(item))
    case "is_not_any_of":
      return !actualList.some((item) => list.includes(item))
    case "includes_all":
      return list.every((item) => actualList.includes(item))
    case "contains":
      return text.includes(needle)
    case "not_contains":
      return !text.includes(needle)
    case "starts_with":
      return text.startsWith(needle)
    case "ends_with":
      return text.endsWith(needle)
    case "eq":
      return !isEmpty(actual) && Number(actual) === Number(value)
    case "neq":
      return Number(actual) !== Number(value)
    case "gt":
      return !isEmpty(actual) && Number(actual) > Number(value)
    case "lt":
      return !isEmpty(actual) && Number(actual) < Number(value)
    case "between": {
      const { min, max } = (value ?? {}) as {
        min?: number | null
        max?: number | null
      }
      if (isEmpty(actual)) return false
      const number = Number(actual)
      return (
        (isEmpty(min) || number >= Number(min)) &&
        (isEmpty(max) || number <= Number(max))
      )
    }
    default:
      return true
  }
}

/** Keeps the rows that satisfy every complete filter (filters are AND-ed). */
export function applyFilters<T>(
  rows: T[],
  filters: FilterValue[],
  fields: FilterField[],
  accessors: FilterAccessors<T>
): T[] {
  const active = filters.filter((filter) => {
    const field = fields.find((candidate) => candidate.id === filter.field)
    return field !== undefined && isFilterComplete(field, filter)
  })
  if (active.length === 0) return rows

  return rows.filter((row) =>
    active.every((filter) => {
      const read = accessors[filter.field]
      return read ? matches(read(row), filter) : true
    })
  )
}

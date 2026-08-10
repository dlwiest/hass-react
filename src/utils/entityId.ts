const warnedWrongDomainEntityIds = new Set<string>()

interface DomainValidationOptions {
  warnOnWrongDomain?: boolean
  hookName?: string
}

// Validates and normalizes an entity ID for a specific domain
export function validateAndNormalizeDomain(
  entityId: string,
  expectedDomain: string,
  options: DomainValidationOptions = {}
): string {
  const { warnOnWrongDomain = false, hookName } = options

  // If entityId already contains domain, validate it
  if (entityId.includes('.')) {
    if (
      warnOnWrongDomain &&
      !entityId.startsWith(`${expectedDomain}.`) &&
      !warnedWrongDomainEntityIds.has(entityId)
    ) {
      warnedWrongDomainEntityIds.add(entityId)
      const [actualDomain] = entityId.split('.')
      const hookPrefix = hookName ? `${hookName}: ` : ''
      console.warn(
        `${hookPrefix}Entity "${entityId}" has domain "${actualDomain}" but expects "${expectedDomain}" domain. ` +
        `This may not work as expected. Use useEntity() or the appropriate domain-specific hook instead.`
      )
    }
    return entityId
  }

  // If no domain specified, prepend the expected domain
  return `${expectedDomain}.${entityId}`
}

// Creates a domain validator function for consistent validation across hooks
export function createDomainValidator(expectedDomain: string, hookName: string) {
  return (entityId: string): string => {
    return validateAndNormalizeDomain(entityId, expectedDomain, {
      warnOnWrongDomain: true,
      hookName
    })
  }
}

// Extracts the domain from a full entity ID
export function extractDomain(entityId: string): string | null {
  if (!entityId.includes('.')) {
    return null
  }
  
  return entityId.split('.')[0]
}

// Extracts the entity name from a full entity ID
export function extractEntityName(entityId: string): string {
  if (!entityId.includes('.')) {
    return entityId
  }
  
  return entityId.split('.').slice(1).join('.')
}
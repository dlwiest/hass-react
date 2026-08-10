import { useCallback } from 'react'
import { z } from 'zod'
import { useEntity } from './useEntity'
import type { BaseEntityHook } from '../types'
import { CoverFeatures } from '../types'
import type { CoverAttributes } from '../types/entities/cover'
import { createDomainValidator } from '../utils/entityId'
import { checkFeatures } from '../utils/features'
import { FeatureNotSupportedError } from '../utils/errors'

const validateCoverEntityId = createDomainValidator('cover', 'useCover')

const positionSchema = z.number().int().min(0).max(100)

export interface CoverState extends BaseEntityHook<CoverAttributes> {
  isOpen: boolean
  isClosed: boolean
  isOpening: boolean
  isClosing: boolean
  position?: number
  supportsSetPosition: boolean
  supportsStop: boolean
  open: () => Promise<void>
  close: () => Promise<void>
  stop: () => Promise<void>
  setPosition: (position: number) => Promise<void>
}

export function useCover(entityId: string): CoverState {
  const normalizedEntityId = validateCoverEntityId(entityId)
  const entity = useEntity<CoverAttributes>(normalizedEntityId)
  const { state, attributes, callService } = entity

  const isOpen = state === 'open'
  const isClosed = state === 'closed'
  const isOpening = state === 'opening'
  const isClosing = state === 'closing'

  const features = checkFeatures(attributes.supported_features, {
    setPosition: CoverFeatures.SET_POSITION,
    stop: CoverFeatures.STOP,
  })
  const {
    setPosition: supportsSetPosition,
    stop: supportsStop,
  } = features

  const open = useCallback(async () => {
    await callService('cover', 'open_cover')
  }, [callService])

  const close = useCallback(async () => {
    await callService('cover', 'close_cover')
  }, [callService])

  const stop = useCallback(async () => {
    if (!supportsStop) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'stop')
    }
    await callService('cover', 'stop_cover')
  }, [callService, normalizedEntityId, supportsStop])

  const setPosition = useCallback(
    async (position: number) => {
      if (!supportsSetPosition) {
        throw new FeatureNotSupportedError(normalizedEntityId, 'position control')
      }
      positionSchema.parse(position)
      await callService('cover', 'set_cover_position', { position })
    },
    [callService, normalizedEntityId, supportsSetPosition]
  )

  return {
    ...entity,
    isOpen,
    isClosed,
    isOpening,
    isClosing,
    position: typeof attributes.current_position === 'number' ? attributes.current_position : undefined,
    supportsSetPosition,
    supportsStop,
    open,
    close,
    stop,
    setPosition,
  }
}

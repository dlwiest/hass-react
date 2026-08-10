import type * as React from 'react'
import type { ReactNode } from 'react'
import { useCamera } from '../hooks/useCamera'
import type { CameraState } from '../types'
import { StreamPlayer, StreamPlayerProps } from './Camera/StreamPlayer'
import { Image, ImageProps } from './Camera/Image'

export interface CameraProps {
  entityId: string
  children: (camera: CameraState) => ReactNode
}

interface CameraComponent {
  (props: CameraProps): React.JSX.Element
  StreamPlayer: typeof StreamPlayer
  Image: typeof Image
}

export const Camera = ((({ entityId, children }: CameraProps) => {
  const camera = useCamera(entityId)
  return <>{children(camera)}</>
}) as CameraComponent)

// Attach compound components
Camera.StreamPlayer = StreamPlayer
Camera.Image = Image

// Export types for compound components
export type { StreamPlayerProps, ImageProps }
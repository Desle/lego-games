import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import { Matrix4 } from 'three'
import type { Object3D } from 'three'
import {
  getCarDrawing,
  getDriverDrawing,
} from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type {
  CarDrawingRequest,
  DriverDrawingRequest,
  RacerPartPose,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import type {
  CarLink,
  CarParts,
  DriverLink,
  FollowedDrawing,
  OriginalVisibility,
  StateHolder,
} from './racer-drawing.types.ts'

const SOLID_OPACITY = 1

const createStateHolder = (): StateHolder => {
  let state: SkeletonAnimationState | null = null
  return {
    get: () => state,
    set: (next) => {
      state = next
    },
  }
}

// The part with its original meshes hidden; the animation state the viewer gives it is kept in the holder as well as given on.
const takeOver = (
  part: ModelObject,
  holder: StateHolder,
  afterDispose: (() => void) | null
): ModelObject => {
  const { group, object } = part
  object.group.visible = false
  return {
    group,
    object: {
      ...object,
      setAnimationState: (state) => {
        holder.set(state)
        object.setAnimationState(state)
      },
      dispose: () => {
        object.dispose()
        afterDispose?.()
      },
    },
  }
}

const getPartPose = (part: ModelObject, holder: StateHolder): RacerPartPose => ({
  matrix: part.group.matrix,
  isVisible: part.group.visible,
  animationState: holder.get(),
})

// A car's drawing, when a viewer extension has one for the request, for parts that the viewer positions every frame (the race): the
// drawing is added to `host` and follows the parts' groups. Null keeps the original's parts as they are.
export const attachCarDrawing = (
  parts: CarParts,
  request: CarDrawingRequest,
  host: Object3D
): CarLink | null => {
  const drawing = getCarDrawing(request)
  if (drawing === null) return null
  host.add(drawing.object)
  const wheelsHolder = createStateHolder()
  const bodyHolder = createStateHolder()
  drawing.onFailed(() => {
    host.remove(drawing.object)
    Object.assign(parts.wheels.object.group, { visible: true })
    if (parts.body !== null) Object.assign(parts.body.object.group, { visible: true })
  })
  const wheels = takeOver(parts.wheels, wheelsHolder, () => {
    host.remove(drawing.object)
    drawing.dispose()
  })
  const body = parts.body === null ? null : takeOver(parts.body, bodyHolder, null)
  return {
    wheels,
    body,
    sync: (opacity = SOLID_OPACITY) =>
      drawing.applyPose({
        wheels: getPartPose(wheels, wheelsHolder),
        body: body === null ? null : getPartPose(body, bodyHolder),
        opacity,
      }),
  }
}

// A driver's drawing for a part the viewer positions every frame, as `attachCarDrawing` does for a car.
export const attachDriverDrawing = (
  part: ModelObject,
  request: DriverDrawingRequest,
  host: Object3D
): DriverLink | null => {
  const drawing = getDriverDrawing(request)
  if (drawing === null) return null
  host.add(drawing.object)
  const holder = createStateHolder()
  const driver = takeOver(part, holder, () => {
    host.remove(drawing.object)
    drawing.dispose()
  })
  return {
    driver,
    sync: (opacity = SOLID_OPACITY) =>
      drawing.applyPose({ ...getPartPose(driver, holder), opacity }),
  }
}

const getRestingPose = (): RacerPartPose => ({
  matrix: new Matrix4(),
  isVisible: true,
  animationState: null,
})

// A car's drawing in place of the body model that sits in a group the viewer moves as a whole (the builder's, the showcase's): the
// model's meshes are hidden and the drawing goes into its group, with the wheels at rest. The model itself when no extension has a
// drawing.
export const showCarDrawing = (model: ModelObject, request: CarDrawingRequest): ModelObject => {
  const drawing = getCarDrawing(request)
  if (drawing === null) return model
  const { group, object } = model
  object.group.visible = false
  group.add(drawing.object)
  drawing.applyPose({ body: getRestingPose(), wheels: getRestingPose(), opacity: SOLID_OPACITY })
  drawing.onFailed(() => {
    group.remove(drawing.object)
    object.group.visible = true
  })
  return {
    group,
    object: {
      ...object,
      dispose: () => {
        object.dispose()
        group.remove(drawing.object)
        drawing.dispose()
      },
    },
  }
}

// A car's drawing in place of a model the viewer does not move itself (a cinema world's own copy of a champion's car), added to
// `host`: the original's meshes are hidden while the drawing stands, and shown again when it fails or goes. Body and wheels share
// the frame `sync` gives (the race car's, at rest); null keeps the original's.
export const followCarDrawing = (
  request: CarDrawingRequest,
  host: Object3D,
  setOriginalHidden: OriginalVisibility
): FollowedDrawing | null => {
  const drawing = getCarDrawing(request)
  if (drawing === null) return null
  host.add(drawing.object)
  setOriginalHidden(true)
  drawing.onFailed(() => {
    host.remove(drawing.object)
    setOriginalHidden(false)
  })
  return {
    sync: (pose) =>
      drawing.applyPose({
        body: { ...pose, animationState: null },
        wheels: { ...pose, animationState: null },
        opacity: SOLID_OPACITY,
      }),
    dispose: () => {
      host.remove(drawing.object)
      drawing.dispose()
      setOriginalHidden(false)
    },
  }
}

// A driver's drawing in place of a figure the viewer does not move itself (a cinema world's), as `followCarDrawing` does for a car:
// the pose's state is the clip the figure's skeleton plays.
export const followDriverDrawing = (
  request: DriverDrawingRequest,
  host: Object3D,
  setOriginalHidden: OriginalVisibility
): FollowedDrawing | null => {
  const drawing = getDriverDrawing(request)
  if (drawing === null) return null
  host.add(drawing.object)
  setOriginalHidden(true)
  return {
    sync: (pose) => drawing.applyPose({ ...pose, opacity: SOLID_OPACITY }),
    dispose: () => {
      host.remove(drawing.object)
      drawing.dispose()
      setOriginalHidden(false)
    },
  }
}

// A driver's drawing in place of a figure that sits in a group the viewer moves as a whole (a menu's, a cinema's): the figure's
// animation states and clock reach the drawing too. The model itself when no extension has a drawing.
export const showDriverDrawing = (
  model: ModelObject,
  request: DriverDrawingRequest
): ModelObject => {
  const drawing = getDriverDrawing(request)
  if (drawing === null) return model
  const { group, object } = model
  object.group.visible = false
  group.add(drawing.object)
  const pose = (state: SkeletonAnimationState | null) =>
    drawing.applyPose({ ...getRestingPose(), animationState: state, opacity: SOLID_OPACITY })
  pose(null)
  return {
    group,
    object: {
      ...object,
      setAnimationState: (state) => {
        object.setAnimationState(state)
        pose(state)
      },
      animate: (deltaMilliseconds) => {
        object.animate(deltaMilliseconds)
        drawing.animate(deltaMilliseconds)
      },
      dispose: () => {
        object.dispose()
        group.remove(drawing.object)
        drawing.dispose()
      },
    },
  }
}

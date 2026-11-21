// @ts-check

import { FixedFrameTransforms } from "@cesium/core";
import CelestialFrameTransforms from "./CelestialFrameTransforms.js";

/**
 * 包含将位置转换为不同参考框架的函数。
 *
 * @namespace Transforms
 *
 * @borrows FixedFrameTransforms.localFrameToFixedFrameGenerator 作为 localFrameToFixedFrameGenerator
 * @borrows FixedFrameTransforms.eastNorthUpToFixedFrame 作为 eastNorthUpToFixedFrame
 * @borrows FixedFrameTransforms.northEastDownToFixedFrame 作为 northEastDownToFixedFrame
 * @borrows FixedFrameTransforms.northUpEastToFixedFrame 作为 northUpEastToFixedFrame
 * @borrows FixedFrameTransforms.northWestUpToFixedFrame 作为 northWestUpToFixedFrame
 * @borrows FixedFrameTransforms.headingPitchRollToFixedFrame 作为 headingPitchRollToFixedFrame
 * @borrows FixedFrameTransforms.headingPitchRollQuaternion 作为 headingPitchRollQuaternion
 * @borrows FixedFrameTransforms.fixedFrameToHeadingPitchRoll 作为 fixedFrameToHeadingPitchRoll
 * @borrows FixedFrameTransforms.pointToWindowCoordinates 作为 pointToWindowCoordinates
 * @borrows FixedFrameTransforms.rotationMatrixFromPositionVelocity 作为 rotationMatrixFromPositionVelocity
 * @borrows CelestialFrameTransforms.computeIcrfToCentralBodyFixedMatrix 作为 computeIcrfToCentralBodyFixedMatrix
 * @borrows CelestialFrameTransforms.computeTemeToPseudoFixedMatrix 作为 computeTemeToPseudoFixedMatrix
 * @borrows CelestialFrameTransforms.preloadIcrfFixed 作为 preloadIcrfFixed
 * @borrows CelestialFrameTransforms.computeIcrfToFixedMatrix 作为 computeIcrfToFixedMatrix
 * @borrows CelestialFrameTransforms.computeMoonFixedToIcrfMatrix 作为 computeMoonFixedToIcrfMatrix
 * @borrows CelestialFrameTransforms.computeIcrfToMoonFixedMatrix 作为 computeIcrfToMoonFixedMatrix
 * @borrows CelestialFrameTransforms.computeFixedToIcrfMatrix 作为 computeFixedToIcrfMatrix
 */
const Transforms = {
  ...FixedFrameTransforms,
  ...CelestialFrameTransforms,
};

export default Transforms;

// middlewares/authorize-ward.middleware.js
const WardMember = require('../model/ward-member.model')
const AppError = require('../helpers/apperror')

/**
 * authorizeWard
 * ตรวจสิทธิ์ user ใน ward ตาม role
 *
 * @param {...String|Array} roles
 */
module.exports = (...roles) => {
  // รองรับ authorizeWard('HEAD') หรือ authorizeWard(['HEAD','HR'])
  const allowRoles = roles.flat()

  return async (req, res, next) => {
    const userId = req.user.id
    const wardId = req.params.wardId || req.body.wardId

    if (!wardId) {
      return next(new AppError('Ward id is required', 400))
    }

    const userWard = await WardMember.findOne({
      userId,
      wardId,
      status: 'ACTIVE',
      roles: { $in: allowRoles }
    })

    if (!userWard) {
      return next(
        new AppError('You are not authorized for this ward', 403)
      )
    }

    // แนบ context ไว้ใช้ต่อใน controller
    req.userWard = userWard

    next()
  }
}

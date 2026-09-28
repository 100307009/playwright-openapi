/**
 * Every OpenAPI path template this suite exercises, grouped the same way the
 * test data and specs are (pet / store / user). Test data scenarios and step
 * functions both import paths from here rather than hand-typing them, so a
 * path only ever needs to change in one place.
 *
 * These are template paths (e.g. "/pet/{petId}"), not concrete URLs - the
 * same shape `validateSchema` needs to look the operation up in the spec.
 */
export const ENDPOINTS = {
  pet: {
    base: '/pet',
    byId: '/pet/{petId}',
    findByTags: '/pet/findByTags',
    findByStatus: '/pet/findByStatus',
  },
  store: {
    inventory: '/store/inventory',
    order: '/store/order',
    orderById: '/store/order/{orderId}',
  },
  user: {
    base: '/user',
    login: '/user/login',
    logout: '/user/logout',
    byUsername: '/user/{username}',
  },
} as const;

'use strict'

/**
 * Utilities made available in all templates
 *
 * @module controllers/templating
 */

const securityService = require('../services/security-service')
const postService = require('../services/post-service')

const DASHBOARD_PAGES = ['posts', 'settings', 'password']

module.exports = {
  buildUrl,

  isPast: postService.isPast,
  wasEdited: postService.wasEdited,

  canUserRead: securityService.canUserRead,
  canUserWrite: securityService.canUserWrite,
  canUserManage: securityService.canUserManage
}

function buildUrl (model, type, page = null, options = {}) {
  let pagePath = (page ? '/' + page : '')

  if (type === 'event') {
    // Event model
    return '/' + model.get('name') + pagePath
  } else if (type === 'entry') {
    // Entry model
    if (model && model.get('id')) {
      return '/' + model.get('event_name') + '/' + model.get('id') + '/' + model.get('name') + pagePath
    } else {
      return '/' + model.get('event_name') + '/create-entry'
    }
  } else if (type === 'user') {
    // User Role model / User model
    if (DASHBOARD_PAGES.indexOf(page) !== -1) {
      return '/dashboard/' + page
    } else {
      let userId = model.get('name') || model.get('user_name')
      return '/user/' + userId + pagePath
    }
  } else if (type === 'post') {
    // Post model
    if (page === 'create') {
      pagePath += '?'
      if (options.eventId) pagePath += 'eventId=' + options.eventId
      if (options.entryId) pagePath += '&entryId=' + options.entryId
      return '/post' + pagePath
    } else {
      return '/post/' + model.get('id') + '/' + model.get('name') + pagePath
    }
  }
}
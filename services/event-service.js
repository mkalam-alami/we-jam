'use strict'

/**
 * Service for interacting with events & entries.
 *
 * @module services/event-service
 */

const Event = require('../models/event-model')
const Entry = require('../models/entry-model')
const constants = require('../core/constants')

module.exports = {
  createEvent,
  refreshEventReferences,

  findEventById,
  findEventByName,
  findEventByStatus,
  findEvents,

  createEntry,

  findEntryById,
  findUserEntries,
  findUserEntryForEvent
}

/**
 * Creates a new empty event
 * @return {Event}
 */
function createEvent () {
  return new Event({
    'published_at': new Date() // TODO Let admins choose when to publish
  })
}

/**
 * Refreshes various models that cache the event name.
 * Call this after changing the name of an event.
 * @param {Event} event
 */
async function refreshEventReferences (event) {
  // TODO Transaction
  let entryCollection = await Entry.where('event_id', event.id).fetchAll()
  for (let entry of entryCollection.models) {
    entry.set('event_name', event.get('name'))
    await entry.save()
  }
}

/**
 * Fetches an Event by its ID, with all its Entries.
 * @param id {id} Event ID
 * @returns {Event}
 */
async function findEventById (id) {
  return Event.where('id', id)
    .fetch({ withRelated: ['entries', 'entries.userRoles'] })
}

/**
 * Fetches an Event by its name, with all its Entries.
 * @param id {id} Event name
 * @returns {Event}
 */
async function findEventByName (name) {
  return Event.where('name', name)
    .fetch({ withRelated: ['entries', 'entries.userRoles'] })
}

/**
 * Fetches all Events and their Entries.
 * @param {object} options Allowed: status name
 * @returns {array(Event)}
 */
async function findEvents (options = {}) {
  let eventModels = await new Event()
    .orderBy('published_at', 'DESC')
  if (options.status) eventModels = eventModels.where('status', options.status)
  if (options.name) eventModels = eventModels.where('name', options.name)
  return eventModels.fetchAll({ withRelated: ['entries'] })
}

/**
 * Fetches the currently live Event.
 * @param globalStatus {string} One of "pending", "open", "closed"
 * @returns {Event} The earliest pending event OR the currently open event OR the last closed event.
 */
async function findEventByStatus (status) {
  let sortOrder = 'ASC'
  if (status === 'closed') {
    sortOrder = 'DESC'
  }
  return Event.where('status', status)
    .orderBy('created_at', sortOrder)
    .fetch()
}

/**
 * Creates and persists a new entry, initializing the owner UserRole.
 * @param  {User} user
 * @param  {Event} event
 * @return {Entry}
 */
async function createEntry (user, event) {
  if (await findUserEntryForEvent(user, event.get('id'))) {
    throw new Error('User already has an entry for this event')
  }

  // TODO Better use of Bookshelf API
  let entry = new Entry()
  await entry.save() // otherwise the user role won't have a node_id
  entry.set('event_id', event.get('id'))
  entry.set('event_name', event.get('name'))
  await entry.userRoles().create({
    user_id: user.get('id'),
    user_name: user.get('name'),
    user_title: user.get('title'),
    permission: constants.PERMISSION_MANAGE
  })
  return entry
}

/**
 * Fetches an Entry by its ID.
 * @param id {id} Entry ID
 * @returns {Entry}
 */
async function findEntryById (id) {
  return Entry.where('id', id).fetch({ withRelated: ['event', 'userRoles'] })
}

/**
 * Retrieves all the entries an user contributed to
 * @param  {User} user
 * @return {array(Entry)|null}
 */
async function findUserEntries (user) {
  let entryCollection = await Entry.query((qb) => {
    qb.distinct()
      .innerJoin('user_role', 'entry.id', 'user_role.node_id')
      .where({
        'user_role.user_id': user.get('id'),
        'user_role.node_type': 'entry'
      })
  }).fetchAll({ withRelated: ['userRoles'] })
  return entryCollection.models
}

/**
 * Retrieves the entry a user submited to an event
 * @param  {User} user
 * @param  {string} eventId
 * @return {Entry|null}
 */
async function findUserEntryForEvent (user, eventId) {
  return Entry.query((query) => {
    query.innerJoin('user_role', 'entry.id', 'user_role.node_id')
      .where({
        'entry.event_id': eventId,
        'user_role.user_id': user.get('id'),
        'user_role.node_type': 'entry'
      })
  }).fetch({ withRelated: ['userRoles'] })
}

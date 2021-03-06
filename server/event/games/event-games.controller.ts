import { CommonLocals } from "server/common.middleware";
import enums from "server/core/enums";
import forms from "server/core/forms";
import log from "server/core/log";
import security from "server/core/security";
import settings from "server/core/settings";
import { SETTING_EVENT_REQUIRED_ENTRY_VOTES } from "server/core/settings-keys";
import entryService, { FindGamesOptions } from "server/entry/entry.service";
import platformService from "server/entry/platform/platform.service";
import tagService from "server/entry/tag/tag.service";
import eventService from "server/event/event.service";
import ratingService from "server/event/ratings/rating.service";
import { CustomRequest, CustomResponse } from "server/types";
import userService from "server/user/user.service";
import { EventLocals } from "../event.middleware";

/**
 * Browse event games
 */
export async function viewEventGames(req: CustomRequest, res: CustomResponse<EventLocals>): Promise<void> {
  res.locals.pageTitle += " | Games";

  const { user, event } = res.locals;
  if (event.get("status_entry") === enums.EVENT.STATUS_ENTRY.OFF) {
    res.errorPage(404);
    return;
  }

  // Search form & pagination
  const searchOptions = await handleGameSearch(req, res.locals);

  // Search entries
  let rescueEntries = [];
  if (event.get("status_results") === "voting_rescue") {
    const canVoteInEvent = await ratingService.canVoteInEvent(user, event);
    if (canVoteInEvent || security.isMod(user)) {
      rescueEntries = (await entryService.findRescueEntries(event, user)).models;
    }
  }
  const requiredVotes = await settings.findNumber(SETTING_EVENT_REQUIRED_ENTRY_VOTES, 10);
  const entriesCollection = await entryService.findEntries(searchOptions);
  const platforms = await platformService.findAll();

  // Fetch vote history
  let voteHistory = [];
  if (user && [enums.EVENT.STATUS_RESULTS.VOTING, enums.EVENT.STATUS_RESULTS.VOTING_RESCUE,
    enums.EVENT.STATUS_RESULTS.RESULTS].includes(event.get("status_results"))) {
    const voteHistoryCollection = await ratingService.findVoteHistory(user.get("id"), event, { pageSize: 5 });
    voteHistory = voteHistoryCollection.models;
  }

  res.render<EventLocals>("event/games/event-games", {
    ...res.locals,
    rescueEntries,
    requiredVotes,
    entriesCollection,
    voteHistory,
    searchOptions,
    platforms,
  });
}

/**
 * Fills a searchOptions object according to the request GET parameters
 */
export async function handleGameSearch(
  req: CustomRequest,
  locals: CommonLocals): Promise<FindGamesOptions> {

  // Pagination
  const searchOptions: FindGamesOptions = {
    pageSize: 20,
    page: forms.isId(req.query.p) ? forms.parseInt(req.query.p.toString()) : 1
  };

  // Text search
  searchOptions.search = forms.sanitizeString(req.query.search?.toString());

  // User search
  if (forms.isId(req.query.user)) {
    searchOptions.userId = forms.parseInt(req.query.user.toString());
    searchOptions.user = await userService.findById(searchOptions.userId);
  }

  // Division
  if (req.query.divisions) {
    const divisions = Array.isArray(req.query.divisions) ? req.query.divisions : [req.query.divisions];
    searchOptions.divisions = divisions.map(division => forms.sanitizeString(division?.toString()));

    // Hack for Kajam's ranked division
    if (searchOptions.divisions.includes(enums.DIVISION.SOLO) ||
        searchOptions.divisions.includes(enums.DIVISION.TEAM)) {
      searchOptions.divisions.push(enums.DIVISION.RANKED);
    }
  }
  if (searchOptions.divisions && searchOptions.divisions.length === Object.keys(enums.DIVISION).length) {
    searchOptions.divisions = undefined;
  }

  // Platforms
  if (req.query.platforms) {
    const platformsRaw = (Array.isArray(req.query.platforms)) ? req.query.platforms : [req.query.platforms];
    let platforms = platformsRaw.map(platform => platform.toString());
    const platformsIds = platforms.map((str) => forms.parseInt(str));
    if (platformsIds.includes(NaN)) {
      platforms = [];
      log.error("Invalid platform query: " + req.query.platforms);
    }
    searchOptions.platforms = platformsIds;
  }

  // Tags
  if (req.query.tags) {
    const tagsRaw = (Array.isArray(req.query.tags)) ? req.query.tags : [req.query.tags];
    let tagIds = tagsRaw.map((str) => forms.parseInt(str.toString()));
    if (tagIds.includes(NaN)) {
      tagIds = [];
      log.warn("Invalid tags in query params: " + req.query.tags);
    }
    const tagCollection = await tagService.fetchByIds(tagIds);
    searchOptions.tags = tagCollection.map((tag) => ({ id: tag.get("id"), value: tag.get("value") }));
  }

  // Event
  let event = forms.isId(req.query.eventId) ? await eventService.findEventById(forms.parseInt(req.query.eventId.toString())) : undefined;
  if (forms.isId(req.query.eventId)) {
    event = await eventService.findEventById(forms.parseInt(req.query.eventId.toString()));
  } else if (req.query.eventId === undefined) {
    // Default event
    event = locals.event;
    if (!event && locals.featuredEvent && eventService.isVotingInProgress(locals.featuredEvent)) {
      event = locals.featuredEvent;
    }
  }

  if (event) {
    searchOptions.eventId = event.get("id");
  } else if (req.query.eventId === "none") {
    searchOptions.eventId = null;
  }

  // Sorting
  searchOptions.sortBy = "karma";
  if (event && eventService.isRanked(event) && !eventService.isVotingInProgress(event)) {
    searchOptions.sortBy = "hotness";
  }

  // Hide rated/commented
  if (req.query.hideReviewed && locals.user) {
    searchOptions.notReviewedById = locals.user.get("id");
  }

  // Other filters
  searchOptions.highScoresSupport = Boolean(req.query.highScoresSupport);
  searchOptions.allowsTournamentUse = Boolean(req.query.allowsTournamentUse);

  return searchOptions;
}

import forms from "server/core/forms";
import links from "server/core/links";
import security from "server/core/security";
import { StreamerStatus } from "server/entity/event-participation.entity";
import { CustomRequest, CustomResponse } from "server/types";
import userService from "server/user/user.service";
import eventParticipationService from "./dashboard/event-participation.service";
import { EventLocals } from "./event.middleware";
import eventService from "./event.service";
import enums from "server/core/enums";

export async function eventStreamers(req: CustomRequest, res: CustomResponse<EventLocals>) {
  const { user, event } = res.locals;

  const filter = security.isMod(user) ? "all-streamer-states" : "streamers";
  const eventParticipations = await eventParticipationService.getEventParticipations(event, { filter });
  const streamerOnlyTournamentIsLive = eventService.getEventFlag(event, "streamerOnlyTournament")
    && ![enums.EVENT.STATUS_TOURNAMENT.DISABLED, enums.EVENT.STATUS_TOURNAMENT.OFF].includes(event.get("status_tournament"));

  res.render("event/event-streamers.html", {
    eventParticipations,
    streamerOnlyTournamentIsLive
  });
}

export async function eventStreamersDoc(req: CustomRequest, res: CustomResponse<EventLocals>) {
  res.render("event/event-streamers-doc");
}

export async function moderateEventStreamers(req: CustomRequest, res: CustomResponse<EventLocals>) {
  const { event, user } = res.locals;

  if (!security.isMod(user)) {
    res.errorPage(403);
    return;
  }

  let streamerStatus: StreamerStatus | undefined;
  if (!forms.isId(req.body.targetUserId)) {
    res.locals.alerts.push({ type: "danger", message: "Invalid user" });
  }
  if (req.body.approve !== undefined) { streamerStatus = "approved"; }
  if (req.body.reset !== undefined) { streamerStatus = "requested"; }
  if (req.body.ban !== undefined) { streamerStatus = "banned"; }
  if (!streamerStatus) {
    res.locals.alerts.push({ type: "danger", message: "Invalid action" });
  }

  if (res.locals.alerts.length === 0) {
    const targetUser = await userService.findById(parseInt(req.body.targetUserId, 10));
    const ep = await eventParticipationService.getEventParticipation(event, targetUser);
    if (ep) {
      await eventParticipationService.setStreamingPreferences(event, targetUser, {
        streamerStatus,
        streamerDescription: ep.streamerDescription
      });
    }
  }

  res.redirect(links.routeUrl(event, "event", "streamers"));
}

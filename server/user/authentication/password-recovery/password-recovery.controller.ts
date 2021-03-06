import { CommonLocals } from "server/common.middleware";
import { CustomRequest, CustomResponse } from "server/types";
import passwordRecoveryService from "server/user/password-recovery/password-recovery.service";

/**
 * Password change page, following the click on a password recovery link.
 */
export async function passwordRecovery(req: CustomRequest, res: CustomResponse<CommonLocals>): Promise<void> {
  let errorMessage: string | null = null;

  if (res.locals.user) {
    res.redirect("/");
    return;
  }

  if (passwordRecoveryService.isPasswordRecoveryTokenValid(res.app, req.query.token?.toString())) {
    res.locals.token = true;

    if (req.method === "POST") {
      if (!req.body["new-password"]) {
        errorMessage = "You must enter a new password";
      } else if (req.body["new-password"] !== req.body["new-password-bis"]) {
        errorMessage = "New passwords do not match";
      } else {
        const result = await passwordRecoveryService.recoverPasswordUsingToken(res.app, req.query.token?.toString(), req.body["new-password"]);
        if (result === true) {
          res.locals.success = true;
        } else {
          errorMessage = result;
        }
      }
    }
  }

  if (errorMessage) {
    res.locals.alerts.push({ type: "danger", message: errorMessage });
  }

  res.render<CommonLocals>("user/authentication/password-recovery/password-recovery", res.locals);
}

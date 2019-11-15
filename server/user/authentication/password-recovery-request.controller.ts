
import forms from "server/core/forms";
import passwordRecoveryService from "../password-recovery/password-recovery.service";

export async function passwordRecoveryRequest(req, res) {
  let errorMessage = null;

  if (res.locals.user) {
    res.redirect("/");
    return;
  }

  if (req.method === "POST") {
    if (!forms.isEmail(req.body.email)) {
      errorMessage = "Invalid email address";
    }

    if (!errorMessage) {
      try {
        await passwordRecoveryService.sendPasswordRecoveryEmail(res.app, req.body.email);
        res.locals.success = true;
      } catch (err) {
        errorMessage = err.message;
      }
    }
  }

  res.render("user/authentication/password-recovery-request", {
    errorMessage,
  });
}

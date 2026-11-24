import { AppError } from "@/lib/errors/AppError";

//------------- Classe de convite
export class InviteError extends AppError {
  constructor(
    public readonly code: "inviteInvalid" | "inviteExpired" | "inviteUnavailable" | "accountInactive" | "inviteAccountMismatch",
    message: string,
    statusCode: number = 400,
  ) {
    super(message, statusCode);
  }
}
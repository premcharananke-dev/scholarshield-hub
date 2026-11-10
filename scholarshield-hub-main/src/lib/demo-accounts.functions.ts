import { createServerFn } from "@tanstack/react-start";

export const ensureDemoAccounts = createServerFn({
  method: "POST",
}).handler(async () => {
  return { ok: true };
});
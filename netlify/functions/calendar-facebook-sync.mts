import { runCalendarFacebookAutomation } from "../lib/facebook-calendar.mjs";

export default async function handler() {
  try {
    const summary = await runCalendarFacebookAutomation();
    console.log("Facebook calendar automation finished", summary);
  } catch (error) {
    console.error("Facebook calendar automation could not finish", error);
  }
}

import {
  facebookCloseFinished,
  syncFacebookClosed,
} from "../lib/facebook.mjs";
import {
  clearLocation,
  readStoredLocation,
} from "../lib/location.mjs";

export default async function handler() {
  try {
    const { location, expired } = await readStoredLocation();
    if (!location || !expired) return;

    const facebook = await syncFacebookClosed(location.updatedAt);
    if (facebookCloseFinished(facebook)) {
      await clearLocation();
      console.log("Expired live location and closed its Facebook post.");
      return;
    }
    console.warn("The location expired, but its Facebook post still needs attention.");
  } catch (error) {
    console.error("Could not process the expired live location", error);
  }
}

import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getActiveChallenge from "./tools/get-active-challenge";
import getLeaderboard from "./tools/get-leaderboard";
import getMyProfile from "./tools/get-my-profile";
import listMyNotifications from "./tools/list-my-notifications";
import listMySubmissions from "./tools/list-my-submissions";

// The OAuth issuer must be the direct Supabase host; the project ref is the
// only value that survives publish unchanged.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "koth-mcp",
  title: "KOTH",
  version: "0.1.0",
  instructions:
    "Tools for KOTH, a weekly skill-challenge competition app. Read the current challenge, the leaderboard, and the signed-in user's profile, submissions, and notifications.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getActiveChallenge, getLeaderboard, getMyProfile, listMySubmissions, listMyNotifications],
});

// Preview builds must never open or upgrade the live app's local database.
// Production builds omit VITE_RELEASE_PREVIEW and retain the original names.
export const releasePreview = import.meta.env.VITE_RELEASE_PREVIEW === "true";
export const localDatabaseName = releasePreview
  ? "eatfirst-v2-preview"
  : "eatfirst";
export const pendingInvitationKey = releasePreview
  ? "eatfirst-preview-invite"
  : "eatfirst-invite";

import type { ViewState } from './app-state';

export function openProfile(current: ViewState, profileId: number): Partial<ViewState> {
  if (profileId === current.left || current.openProfiles.includes(profileId)) return {};
  return {
    openProfiles: [...current.openProfiles, profileId], right: profileId, compare: true,
    ...(current.common ? { rightDate: current.leftDate } : {}),
  };
}

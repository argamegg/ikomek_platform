import type { SavedLocation, User } from "../types/platform";

export function getRoleBadges(user: User) {
  return user.roles.map((role) => role.toUpperCase());
}

export function getSavedLocationGroups(savedLocations: SavedLocation[]) {
  return savedLocations.reduce<Record<string, SavedLocation[]>>((groups, location) => {
    const group = groups[location.type] ?? [];
    group.push(location);
    groups[location.type] = group;
    return groups;
  }, {});
}

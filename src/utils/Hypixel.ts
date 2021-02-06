import { AxiosResponse } from 'axios'
import HttpException from '../exceptions/HttpException'
import DungeonsGenerator from '../generators/DungeonsGenerator'
import SkillsGenerator from '../generators/SkillsGenerator'
import SlayersGenerator from '../generators/SlayersGenerator'
import { PlayerStats, SkyBlockProfile, SkyBlockProfileMembersResponse, SkyBlockProfilePlayerStats, SkyBlockProfileStats } from '../types/hypixel'

/**
 * Merges a SkyBlock profile, and a player profile together into a single object.
 *
 * @param profile The SkyBlock profile that should be merged
 * @param player The player profile that should be merged
 */
export function mergeSkyBlockProfileAndPlayer(profile: SkyBlockProfileStats, player: PlayerStats): SkyBlockProfilePlayerStats {
  return {
    id: profile.id,
    name: profile.name,
    username: player.username,
    last_save_at: profile.last_save_at,
    weight: profile.weight,
    weight_overflow: profile.weight_overflow,
    skills: profile.skills,
    slayers: profile.slayers,
    dungeons: profile.dungeons,
  }
}

/**
 * Parses and formats the Player data into a more user-friend
 * format with only the data we're actually interested in.
 *
 * @param player The player response object
 * @param uuid The UUID of the player the player data were loaded for
 */
export function parseHypixelPlayer(player: AxiosResponse, uuid: string): PlayerStats {
  if (player.data.hasOwnProperty('player') && player.data.player == null) {
    throw new HttpException(404, `Found no Player data for a user with a UUID of '${uuid}'`)
  }

  const data: any = player.data.player

  return {
    username: data.displayname,
    firstLogin: data.firstLogin,
    lastLogin: data.lastLogin,
    socialMedia: data.socialMedia,
  }
}

/**
 * Parses and formats the SkyBlock profiles into a more user-friendly format
 * with only the skills, slayers, dungeon, and weight information.
 *
 * @param profiles A SkyBlock profiles response object
 * @param uuid The UUID of the player the profiles were loaded for
 */
export function parseSkyBlockProfiles(profiles: AxiosResponse, uuid: string): SkyBlockProfileStats[] {
  if (profiles.data.hasOwnProperty('profiles') && profiles.data.profiles == null) {
    throw new HttpException(404, `Found no SkyBlock profiles for a user with a UUID of '${uuid}'`)
  }

  const result: SkyBlockProfileStats[] = []
  const minifiedUuid = uuid.replace(/-/g, '')

  for (let profileData of profiles.data.profiles) {
    if (!isValidProfile(profileData.members, minifiedUuid)) {
      continue
    }

    const profile: SkyBlockProfile = profileData.members[minifiedUuid]

    result.push({
      id: profileData.profile_id,
      name: profileData.cute_name,
      last_save_at: {
        time: profile.last_save,
        date: new Date(profile.last_save),
      },
      weight: 0,
      weight_overflow: 0,
      skills: SkillsGenerator.build(profile),
      slayers: SlayersGenerator.build(profile),
      dungeons: DungeonsGenerator.build(profile),
    })
  }

  // Throws a 404 if the user doesn't have any SkyBlock profiles, this step can be
  // reached if the user is invited to a profile so it shows up as a SkyBlock
  // profile in the API, but they haven't accepted the invitation yet.
  if (result.length == 0) {
    throw new HttpException(404, `Found no SkyBlock profiles for a user with a UUID of '${uuid}'`)
  }

  for (let stats of result) {
    stats.weight = sumWeight(stats, 'weight')
    stats.weight_overflow = sumWeight(stats, 'weight_overflow')
  }

  return result
}

/**
 * Checks if the profile is valid by ensuring the player is a member of
 * the profile, and that they have used the profile at least once.
 *
 * @param profileMembers The list of members for the current profile
 * @param minifiedUuid The minified UUID for the player
 */
function isValidProfile(profileMembers: SkyBlockProfileMembersResponse, minifiedUuid: string) {
  return profileMembers.hasOwnProperty(minifiedUuid) && profileMembers[minifiedUuid].last_save != undefined
}

/**
 * Sums up the given stats with the given weight type.
 *
 * @param stats The stats that the weight should be calculated with
 * @param type The weight type that should be summed up
 */
function sumWeight(stats: any, type: string) {
  let weight = 0

  if (stats.skills != null) {
    weight += stats.skills[type]
  }

  if (stats.slayers != null) {
    weight += stats.slayers[type]
  }

  if (stats.dungeons != null) {
    weight += stats.dungeons[type]
  }

  return weight
}
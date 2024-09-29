import { notarize } from '@electron/notarize';
const appPath = "./dist/mac/ArmCord.app"
const appleId = process.env.APPLE_ID
const appleIdPassword = process.env.APPLE_ID_PASSWORD
const appleIdTeamId = process.env.APPLE_ID_TEAM_ID
await notarize({
  appPath,
  appleId,
  appleIdPassword,
  appleIdTeamId,
});
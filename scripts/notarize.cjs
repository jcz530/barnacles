exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize on macOS
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Check if notarization should be skipped
  if (process.env.SKIP_NOTARIZE === 'true') {
    console.log('⚠️  Skipping notarization (SKIP_NOTARIZE=true)');
    return;
  }

  // Check if @electron/notarize is available (won't be installed for local builds)
  let notarize;
  try {
    notarize = require('@electron/notarize').notarize;
  } catch (error) {
    console.log('⚠️  Skipping notarization (@electron/notarize not installed)');
    return;
  }

  // Check for required environment variables
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn('Skipping notarization: Missing required environment variables');
    console.warn('Required: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Notarizing ${appPath}...`);

  try {
    await notarize({
      appPath,
      appleId,
      appleIdPassword,
      teamId,
    });
    console.log('Notarization complete!');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};

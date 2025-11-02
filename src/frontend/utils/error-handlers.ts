/**
 * Formats a permission error message with instructions for the user
 */
export function getPermissionErrorMessage(appType: 'terminal' | 'IDE'): string {
  return (
    'Permission Required\n\n' +
    `To allow this app to open the ${appType}:\n\n` +
    '1. Open System Settings\n' +
    '2. Go to Privacy & Security\n' +
    '3. Scroll down and click on Automation\n' +
    '4. Find Barnacles in the list\n' +
    `5. Enable the checkbox next to the ${appType} app\n\n` +
    `Then try opening the ${appType} again.`
  );
}

/**
 * Checks if an error is a permission error and returns formatted message
 */
export function handlePermissionError(error: any, appType: 'terminal' | 'IDE'): string | null {
  // Check for structured permission error response
  if (error?.response?.status === 403 && error?.response?.data?.code) {
    const { targetApp, instructions } = error.response.data;
    return `Permission Required: ${targetApp}\n\n${instructions}`;
  }

  // Fallback: check error message for permission issues
  if (error?.message?.includes('Not authorized')) {
    return getPermissionErrorMessage(appType);
  }

  return null;
}

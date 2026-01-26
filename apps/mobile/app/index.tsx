/**
 * App Entry Point
 * Redirects to the appropriate interface based on user state
 */

import { Redirect } from 'expo-router';

export default function Index() {
  // For now, redirect directly to the client interface
  // Later: add auth logic to redirect to provider interface if connected as provider
  return <Redirect href="/(client)/(tabs)" />;
}

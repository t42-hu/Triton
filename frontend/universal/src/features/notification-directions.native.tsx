import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { DIRECTIONS_ACTION, directionsDestination } from '../domain/directions';
import { registerDirectionsCategory } from '../data/reminder-runtime.native';
import { DirectionsDialog } from './directions-dialog';

/** Handles both a running app and a cold start from the notification's route action. */
export function NotificationDirections() {
  const [location, setLocation] = useState<string | null>(null);
  const handled = useRef<string | null>(null);
  useEffect(() => {
    function respond(response: Notifications.NotificationResponse | null) {
      if (!response || response.actionIdentifier !== DIRECTIONS_ACTION) return;
      const request = response.notification.request;
      const data = request.content.data;
      if (handled.current === request.identifier || data?.kind !== 'class-reminder' || typeof data.location !== 'string' || !directionsDestination(data.location)) return;
      handled.current = request.identifier;
      setLocation(data.location);
      Notifications.clearLastNotificationResponse();
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(respond);
    respond(Notifications.getLastNotificationResponse());
    void registerDirectionsCategory().catch(ignoreCategoryError);
    return () => subscription.remove();
  }, []);
  return location ? <DirectionsDialog location={location} close={() => setLocation(null)} /> : null;
}

function ignoreCategoryError() { /* Reconciliation retries category registration. */ }

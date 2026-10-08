import { useEffect, useRef } from 'react';
import { useRealtime, type LiveTable, type RoomEvent, type RowChange } from './RealtimeProvider';

export const useConnection = () => useRealtime().status;
export const usePartnerPresence = () => useRealtime().partner;
export const useSetMyStatus = () => useRealtime().setMyStatus;
export const useSendRoomEvent = () => useRealtime().send;

/** Runs the latest `handler` for every broadcast of `event` on the room channel. */
export function useRoomEvent(event: RoomEvent, handler: (payload: Record<string, unknown>) => void) {
  const { onEvent } = useRealtime();
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => onEvent(event, (p) => ref.current(p)), [onEvent, event]);
}

/** Runs the latest `handler` for every Postgres change on `table` that this member may read. */
export function useTableChange(table: LiveTable, handler: (change: RowChange) => void) {
  const { onTable } = useRealtime();
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => onTable(table, (c) => ref.current(c)), [onTable, table]);
}

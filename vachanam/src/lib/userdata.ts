import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

/** Re-runs a query every time the screen gains focus, so lists are always current. */
export function useQuery<T>(sql: string, params: (string | number)[] = []) {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(params);
  useFocusEffect(useCallback(() => {
    let live = true;
    db.getAllAsync<T>(sql, params).then((r) => { if (live) { setRows(r); setError(null); } }).catch((e) => live && setError(String(e?.message ?? e)));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, sql, key]));
  return { rows, error, loading: rows === null && !error };
}

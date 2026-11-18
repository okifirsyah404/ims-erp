import * as React from "react";

/**
 * Opens a sheet while `location.hash === #<key>`; closing clears the hash. Lets plain
 * server-rendered links (`href="#accept"`) open React sheets without shared state.
 */
export function useHashSheet(key: string) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const sync = () => setOpen(location.hash === `#${key}`);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [key]);

  const onOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next && location.hash === `#${key}`) history.replaceState(null, "", location.pathname + location.search);
    },
    [key],
  );

  return { open, onOpenChange };
}

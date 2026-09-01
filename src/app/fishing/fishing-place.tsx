"use client";

// What the /fishing bar is allowed to say the reader is looking at.
//
// The bar lives in `/fishing/layout.tsx`, above every page under it, so it
// cannot see which city it is sitting on top of. The pathname carries a slug
// and not a name, and a slug is not a name: "port-mcneill" title-cases to
// "Port Mcneill", and a bar that guessed would put a misspelling of an
// angler's own town in front of them.
//
// So the page says it. The city page already holds `city.name` from the
// hierarchy, renders a line of this on the server, and the bar reads it back.
// The direction is the only unusual thing here: normally chrome tells a page
// about itself, and this is a page telling the chrome.
//
// Deliberately two contexts. The setter's identity never changes, so a
// publisher never re-renders when the value does; only the bar, which is the
// one component that reads it.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const PlaceContext = createContext<string | null>(null);
const SetPlaceContext = createContext<(name: string | null) => void>(() => {});

export function FishingPlaceProvider({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState<string | null>(null);

  // `children` is a server-rendered node held as a prop, so a change here
  // re-renders the consumers and nothing else. The whole directory tree does
  // not repaint because a bar learned a city name.
  return (
    <SetPlaceContext.Provider value={setPlace}>
      <PlaceContext.Provider value={place}>{children}</PlaceContext.Provider>
    </SetPlaceContext.Provider>
  );
}

/** The city the current page is about, or null where no page has claimed one. */
export function useFishingPlace() {
  return useContext(PlaceContext);
}

/**
 * Renders nothing. Names the city for the bar above, for as long as this page
 * is mounted, and takes the name back down on the way out so the next route
 * cannot inherit it.
 */
export function DeclareFishingPlace({ name }: { name: string }) {
  const setPlace = useContext(SetPlaceContext);
  // Guards against the empty string as well as null: a bar whose blue word is
  // "" renders the preposition with nothing after it.
  const value = useMemo(() => name.trim() || null, [name]);

  useEffect(() => {
    setPlace(value);
    return () => setPlace(null);
  }, [value, setPlace]);

  return null;
}

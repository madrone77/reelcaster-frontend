"use client";

/**
 * The home-city setting, so the choice made at signup can be changed later.
 *
 * The confirmation modal tells people "you can change it any time", and until
 * this existed that was not true: the question was asked once and the answer
 * was only reachable by clearing browser storage. A setting a product asks for
 * has to be a setting the product will show you again.
 *
 * It reuses `HomeCityModal` rather than rebuilding the picker, so the list of
 * covered cities, the nearest-first alternates and the typeahead all behave
 * identically here and at signup, and a new covered city appears in both
 * without a second edit.
 */

import { useState } from "react";
import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import HomeCityModal from "@/app/components/welcome/home-city-modal";
import { cityName } from "@/app/dashboard/around-you";
import { useHomeCityState } from "@/app/explore/lib/use-home-city";

export default function HomeCityCard() {
  const { slug, ready } = useHomeCityState(true);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card className="border-rc-rule shadow-none">
        <CardContent className="flex items-start gap-4 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft">
            <MapPin className="h-5 w-5 text-rc-brand" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-rc-ink">Home city</p>
            <p className="mt-1 text-sm text-rc-ink-soft">
              {/* `ready` rather than a null check: the answer arrives from the
                  profile, so a bare null reads as "not set" for the first
                  moments of every load and would tell somebody who has a city
                  that they do not. */}
              {!ready
                ? " "
                : slug
                  ? `Your dashboard and the map open on ${cityName(slug)}.`
                  : "Set one and your dashboard opens on your own water."}
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setOpen(true)}
          >
            {ready && slug ? "Change" : "Set city"}
          </Button>
        </CardContent>
      </Card>

      {/* Mounted only while open. The modal fetches its suggestion on mount,
          so leaving it mounted would put that request on every settings load
          for a question nobody asked. */}
      {open && <HomeCityModal pickerOnly onClose={() => setOpen(false)} />}
    </>
  );
}

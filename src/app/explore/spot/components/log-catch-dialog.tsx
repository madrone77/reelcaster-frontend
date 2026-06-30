"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import CatchForm, {
  type CatchFormSpot,
  type CatchConditions,
  type SpeciesOption,
} from "@/app/log-catch/catch-form";

/**
 * Spot-page "Log catch" dialog — wraps the shared CatchForm, pre-captured with
 * the current spot + live conditions (no GPS/EXIF needed since the spot is known).
 */
export default function LogCatchDialog({
  open,
  onOpenChange,
  spot,
  conditions,
  speciesOptions,
  initialSpeciesId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spot: CatchFormSpot;
  conditions: CatchConditions | null;
  speciesOptions: SpeciesOption[];
  initialSpeciesId?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-rc-panel border-rc-rule text-rc-ink sm:max-w-md p-6 max-h-[88vh] overflow-y-auto">
        <DialogTitle className="sr-only">Log a catch at {spot.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Record the fish you landed — species, size, photo and notes.
        </DialogDescription>
        <CatchForm
          spot={spot}
          conditions={conditions}
          speciesOptions={speciesOptions}
          initialSpeciesId={initialSpeciesId}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useVisualViewport } from "@/hooks/use-visual-viewport"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

/**
 * Stacking band. Both the overlay and the content portal to `document.body`,
 * so they compete with every other body-level layer on raw z-index, and the
 * one that wins is whichever number is bigger.
 *
 * The order the app needs, low to high:
 *
 *   z-40/50   page chrome: the explore top bar, the floating tab bar
 *   z-60/61   the explore bottom sheets: day picker, location, filters
 *   z-70      this dialog, and `alert-dialog`
 *   z-80      `select` content, so a picker inside a dialog still opens
 *   z-9998+   the full screen gates: auth-gate, the welcome modals
 *
 * These used to sit at z-50, which put them UNDER the explore sheets. The
 * sheets are where the locked forecast days live, so tapping one opened the
 * trial modal behind the sheet's own full screen scrim: the offer was visible
 * through the dim but the email field and the subscribe button could not be
 * tapped at all, because the scrim swallowed every click. Keep this above the
 * sheet band.
 */
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[70] bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      {/* The panel is a component of its own so that it — and the viewport
          measurement inside it — mount only while the dialog is open.
          `DialogPortal` renders its children through Radix's `Presence`,
          whereas this outer function runs for as long as the page holds a
          closed `<Dialog>` anywhere in its tree. */}
      <DialogPanel {...props}>{children}</DialogPanel>
    </DialogPortal>
  )
}

/**
 * Every dialog is keyboard-aware, because every one of them is one added field
 * away from needing to be.
 *
 * A dialog is `position: fixed`, centred with `top: 50%`, and `fixed` is laid
 * out against the *layout* viewport. Opening the software keyboard never
 * touches the layout viewport — both mobile Safari and Chrome shrink only the
 * *visual* viewport — so a centred dialog stays centred on a screen whose
 * bottom half the keyboard is now sitting on. Half the form ends up behind the
 * keys: on the create-custom-spot dialog that was the visibility toggle, the
 * species picker and the Create button, all of them out of reach from the
 * moment the angler tapped the name field to type. `vh` cannot save this and
 * neither can `dvh`, because the root layout pins
 * `interactiveWidget: 'resizes-visual'` (see `src/app/layout.tsx`) precisely so
 * the keyboard cannot reflow the document: both units go on reporting the full,
 * mostly-covered height.
 *
 * The only honest number comes from measuring, so while the keyboard is up the
 * panel centres itself in the band the reader can actually see and caps its
 * height to it. `overflow-y-auto` does the rest: a form too tall for the gap
 * above the keyboard becomes a form you scroll, which is the ordinary thing a
 * phone does with a long form. Both numbers are in layout-viewport
 * coordinates, the space `top` resolves in, so this holds even mid-pan.
 *
 * Nothing changes on a desktop, or on a phone with no keyboard up: `keyboard`
 * reads 0 and no inline geometry is applied at all.
 */
function DialogPanel({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const { keyboard, height, offsetTop } = useVisualViewport(true)
  const squeezed = keyboard > 0 && height > 0

  return (
    <DialogPrimitive.Content
      data-slot="dialog-content"
      data-keyboard={squeezed ? "up" : undefined}
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event)
        if (event.defaultPrevented) return
        // Radix focuses the first tabbable thing in the dialog, which on a
        // form is the first field, which on a touch device raises the
        // keyboard before the reader has read a word of what they opened.
        // Nobody on a phone types without tapping the field first, so there
        // is nothing to lose by waiting for that tap. Focus goes to the panel
        // rather than being left on the trigger behind the scrim, so the tab
        // order still starts inside the dialog and Esc still closes it.
        if (!window.matchMedia?.("(pointer: coarse)").matches) return
        event.preventDefault()
        ;(event.currentTarget as HTMLElement | null)?.focus()
      }}
      style={
        squeezed
          ? {
              top: offsetTop + height / 2,
              // A little air, so the panel does not butt up against the keys
              // and the top of the screen.
              maxHeight: Math.max(height - 32, 160),
              ...style,
            }
          : style
      }
      className={cn(
        "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-[70] grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto overscroll-contain rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
        className
      )}
      {...props}
    >
      {children}
      {/* The X, with a thumb-sized hit area around a 16px icon.

          It used to BE 16px: `size-4` on the glyph and no padding, so the
          tappable area was the glyph itself, well under the 44px every touch
          guideline asks for. On a phone that is a control you stab at twice,
          and it is the only way out of a modal that opens on its own now
          (the upgrade nag), where "I cannot get rid of this" is the worst
          thing the page can say to somebody we just paid to bring here.

          `size-11` is 44px and `-m-3.5` is 14px, which is exactly half the
          growth in each direction, so the box expands around the glyph and
          the glyph does not move: it still sits 24px in from the top and
          right of the dialog, pixel for pixel where it was. Nothing visible
          changes — the box has no background of its own, only the focus
          ring, which is why this is a rounded-md now rather than a 2px
          radius drawn around a 44px square. */}
      {showCloseButton && (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 -m-3.5 flex size-11 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

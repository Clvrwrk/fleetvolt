"use client";

import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root {...props} />;
}

export function CollapsibleTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return (
    <CollapsiblePrimitive.Trigger
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium hover:bg-accent",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180" />
    </CollapsiblePrimitive.Trigger>
  );
}

export function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      className={cn("overflow-hidden text-sm", className)}
      {...props}
    />
  );
}

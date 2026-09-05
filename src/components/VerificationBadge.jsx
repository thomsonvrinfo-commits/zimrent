import { ShieldCheck, ShieldQuestion, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function IdentityBadge({ status, className, showLabel = true }) {
  const config = {
    identity_verified: { label: "Identity verified", icon: ShieldCheck, class: "bg-success/10 text-success border-success/20" },
    phone_verified: { label: "Phone verified", icon: ShieldCheck, class: "bg-warning/10 text-warning border-warning/20" },
    identity_pending: { label: "Verification pending", icon: Clock, class: "bg-warning/10 text-warning border-warning/20" },
    verification_review: { label: "Under review", icon: Clock, class: "bg-warning/10 text-warning border-warning/20" },
    verification_failed: { label: "Verification failed", icon: ShieldQuestion, class: "bg-destructive/10 text-destructive border-destructive/20" },
    unverified: { label: "Unverified", icon: ShieldQuestion, class: "bg-muted text-muted-foreground border-border" }
  };
  const c = config[status] || config.unverified;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", c.class, className)}>
      <Icon className="w-3.5 h-3.5" />
      {showLabel && c.label}
    </span>
  );
}

export function PropertyVerificationBadge({ status, className, showLabel = true }) {
  const config = {
    verified: { label: "Property verified", icon: ShieldCheck, class: "bg-success/10 text-success border-success/20" },
    pending: { label: "Verification pending", icon: Clock, class: "bg-warning/10 text-warning border-warning/20" },
    rejected: { label: "Verification rejected", icon: ShieldQuestion, class: "bg-destructive/10 text-destructive border-destructive/20" },
    unverified: { label: "Property unverified", icon: ShieldQuestion, class: "bg-muted text-muted-foreground border-border" }
  };
  const c = config[status] || config.unverified;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", c.class, className)}>
      <Icon className="w-3.5 h-3.5" />
      {showLabel && c.label}
    </span>
  );
}
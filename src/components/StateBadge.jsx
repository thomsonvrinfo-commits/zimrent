import { ShieldCheck, ShieldAlert, Shield, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  secondary: "bg-muted text-muted-foreground border-border",
  destructive: "bg-destructive/10 text-destructive border-destructive/20"
};

export default function StateBadge({ status, label, color = "secondary", icon: Icon, className }) {
  const variantClass = VARIANTS[color] || VARIANTS.secondary;
  const DisplayIcon = Icon || (color === "success" ? ShieldCheck : color === "warning" ? Clock : color === "destructive" ? ShieldAlert : Shield);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", variantClass, className)}>
      <DisplayIcon className="w-3.5 h-3.5" />
      {label || status}
    </span>
  );
}
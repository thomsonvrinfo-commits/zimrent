import { Inbox } from "lucide-react";

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold font-heading text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground mt-3">{label}</p>
    </div>
  );
}

export default EmptyState;
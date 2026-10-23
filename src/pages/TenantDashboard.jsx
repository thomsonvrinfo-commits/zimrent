import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Heart,
  Calendar,
  MessageSquare,
  Loader2
} from "lucide-react";
import PropertyCard from "@/components/PropertyCard";
import StateBadge from "@/components/StateBadge";
import { EmptyState, LoadingState } from "@/components/EmptyState";
import { formatDateTime } from "@/lib/rental-utils";

// Viewing statuses as the API actually stores them
// (workers/api/src/routes/viewings/index.ts).
const VIEWING_STATUS = {
  requested: { label: "Awaiting owner", color: "warning" },
  confirmed: { label: "Confirmed", color: "success" },
  declined: { label: "Declined", color: "destructive" },
  cancelled: { label: "Cancelled", color: "secondary" }
};

export default function TenantDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saved, setSaved] = useState([]); // [{ property, listing, coverPhotoUrl }]
  const [viewings, setViewings] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const [savedRows, views, convos] = await Promise.all([
        zimrent.savedProperties.list().catch(() => []),
        zimrent.viewings.list().catch(() => []),
        zimrent.conversations.list().catch(() => [])
      ]);

      setViewings(
        (Array.isArray(views) ? views : []).filter(
          (v) => v.tenant_id === user.id
        )
      );
      setConversations(convos || []);

      // Resolve each saved property to its property + listing (+ cover photo).
      const propertyIds = [
        ...new Set((savedRows || []).map((s) => s.property_id).filter(Boolean))
      ];

      const resolved = await Promise.all(
        propertyIds.map(async (id) => {
          try {
            const { property, listing } = await zimrent.properties.get(id);
            if (!property || !listing) return null;

            let coverPhotoUrl = null;
            try {
              const media = await zimrent.properties.media(id);
              if (media?.[0]) {
                coverPhotoUrl = zimrent.properties.photoUrl(id, media[0].id);
              }
            } catch {
              coverPhotoUrl = null;
            }

            return { property, listing, coverPhotoUrl };
          } catch {
            return null;
          }
        })
      );

      setSaved(resolved.filter(Boolean));
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message || "Unable to load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const unsave = async (propertyId) => {
    try {
      await zimrent.savedProperties.unsave(propertyId);
      setSaved((prev) => prev.filter((s) => s.property.id !== propertyId));
    } catch (e) {
      alert(e.message || "Unable to remove this property.");
    }
  };

  const cancelViewing = async (id) => {
    setBusyId(id);
    try {
      await zimrent.viewings.cancel(id);
      await load();
    } catch (e) {
      alert(e.message || "Unable to cancel this viewing.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingState label="Loading your dashboard..." />;

  const upcomingViewings = viewings.filter(
    (v) => v.status === "requested" || v.status === "confirmed"
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold font-heading mb-1">My Dashboard</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Your saved homes, viewings and messages in one place.
      </p>

      {loadError && (
        <Card className="border-destructive/30 mb-5">
          <CardContent className="p-4 text-sm text-destructive">
            {loadError}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatusCard
          icon={Heart}
          label="Saved properties"
          value={saved.length}
          link="/tenant-dashboard?tab=saved"
          color={saved.length > 0 ? "primary" : "secondary"}
        />
        <StatusCard
          icon={Calendar}
          label="Upcoming viewings"
          value={upcomingViewings.length}
          link="/tenant-dashboard?tab=viewings"
          color={upcomingViewings.length > 0 ? "warning" : "secondary"}
        />
        <StatusCard
          icon={MessageSquare}
          label="Conversations"
          value={conversations.length}
          link="/messages"
          color="secondary"
        />
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
          <TabsTrigger value="viewings">Viewings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Section title="Upcoming viewings">
            {upcomingViewings.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No upcoming viewings"
                description="Request a viewing from any property page."
                action={
                  <Button asChild>
                    <Link to="/">Find properties</Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                {upcomingViewings.slice(0, 3).map((v) => (
                  <ViewingRow
                    key={v.id}
                    viewing={v}
                    busy={busyId === v.id}
                    onCancel={() => cancelViewing(v.id)}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Recent messages">
            {conversations.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No messages yet"
                description="Start a conversation from any property page."
              />
            ) : (
              <div className="space-y-2">
                {conversations.slice(0, 3).map((c) => (
                  <Link
                    key={c.id}
                    to={`/messages/${c.id}`}
                    className="block p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors"
                  >
                    <p className="font-medium text-sm">
                      {c.property_title || "Conversation"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {c.last_message_preview || "No messages yet"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Card className="border-border bg-muted/40">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Applications, reservations and rent payments are coming soon.
              For now you can save homes, message owners and request viewings.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saved">
          {saved.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="No saved properties"
              description="Save properties you're interested in to find them quickly later."
              action={
                <Button asChild>
                  <Link to="/">Browse properties</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {saved.map(({ property, listing, coverPhotoUrl }) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  listing={listing}
                  coverPhotoUrl={coverPhotoUrl}
                  saved={true}
                  onToggleSave={() => unsave(property.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="viewings">
          {viewings.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No viewing requests"
              description="Request a viewing from any property page."
              action={
                <Button asChild>
                  <Link to="/">Find properties</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {viewings.map((v) => (
                <ViewingRow
                  key={v.id}
                  viewing={v}
                  busy={busyId === v.id}
                  onCancel={() => cancelViewing(v.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ViewingRow({ viewing, busy, onCancel }) {
  const info = VIEWING_STATUS[viewing.status];
  const cancellable =
    viewing.status === "requested" || viewing.status === "confirmed";

  return (
    <Card className="border-border">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">
            {viewing.property_title || "Property"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDateTime(viewing.scheduled_at)}
          </p>
          {viewing.notes && (
            <p className="text-xs text-muted-foreground mt-1 italic whitespace-pre-wrap">
              "{viewing.notes}"
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StateBadge
            status={viewing.status}
            label={info?.label || viewing.status}
            color={info?.color || "secondary"}
          />
          {cancellable && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onCancel}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cancel"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusCard({ icon: Icon, label, value, link, color }) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
    secondary: "bg-muted text-muted-foreground"
  };

  return (
    <Link to={link} className="block">
      <Card className="border-border hover:border-primary/30 transition-colors">
        <CardContent className="p-4 flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading leading-none">
              {value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="font-semibold font-heading mb-3">{title}</h2>
      {children}
    </div>
  );
}

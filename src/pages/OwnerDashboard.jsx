import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  Calendar,
  MessageSquare,
  Plus,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";
import StateBadge from "@/components/StateBadge";
import { EmptyState, LoadingState } from "@/components/EmptyState";
import { LISTING_STATUS, formatDateTime } from "@/lib/rental-utils";

// Viewing statuses as the API actually stores them
// (workers/api/src/routes/viewings/index.ts).
const VIEWING_STATUS = {
  requested: { label: "Requested", color: "warning" },
  confirmed: { label: "Confirmed", color: "success" },
  declined: { label: "Declined", color: "destructive" },
  cancelled: { label: "Cancelled", color: "secondary" }
};

const AUTHORITY_LABEL = {
  none: "Authority not submitted",
  pending: "Authority pending review",
  approved: "Authority approved",
  rejected: "Authority rejected",
  revoked: "Authority revoked"
};

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [properties, setProperties] = useState([]);
  const [viewings, setViewings] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [tenantNames, setTenantNames] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const [props, views, convos] = await Promise.all([
        zimrent.properties.mine().catch(() => []),
        zimrent.viewings.list().catch(() => []),
        zimrent.conversations.list().catch(() => [])
      ]);

      const mineViewings = (Array.isArray(views) ? views : []).filter(
        (v) => v.landlord_id === user.id
      );

      setProperties(props || []);
      setViewings(mineViewings);
      setConversations(convos || []);
      setLoadError(null);

      // Show tenant names on viewing requests (public profile only).
      const tenantIds = [
        ...new Set(mineViewings.map((v) => v.tenant_id).filter(Boolean))
      ];
      const entries = await Promise.all(
        tenantIds.map(async (id) => {
          try {
            const p = await zimrent.profiles.getPublic(id);
            return [id, p?.data?.display_name || null];
          } catch {
            return [id, null];
          }
        })
      );
      setTenantNames(Object.fromEntries(entries));
    } catch (e) {
      setLoadError(e.message || "Unable to load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id, fn, fallback) => {
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch (e) {
      alert(e.message || fallback);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingState label="Loading your dashboard..." />;

  const pendingViewings = viewings.filter((v) => v.status === "requested");
  const upcomingViewings = viewings.filter((v) => v.status === "confirmed");
  const activeListings = properties.filter(
    (p) => p.listing_status === "active"
  );
  const needsListing = properties.filter(
    (p) => p.my_authority_status === "approved" && !p.listing_id
  );
  const needsAuthority = properties.filter(
    (p) =>
      !p.my_authority_status ||
      ["rejected", "revoked"].includes(p.my_authority_status)
  );

  const tenantName = (v) => tenantNames[v.tenant_id] || "A tenant";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            Owner Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your properties, viewing requests and enquiries.
          </p>
        </div>

        <Button asChild>
          <Link to="/add-property">
            <Plus className="w-4 h-4 mr-2" /> Add property
          </Link>
        </Button>
      </div>

      {loadError && (
        <Card className="border-destructive/30 mb-5">
          <CardContent className="p-4 text-sm text-destructive">
            {loadError}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Building2}
          label="Properties"
          value={properties.length}
          link="/my-properties"
        />
        <StatCard
          icon={CheckCircle2}
          label="Live listings"
          value={activeListings.length}
          link="/my-properties"
          color={activeListings.length > 0 ? "success" : "secondary"}
        />
        <StatCard
          icon={Calendar}
          label="Viewing requests"
          value={pendingViewings.length}
          color={pendingViewings.length > 0 ? "warning" : "secondary"}
        />
        <StatCard
          icon={MessageSquare}
          label="Conversations"
          value={conversations.length}
          link="/messages"
        />
      </div>

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="Add your first property to start receiving enquiries."
          action={
            <Button asChild>
              <Link to="/add-property">
                <Plus className="w-4 h-4 mr-2" /> Add your first property
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Next steps for the owner */}
          {(needsListing.length > 0 || needsAuthority.length > 0) && (
            <Section title="Next steps">
              <div className="space-y-2">
                {needsListing.map((p) => (
                  <Card key={p.id} className="border-success/30 bg-success/5">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <p className="text-sm">
                        <span className="font-medium">{p.title}</span> — authority
                        approved. Create a listing to send it for review.
                      </p>
                      <Button size="sm" asChild>
                        <Link to="/my-properties">Create listing</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {needsAuthority.map((p) => (
                  <Card key={p.id} className="border-warning/30 bg-warning/5">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <p className="text-sm">
                        <span className="font-medium">{p.title}</span> —{" "}
                        {p.my_authority_status
                          ? "your authority evidence needs resubmitting."
                          : "submit evidence that you have the right to list it."}
                      </p>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/add-property?authority_for=${p.id}`}>
                          Submit evidence
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {/* Viewing requests */}
          {pendingViewings.length > 0 && (
            <Section title="Viewing requests to review">
              <div className="space-y-2">
                {pendingViewings.map((v) => (
                  <Card key={v.id} className="border-border">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {v.property_title || "Property"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tenantName(v)} · {formatDateTime(v.scheduled_at)}
                        </p>
                        {v.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic whitespace-pre-wrap">
                            "{v.notes}"
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === v.id}
                          onClick={() =>
                            act(
                              v.id,
                              () => zimrent.viewings.decline(v.id),
                              "Unable to decline this viewing."
                            )
                          }
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" /> Decline
                        </Button>

                        <Button
                          size="sm"
                          disabled={busyId === v.id}
                          onClick={() =>
                            act(
                              v.id,
                              () => zimrent.viewings.accept(v.id),
                              "Unable to accept this viewing."
                            )
                          }
                        >
                          {busyId === v.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Accept
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {/* Confirmed viewings */}
          {upcomingViewings.length > 0 && (
            <Section title="Upcoming viewings">
              <div className="space-y-2">
                {upcomingViewings.map((v) => (
                  <Card key={v.id} className="border-border">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {v.property_title || "Property"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tenantName(v)} · {formatDateTime(v.scheduled_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <StateBadge
                          status={v.status}
                          label={VIEWING_STATUS[v.status]?.label}
                          color={VIEWING_STATUS[v.status]?.color}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === v.id}
                          onClick={() =>
                            act(
                              v.id,
                              () => zimrent.viewings.cancel(v.id),
                              "Unable to cancel this viewing."
                            )
                          }
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {/* Properties overview */}
          <Section title="Your properties">
            <div className="space-y-2">
              {properties.map((p) => {
                const listingInfo = p.listing_id
                  ? LISTING_STATUS[p.listing_status]
                  : null;
                return (
                  <Card key={p.id} className="border-border">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {p.title || "Untitled property"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.suburb ? `${p.suburb}, ` : ""}
                          {p.city} ·{" "}
                          {AUTHORITY_LABEL[p.my_authority_status || "none"] ||
                            AUTHORITY_LABEL.none}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {p.listing_status === "active" && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/property/${p.id}`}>View</Link>
                          </Button>
                        )}
                        {listingInfo ? (
                          <StateBadge
                            status={p.listing_status}
                            label={listingInfo.label}
                            color={listingInfo.color}
                          />
                        ) : (
                          <StateBadge
                            status="no_listing"
                            label="No listing yet"
                            color="secondary"
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/my-properties">Manage properties</Link>
              </Button>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, link, color = "primary" }) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
    secondary: "bg-muted text-muted-foreground"
  };

  const card = (
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
  );

  return link ? <Link to={link}>{card}</Link> : card;
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="font-semibold font-heading mb-3">{title}</h2>
      {children}
    </div>
  );
}

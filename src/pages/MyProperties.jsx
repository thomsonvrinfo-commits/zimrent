import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import { Plus, Building2, Eye, EyeOff, Send } from "lucide-react";
import StateBadge from "@/components/StateBadge";
import { EmptyState, LoadingState } from "@/components/EmptyState";
import { LISTING_STATUS, formatCurrency, PROPERTY_TYPES } from "@/lib/rental-utils";

// REWRITTEN FROM THE OLD VERSION.
//
// GET /properties/mine already returns each property joined with its
// listing's status and the owner's own authority status in one call — no
// more N+1 Property.filter() + per-property Listing.filter().
//
// IMPORTANT: the backend only ever lets an owner set a listing's status to
// draft, pending_verification, or inactive (PATCH /listings/:id rejects
// "active" with a 403 — see manage.ts on the Worker). There is currently NO
// way for an owner to self-activate a listing; activation requires an admin
// action once both property verification and authority are approved, and as
// of this audit that admin action doesn't exist yet either (Phase 2 work).
// The old "Activate" button here always would have failed with a 403 — it's
// been replaced with accurate status messaging instead of a button that
// can't work.
export default function MyProperties() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const props = await zimrent.properties.mine();
      setProperties(props || []);
    } catch (e) {
      setError(e.message || "Failed to load your properties");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) load(); }, [user]);

  const setListingStatus = async (property, status) => {
    if (!property.listing_id) return;
    setBusyId(property.id);
    setError("");
    try {
      await zimrent.listings.update(property.listing_id, { status });
      await load();
    } catch (e) {
      setError(e.message || "Failed to update listing");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingState label="Loading your properties..." />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">My Properties</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your property listings</p>
        </div>
        <Button onClick={() => navigate("/add-property")}><Plus className="w-4 h-4 mr-2" /> Add property</Button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="Add your first property to start receiving tenant enquiries."
          action={<Button onClick={() => navigate("/add-property")}><Plus className="w-4 h-4 mr-2" /> Add your first property</Button>}
        />
      ) : (
        <div className="space-y-4">
          {properties.map(p => {
            const status = p.listing_status || "draft";
            const statusInfo = LISTING_STATUS[status] || LISTING_STATUS.draft;
            const busy = busyId === p.id;
            return (
              <Card key={p.id} className="border-border overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-40 aspect-video sm:aspect-auto bg-muted flex-shrink-0">
                    <Image src="https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400" alt={p.title} className="w-full h-full" fittingType="fill" />
                  </div>
                  <CardContent className="p-4 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link to={`/property/${p.id}`} className="font-semibold font-heading hover:text-primary">{p.title}</Link>
                        <p className="text-sm text-muted-foreground">{p.suburb}, {p.city} · {PROPERTY_TYPES[p.property_type]}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-sm font-medium">{formatCurrency(p.monthly_rent, p.currency)}/mo</span>
                        </div>
                      </div>
                      <StateBadge status={status} label={statusInfo?.label || status} color={statusInfo?.color} />
                    </div>

                    {status === "pending_verification" && (
                      <p className="text-xs text-muted-foreground mt-2">Awaiting admin approval — this appears on the marketplace once approved.</p>
                    )}
                    {p.my_authority_status && p.my_authority_status !== "verified" && (
                      <p className="text-xs text-warning mt-1">Authority to list: {p.my_authority_status}</p>
                    )}

                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/property/${p.id}`}><Eye className="w-3.5 h-3.5 mr-1.5" /> View</Link>
                      </Button>
                      {status === "draft" && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setListingStatus(p, "pending_verification")}>
                          <Send className="w-3.5 h-3.5 mr-1.5" /> Submit for review
                        </Button>
                      )}
                      {status === "inactive" && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setListingStatus(p, "pending_verification")}>
                          <Send className="w-3.5 h-3.5 mr-1.5" /> Resubmit for review
                        </Button>
                      )}
                      {(status === "active" || status === "pending_verification") && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setListingStatus(p, "inactive")}>
                          <EyeOff className="w-3.5 h-3.5 mr-1.5" /> Deactivate
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Building2,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2
} from "lucide-react";
import StateBadge from "@/components/StateBadge";
import {
  EmptyState,
  LoadingState
} from "@/components/EmptyState";
import {
  LISTING_STATUS,
  formatCurrency,
  formatDate,
  PROPERTY_TYPES
} from "@/lib/rental-utils";

// Property AUTHORITY (may this user manage this property?) and LISTING
// status (is it live in Discover?) are separate concepts, shown separately.
const AUTHORITY_STATUS = {
  none: { label: "Authority not submitted", color: "secondary" },
  pending: { label: "Authority pending review", color: "warning" },
  approved: { label: "Authority approved", color: "success" },
  rejected: { label: "Authority rejected", color: "destructive" },
  revoked: { label: "Authority revoked", color: "destructive" }
};

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
  const [searchParams] = useSearchParams();

  const justSubmitted =
    searchParams.get("submitted") === "1" ||
    searchParams.get("published") === "1";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [properties, setProperties] = useState([]);
  const [actionId, setActionId] = useState(null);

  const loadProperties = useCallback(async () => {
    if (!user) return;

    try {
      // Every property the user owns / holds authority for — with or
      // without a listing. (listings.mine() alone hides any property that
      // has no listing yet, which is exactly the state an owner is in after
      // authority approval.)
      const rows = await zimrent.properties.mine();
      setProperties(rows || []);
      setLoadError(null);
    } catch (e) {
      setProperties([]);
      setLoadError(e.message || "Unable to load your properties.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const run = async (id, fn, fallbackMessage) => {
    setActionId(id);
    try {
      await fn();
      await loadProperties();
    } catch (e) {
      alert(e.message || fallbackMessage);
    } finally {
      setActionId(null);
    }
  };

  // Authority approved + no listing yet -> create the listing for THIS
  // existing property. It starts as pending_verification; an admin review
  // is what activates it.
  const createListing = (property) =>
    run(
      property.id,
      () => zimrent.listings.create({ property_id: property.id }),
      "Unable to create listing."
    );

  // Owners may only move a listing to inactive / pending_verification
  // (the API rejects anything else). Activation is admin-only.
  const setListingStatus = (property, status) =>
    run(
      property.id,
      () => zimrent.listings.update(property.listing_id, { status }),
      "Unable to update listing."
    );

  if (loading) {
    return (
      <LoadingState label="Loading your properties..." />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            My Properties
          </h1>

          <p className="text-muted-foreground text-sm mt-1">
            Manage your properties and listings
          </p>
        </div>

        <Button onClick={() => navigate("/add-property")}>
          <Plus className="w-4 h-4 mr-2" />
          Add property
        </Button>
      </div>

      {justSubmitted && (
        <Card className="border-warning/30 bg-warning/5 mb-5">
          <CardContent className="p-4 text-sm text-warning">
            Property submitted. Your authority evidence is now pending
            review — you'll be able to create a listing once it's
            approved.
          </CardContent>
        </Card>
      )}

      {loadError && (
        <Card className="border-destructive/30 mb-5">
          <CardContent className="p-4 text-sm text-destructive">
            {loadError}
          </CardContent>
        </Card>
      )}

      {properties.length === 0 && !loadError ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="Add your first property to start receiving tenant enquiries."
          action={
            <Button onClick={() => navigate("/add-property")}>
              <Plus className="w-4 h-4 mr-2" />
              Add your first property
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {properties.map((property) => {
            const authorityKey =
              property.my_authority_status || "none";
            const authorityInfo =
              AUTHORITY_STATUS[authorityKey] ||
              AUTHORITY_STATUS.none;

            const hasListing = Boolean(property.listing_id);
            const listingStatus = property.listing_status;
            const listingInfo = hasListing
              ? LISTING_STATUS[listingStatus] || {
                  label: listingStatus,
                  color: "secondary"
                }
              : null;

            const authorityApproved = authorityKey === "approved";
            const busy = actionId === property.id;

            return (
              <Card
                key={property.id}
                className="border-border overflow-hidden"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/property/${property.id}`}
                        className="font-semibold font-heading hover:text-primary break-words"
                      >
                        {property.title || "Untitled property"}
                      </Link>

                      <p className="text-sm text-muted-foreground">
                        {property.suburb
                          ? `${property.suburb}, `
                          : ""}
                        {property.city}
                        {property.property_type
                          ? ` · ${
                              PROPERTY_TYPES[
                                property.property_type
                              ] || property.property_type
                            }`
                          : ""}
                      </p>

                      <p className="text-sm font-medium mt-2">
                        {formatCurrency(
                          property.monthly_rent,
                          property.currency
                        )}
                        /mo
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StateBadge
                        status={authorityKey}
                        label={authorityInfo.label}
                        color={authorityInfo.color}
                      />

                      {listingInfo ? (
                        <StateBadge
                          status={listingStatus}
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
                  </div>

                  {/* Next step for the owner */}
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {property.listing_status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <Link to={`/property/${property.id}`}>
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          View
                        </Link>
                      </Button>
                    )}

                    {/* Authority approved, nothing listed yet */}
                    {authorityApproved && !hasListing && (
                      <Button
                        size="sm"
                        onClick={() => createListing(property)}
                        disabled={busy}
                      >
                        {busy ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Create listing
                      </Button>
                    )}

                    {/* Listing live: owner can pause it */}
                    {hasListing && listingStatus === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setListingStatus(property, "inactive")
                        }
                        disabled={busy}
                      >
                        {busy ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Pause listing
                      </Button>
                    )}

                    {/* Paused / rejected / draft: send back for review */}
                    {hasListing &&
                      authorityApproved &&
                      ["inactive", "rejected", "draft"].includes(
                        listingStatus
                      ) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setListingStatus(
                              property,
                              "pending_verification"
                            )
                          }
                          disabled={busy}
                        >
                          {busy ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Submit for review
                        </Button>
                      )}
                  </div>

                  {/* Plain-language explanation of where this property is */}
                  <p className="text-xs text-muted-foreground mt-3">
                    {authorityKey === "none" &&
                      "Submit evidence that you have the right to list this property."}
                    {authorityKey === "pending" &&
                      "Our team is reviewing your authority evidence. You can create a listing once it is approved."}
                    {authorityKey === "rejected" &&
                      "Your authority evidence was not accepted, so this property can't be listed."}
                    {authorityKey === "revoked" &&
                      "Your authority over this property was revoked, so it can't be listed."}
                    {authorityApproved &&
                      !hasListing &&
                      "Authority approved. Create a listing to send it for review."}
                    {authorityApproved &&
                      listingStatus === "pending_verification" &&
                      "Listing submitted — waiting for admin review before it appears in Discover."}
                    {authorityApproved &&
                      listingStatus === "active" &&
                      "Your listing is live in Discover."}
                    {authorityApproved &&
                      listingStatus === "rejected" &&
                      "Your listing was not approved. You can submit it for review again."}
                    {authorityApproved &&
                      listingStatus === "inactive" &&
                      "Your listing is paused and hidden from Discover."}
                  </p>

                  {property.availability_confirmed_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last confirmed:{" "}
                      {formatDate(property.availability_confirmed_at)}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import {
  Plus,
  Building2,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2,
  Megaphone
} from "lucide-react";
import StateBadge from "@/components/StateBadge";
import { PropertyVerificationBadge } from "@/components/VerificationBadge";
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

// Property authority is a separate concept from listing status (see the
// Master Brief §5/§8) — a property can exist, and be seen here, long
// before it has a listing at all. This local map is only for the badge
// shown on this page; it deliberately doesn't touch the shared
// LISTING_STATUS map in rental-utils.js.
const AUTHORITY_STATUS = {
  not_submitted: {
    label: "Authority not submitted",
    color: "secondary"
  },
  pending: {
    label: "Authority pending review",
    color: "warning"
  },
  approved: {
    label: "Authority approved",
    color: "success"
  },
  rejected: {
    label: "Authority rejected",
    color: "destructive"
  },
  revoked: {
    label: "Authority revoked",
    color: "destructive"
  }
};

export default function MyProperties() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [actionId, setActionId] = useState(null);
  const [creatingListingId, setCreatingListingId] = useState(null);

  const authorityPending = searchParams.get("authority_pending") === "1";

  const loadProperties = async () => {
    if (!user) return;

    setLoading(true);

    try {
      // properties.mine() (GET /properties/mine) returns every property
      // the user owns regardless of listing status, plus their own
      // property_authority status per property — unlike listings.mine()
      // (GET /listings), which only returns properties that already have
      // a listing and would hide anything still awaiting authority
      // approval.
      const results = await zimrent.properties.mine();

      setProperties(
        results.filter((item) => item.property)
      );
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, [user]);

  const toggleListingStatus = async (listing) => {
    const currentStatus = listing.data?.status;
    const newStatus =
      currentStatus === "active"
        ? "inactive"
        : "active";

    setActionId(listing.id);

    try {
      const updated = await zimrent.listings.update(
        listing.id,
        { status: newStatus }
      );

      setProperties((current) =>
        current.map((item) =>
          item.listing?.id === listing.id
            ? {
                ...item,
                listing: updated
              }
            : item
        )
      );
    } catch (e) {
      alert(
        e.message ||
          "Unable to update listing status."
      );
    } finally {
      setActionId(null);
    }
  };

  const confirmAvailability = async (listing) => {
    setActionId(listing.id);

    try {
      const updated = await zimrent.listings.update(
        listing.id,
        { status: "active" }
      );

      setProperties((current) =>
        current.map((item) =>
          item.listing?.id === listing.id
            ? {
                ...item,
                listing: updated
              }
            : item
        )
      );
    } catch (e) {
      alert(
        e.message ||
          "Unable to confirm availability."
      );
    } finally {
      setActionId(null);
    }
  };

  // Only reachable once authority is approved and no listing exists yet
  // (see the button's render guard below) — the backend still enforces
  // hasApprovedAuthority() independently, so this is a UI convenience,
  // not the source of truth.
  const createListing = async (property) => {
    setCreatingListingId(property.id);

    try {
      await zimrent.listings.create({
        property_id: property.id
      });

      await loadProperties();
    } catch (e) {
      alert(
        e.message ||
          "Unable to create listing. Please try again."
      );
    } finally {
      setCreatingListingId(null);
    }
  };

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
            Manage your property listings
          </p>
        </div>

        <Button
          onClick={() =>
            navigate("/add-property")
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          Add property
        </Button>
      </div>

      {authorityPending && (
        <div className="mb-6 p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm text-warning">
          Property submitted. Your authority evidence is now
          pending review — you'll be able to create a listing
          once it's approved.
        </div>
      )}

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="Add your first property to start receiving tenant enquiries."
          action={
            <Button
              onClick={() =>
                navigate("/add-property")
              }
            >
              <Plus className="w-4 h-4 mr-2" />
              Add your first property
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {properties.map(
            ({ property, listing, authorityStatus }) => {
              const propertyData =
                property.data || {};

              const listingData =
                listing?.data || {};

              const statusInfo =
                listing
                  ? LISTING_STATUS[
                      listingData.status
                    ]
                  : null;

              const authorityInfo =
                AUTHORITY_STATUS[authorityStatus] ||
                AUTHORITY_STATUS.not_submitted;

              const busy =
                actionId === listing?.id;

              const creatingListing =
                creatingListingId === property.id;

              const canCreateListing =
                authorityStatus === "approved" &&
                !listing;

              return (
                <Card
                  key={
                    property.id
                  }
                  className="border-border overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row">
                    <div className="sm:w-40 aspect-video sm:aspect-auto bg-muted flex-shrink-0">
                      <Image
                        src={
                          propertyData
                            .photos?.[0] ||
                          "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400"
                        }
                        alt={
                          propertyData.title ||
                          "Property"
                        }
                        className="w-full h-full"
                        fittingType="fill"
                      />
                    </div>

                    <CardContent className="p-4 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            to={`/property/${property.id}`}
                            className="font-semibold font-heading hover:text-primary"
                          >
                            {propertyData.title}
                          </Link>

                          <p className="text-sm text-muted-foreground">
                            {propertyData.suburb
                              ? `${propertyData.suburb}, `
                              : ""}
                            {propertyData.city}
                            {propertyData.property_type
                              ? ` · ${
                                  PROPERTY_TYPES[
                                    propertyData
                                      .property_type
                                  ] ||
                                  propertyData.property_type
                                }`
                              : ""}
                          </p>

                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-sm font-medium">
                              {formatCurrency(
                                propertyData.monthly_rent,
                                propertyData.currency
                              )}
                              /mo
                            </span>

                            <PropertyVerificationBadge
                              status={
                                propertyData.verification_status
                              }
                              showLabel={false}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          <StateBadge
                            status={authorityStatus}
                            label={authorityInfo.label}
                            color={authorityInfo.color}
                          />

                          {statusInfo && (
                            <StateBadge
                              status={
                                listingData.status
                              }
                              label={
                                statusInfo.label
                              }
                              color={
                                statusInfo.color
                              }
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <Link
                            to={`/property/${property.id}`}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            View
                          </Link>
                        </Button>

                        {canCreateListing && (
                          <Button
                            size="sm"
                            onClick={() =>
                              createListing(
                                property
                              )
                            }
                            disabled={creatingListing}
                          >
                            {creatingListing ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Megaphone className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Create listing
                          </Button>
                        )}

                        {listing &&
                          listingData.status ===
                            "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                confirmAvailability(
                                  listing
                                )
                              }
                              disabled={busy}
                            >
                              {busy ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                              )}

                              Confirm availability
                            </Button>
                          )}

                        {listing && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              toggleListingStatus(
                                listing
                              )
                            }
                            disabled={busy}
                          >
                            {busy ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : listingData.status ===
                              "active" ? (
                              <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 mr-1.5" />
                            )}

                            {listingData.status ===
                            "active"
                              ? "Deactivate"
                              : "Activate"}
                          </Button>
                        )}
                      </div>

                      {listingData.availability_confirmed_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last confirmed:{" "}
                          {formatDate(
                            listingData.availability_confirmed_at
                          )}
                        </p>
                      )}
                    </CardContent>
                  </div>
                </Card>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}

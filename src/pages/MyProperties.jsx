import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Loader2
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

export default function MyProperties() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [actionId, setActionId] = useState(null);

  const loadProperties = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const ownListings = await zimrent.listings.mine();

      const results = await Promise.all(
        (ownListings || []).map(async (listing) => {
          try {
            const result = await zimrent.properties.get(
              listing.data?.property_id
            );

            return {
              property: result?.property || null,
              listing
            };
          } catch {
            return {
              property: null,
              listing
            };
          }
        })
      );

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
          item.listing.id === listing.id
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
          item.listing.id === listing.id
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
            ({ property, listing }) => {
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

              const busy =
                actionId === listing?.id;

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
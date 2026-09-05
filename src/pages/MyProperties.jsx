import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import { Plus, Building2, RefreshCw, Eye, EyeOff } from "lucide-react";
import StateBadge from "@/components/StateBadge";
import { PropertyVerificationBadge } from "@/components/VerificationBadge";
import { EmptyState, LoadingState } from "@/components/EmptyState";
import { LISTING_STATUS, formatCurrency, formatDate, PROPERTY_TYPES } from "@/lib/rental-utils";

export default function MyProperties() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [listings, setListings] = useState({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const props = await zimrent.entities.Property.filter({ created_by_id: user.id }, "-created_date", 50);
        setProperties(props || []);
        const listingPromises = (props || []).map(p => zimrent.entities.Listing.filter({ property_id: p.id }, "-created_date", 5).catch(() => []));
        const listingResults = await Promise.all(listingPromises);
        const map = {};
        (props || []).forEach((p, i) => { map[p.id] = (listingResults[i] || [])[0]; });
        setListings(map);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [user]);

  const toggleListingStatus = async (listing, propertyId) => {
    const newStatus = listing.data?.status === "active" ? "inactive" : "active";
    try {
      const result = await zimrent.functions.invoke("transitionListing", { listing_id: listing.id, new_status: newStatus });
      if (result.data?.error) throw new Error(result.data.error);
      const updated = await zimrent.entities.Listing.filter({ property_id: propertyId }, "-created_date", 5);
      setListings(prev => ({ ...prev, [propertyId]: (updated || [])[0] }));
    } catch (e) { alert(e.message); }
  };

  const confirmAvailability = async (listing, propertyId) => {
    try {
      const result = await zimrent.functions.invoke("transitionListing", { listing_id: listing.id, new_status: "active" });
      if (result.data?.error) {
        // Already active, just update the confirmed date
        await zimrent.entities.Listing.update(listing.id, { availability_confirmed_at: new Date().toISOString() });
      }
      const updated = await zimrent.entities.Listing.filter({ property_id: propertyId }, "-created_date", 5);
      setListings(prev => ({ ...prev, [propertyId]: (updated || [])[0] }));
    } catch (e) { alert(e.message); }
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
            const listing = listings[p.id];
            const statusInfo = listing ? LISTING_STATUS[listing.data?.status] : null;
            return (
              <Card key={p.id} className="border-border overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-40 aspect-video sm:aspect-auto bg-muted flex-shrink-0">
                    <Image src={p.data?.photos?.[0] || "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400"} alt={p.data?.title} className="w-full h-full" fittingType="fill" />
                  </div>
                  <CardContent className="p-4 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link to={`/property/${p.id}`} className="font-semibold font-heading hover:text-primary">{p.data?.title}</Link>
                        <p className="text-sm text-muted-foreground">{p.data?.suburb}, {p.data?.city} · {PROPERTY_TYPES[p.data?.property_type]}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {listing && <span className="text-sm font-medium">{formatCurrency(listing.data?.monthly_rent, listing.data?.currency)}/mo</span>}
                          <PropertyVerificationBadge status={p.data?.verification_status} showLabel={false} />
                        </div>
                      </div>
                      {statusInfo && <StateBadge status={listing.data?.status} label={statusInfo.label} color={statusInfo.color} />}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/property/${p.id}`}><Eye className="w-3.5 h-3.5 mr-1.5" /> View</Link>
                      </Button>
                      {listing && listing.data?.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => confirmAvailability(listing, p.id)}>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Confirm availability
                        </Button>
                      )}
                      {listing && (
                        <Button size="sm" variant="outline" onClick={() => toggleListingStatus(listing, p.id)}>
                          {listing.data?.status === "active" ? <><EyeOff className="w-3.5 h-3.5 mr-1.5" /> Deactivate</> : <><Eye className="w-3.5 h-3.5 mr-1.5" /> Activate</>}
                        </Button>
                      )}
                    </div>
                    {listing && listing.data?.availability_confirmed_at && (
                      <p className="text-xs text-muted-foreground mt-2">Last confirmed: {formatDate(listing.data.availability_confirmed_at)}</p>
                    )}
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
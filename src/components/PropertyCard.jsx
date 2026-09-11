import { Link } from "react-router-dom";
import { Bed, Bath, Car, MapPin, Heart } from "lucide-react";
import { Image } from "@/components/ui/image";
import { PropertyVerificationBadge, IdentityBadge } from "@/components/VerificationBadge";
import StateBadge from "@/components/StateBadge";
import { PROPERTY_TYPES, LISTING_STATUS, formatCurrency, isStaleAvailability } from "@/lib/rental-utils";

export default function PropertyCard({ property, listing, ownerProfile, saved, onToggleSave }) {
  if (!property || !listing) return null;
  const statusInfo = LISTING_STATUS[listing.data?.status] || LISTING_STATUS.inactive;
  const photos = property.data?.photos || [];
  const photoUrl = photos[0] || "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800";
  const isAvailable = listing.data?.status === "active";
  const stale = isStaleAvailability(listing.data?.availability_confirmed_at);

  return (
    <div className="group rounded-2xl overflow-hidden bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300">
      <Link to={`/property/${property.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <Image
            src={photoUrl}
            alt={property.data?.title}
            className="w-full h-full"
            fittingType="fill"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            <StateBadge status={listing.data?.status} label={statusInfo.label} color={statusInfo.color} />
            {property.data?.verification_status === "verified" && (
              <PropertyVerificationBadge status="verified" className="bg-white/90 backdrop-blur" />
            )}
          </div>
          {onToggleSave && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(); }}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white transition-colors"
            >
              <Heart className={`w-4.5 h-4.5 ${saved ? "fill-destructive text-destructive" : "text-foreground"}`} style={{ width: 18, height: 18 }} />
            </button>
          )}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="text-white">
              <p className="text-xl font-bold font-heading">{formatCurrency(listing.data?.monthly_rent, listing.data?.currency)}<span className="text-sm font-normal opacity-90">/month</span></p>
            </div>
          </div>
        </div>
      </Link>
      <div className="p-4">
        <Link to={`/property/${property.id}`}>
          <h3 className="font-semibold font-heading text-foreground line-clamp-1 hover:text-primary transition-colors">{property.data?.title}</h3>
        </Link>
        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <MapPin className="w-3.5 h-3.5" />
          {property.data?.suburb}, {property.data?.city}
        </p>
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Bed className="w-4 h-4" /> {property.data?.bedrooms} bed</span>
          <span className="flex items-center gap-1.5"><Bath className="w-4 h-4" /> {property.data?.bathrooms} bath</span>
          {property.data?.parking_spaces > 0 && (
            <span className="flex items-center gap-1.5"><Car className="w-4 h-4" /> {property.data.parking_spaces}</span>
          )}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">{PROPERTY_TYPES[property.data?.property_type]}</span>
          {ownerProfile && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{ownerProfile.data?.display_name?.split(" ")[0]}</span>
              <IdentityBadge status={ownerProfile.data?.identity_status} showLabel={false} />
            </div>
          )}
        </div>
        {!isAvailable && (
          <p className="text-xs text-muted-foreground mt-2">Currently {statusInfo.label.toLowerCase()}</p>
        )}
        {isAvailable && stale && (
          <p className="text-xs text-warning mt-2">Availability not recently confirmed</p>
        )}
      </div>
    </div>
  );
}
import { useState, useEffect, useMemo } from "react";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Search, MapPin, SlidersHorizontal, X, Building2, ShieldCheck } from "lucide-react";
import PropertyCard from "@/components/PropertyCard";
import EmptyState, { LoadingState } from "@/components/EmptyState";
import { PROPERTY_TYPES } from "@/lib/rental-utils";

const CITIES = ["Harare", "Bulawayo", "Chitungwiza", "Mutare", "Gweru", "Kwekwe", "Kadoma", "Masvingo"];

// CHANGED FROM THE OLD VERSION: the old code fetched entities.Listing.filter()
// (a route that never existed) and re-implemented filtering client-side over
// fields — water_source, backup_power — that don't exist in the real
// database at all. GET /properties already does server-side filtering
// (city, suburb, property_type, min_rent, max_rent, bedrooms, pets_allowed,
// furnished, gated) and only ever returns properties with an ACTIVE listing.
// Until listing activation is built (Phase 2), this will legitimately return
// zero results — that's expected, not a bug in this file.
export default function Home() {
  const { user } = useAuth();
  const [allProperties, setAllProperties] = useState([]);
  const [coverPhotos, setCoverPhotos] = useState({}); // property_id -> url
  const [ownerProfiles, setOwnerProfiles] = useState({}); // created_by_id -> profile
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("all");
  const [propertyType, setPropertyType] = useState("all");
  const [maxRent, setMaxRent] = useState(2000);
  const [minBedrooms, setMinBedrooms] = useState(0);
  const [minBathrooms, setMinBathrooms] = useState(0);
  const [furnishedOnly, setFurnishedOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [gatedOnly, setGatedOnly] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const props = await zimrent.properties.list({
          city: city !== "all" ? city : undefined,
          property_type: propertyType !== "all" ? propertyType : undefined,
          max_rent: maxRent < 2000 ? maxRent : undefined,
          bedrooms: minBedrooms > 0 ? minBedrooms : undefined,
          furnished: furnishedOnly ? true : undefined,
          gated: gatedOnly ? true : undefined,
          pets_allowed: petsAllowed ? true : undefined,
          limit: 50,
        });
        if (!active) return;
        setAllProperties(props || []);

        const photoEntries = await Promise.all((props || []).map(async (p) => {
          try {
            const media = await zimrent.properties.media(p.id);
            const first = media?.[0];
            return [p.id, first ? zimrent.properties.photoUrl(p.id, first.id) : null];
          } catch { return [p.id, null]; }
        }));
        if (active) setCoverPhotos(Object.fromEntries(photoEntries.filter(([, url]) => url)));

        const ownerIds = [...new Set((props || []).map(p => p.created_by_id).filter(Boolean))];
        const ownerEntries = await Promise.all(ownerIds.map(async (id) => {
          try { return [id, await zimrent.profiles.getByUserId(id)]; } catch { return [id, null]; }
        }));
        if (active) setOwnerProfiles(Object.fromEntries(ownerEntries.filter(([, p]) => p)));
      } catch (e) {
        if (active) setAllProperties([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [city, propertyType, maxRent, minBedrooms, furnishedOnly, gatedOnly, petsAllowed]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const saved = await zimrent.savedProperties.list();
        setSavedIds(new Set((saved || []).map(s => s.property_id)));
      } catch (e) {}
    })();
  }, [user]);

  const toggleSave = async (propertyId) => {
    if (!user) return;
    try {
      if (savedIds.has(propertyId)) {
        await zimrent.savedProperties.unsave(propertyId);
        setSavedIds(prev => { const n = new Set(prev); n.delete(propertyId); return n; });
      } else {
        await zimrent.savedProperties.save(propertyId);
        setSavedIds(prev => new Set(prev).add(propertyId));
      }
    } catch (e) {}
  };

  const filteredResults = useMemo(() => {
    return allProperties.filter(p => {
      if (verifiedOnly && p.verification_status !== "verified") return false;
      if (p.bathrooms < minBathrooms) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${p.title} ${p.suburb} ${p.city}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allProperties, verifiedOnly, minBathrooms, search]);

  const hasActiveFilters = city !== "all" || propertyType !== "all" || maxRent < 2000 || minBedrooms > 0 || minBathrooms > 0 || furnishedOnly || verifiedOnly || gatedOnly || petsAllowed || search;

  const clearFilters = () => {
    setSearch(""); setCity("all"); setPropertyType("all"); setMaxRent(2000); setMinBedrooms(0); setMinBathrooms(0);
    setFurnishedOnly(false); setVerifiedOnly(false); setGatedOnly(false); setPetsAllowed(false);
  };

  return (
    <div className="min-h-screen">
      <div className="relative bg-gradient-to-br from-primary via-primary to-primary/80 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1600')", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="relative px-4 sm:px-8 lg:px-12 pt-12 pb-8 lg:pt-20 lg:pb-12 max-w-7xl mx-auto">
          <div className="max-w-2xl">
            <h1 className="text-3xl lg:text-5xl font-bold font-heading text-white text-balance leading-tight">
              Find your next home in Zimbabwe
            </h1>
            <p className="text-white/80 mt-3 text-base lg:text-lg">
              Verified properties, trusted landlords, and a rental journey that stays inside one platform.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto -mt-6 relative z-10">
        <div className="bg-card rounded-2xl shadow-lg border border-border p-4 lg:p-5">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by suburb, city, or area..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="lg:w-44 h-12">
                <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cities</SelectItem>
                {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={propertyType} onValueChange={setPropertyType}>
              <SelectTrigger className="lg:w-44 h-12">
                <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(PROPERTY_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-12 lg:w-auto" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal className="w-4 h-4 mr-2" /> Filters
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
              <div>
                <Label className="text-xs text-muted-foreground">Max rent: USD {maxRent}</Label>
                <Slider value={[maxRent]} min={50} max={2000} step={50} onValueChange={(v) => setMaxRent(v[0])} className="mt-2" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Min bedrooms</Label>
                <Select value={String(minBedrooms)} onValueChange={(v) => setMinBedrooms(Number(v))}>
                  <SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Any</SelectItem>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                    <SelectItem value="4">4+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Min bathrooms</Label>
                <Select value={String(minBathrooms)} onValueChange={(v) => setMinBathrooms(Number(v))}>
                  <SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Any</SelectItem>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4 col-span-2 lg:col-span-2 flex-wrap">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={furnishedOnly} onChange={(e) => setFurnishedOnly(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                  Furnished only
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                  <ShieldCheck className="w-4 h-4" /> Verified only
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={gatedOnly} onChange={(e) => setGatedOnly(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                  Gated
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={petsAllowed} onChange={(e) => setPetsAllowed(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                  Pets allowed
                </label>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-sm text-primary hover:underline ml-auto flex items-center gap-1">
                    <X className="w-3.5 h-3.5" /> Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto py-8">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-muted-foreground">
            {loading ? "Searching..." : `${filteredResults.length} ${filteredResults.length === 1 ? "property" : "properties"} available`}
          </p>
        </div>
        {loading ? (
          <LoadingState label="Finding available properties..." />
        ) : filteredResults.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No properties match your search"
            description={hasActiveFilters ? "Try adjusting your filters to see more results." : "Check back soon — new listings are added regularly."}
            action={hasActiveFilters && <Button onClick={clearFilters} variant="outline">Clear filters</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in">
            {filteredResults.map(property => (
              <PropertyCard
                key={property.id}
                property={property}
                ownerProfile={ownerProfiles[property.created_by_id]}
                coverPhotoUrl={coverPhotos[property.id]}
                saved={savedIds.has(property.id)}
                onToggleSave={() => toggleSave(property.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: ShieldCheck, title: "Verified properties", desc: "Every listing goes through our property verification process." },
            { icon: Building2, title: "Structured information", desc: "Utilities, security, rules, and costs — clearly laid out, not hidden in text." },
            { icon: Search, title: "Stay on the platform", desc: "Message, view, reserve, and sign — all without leaving Dzimba." }
          ].map((f, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold font-heading">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

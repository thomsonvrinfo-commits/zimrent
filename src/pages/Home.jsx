import { useState, useEffect, useMemo } from "react";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { useProfile } from "@/hooks/useProfile";
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

export default function Home() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [listings, setListings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [ownerProfiles, setOwnerProfiles] = useState({});
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("all");
  const [propertyType, setPropertyType] = useState("all");
  const [maxRent, setMaxRent] = useState(2000);
  const [minBedrooms, setMinBedrooms] = useState(0);
  const [waterSource, setWaterSource] = useState("all");
  const [backupPower, setBackupPower] = useState("all");
  const [furnishedOnly, setFurnishedOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [gatedOnly, setGatedOnly] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [minBathrooms, setMinBathrooms] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const allListings = await zimrent.entities.Listing.filter({ status: "active" }, "-availability_confirmed_at", 60);
        setListings(allListings || []);
        const propIds = [...new Set((allListings || []).map(l => l.data?.property_id).filter(Boolean))];
        const props = await Promise.all(propIds.map(id => zimrent.entities.Property.get(id).catch(() => null)));
        const propMap = {};
        props.forEach(p => { if (p) propMap[p.id] = p; });
        setProperties(propMap);

        // Load owner profiles
        const ownerIds = [...new Set((allListings || []).map(l => l.created_by_id).filter(Boolean))];
        const ownerProfilesData = await Promise.all(ownerIds.map(id => zimrent.entities.Profile.filter({ created_by_id: id }).catch(() => [])));
        const ownerMap = {};
        ownerIds.forEach((id, i) => { if (ownerProfilesData[i]?.[0]) ownerMap[id] = ownerProfilesData[i][0]; });
        setOwnerProfiles(ownerMap);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const saved = await zimrent.entities.SavedProperty.filter({ user_id: user.id });
        setSavedIds(new Set((saved || []).map(s => s.data?.property_id)));
      } catch (e) {}
    })();
  }, [user]);

  const toggleSave = async (propertyId) => {
    if (!user) return;
    try {
      if (savedIds.has(propertyId)) {
        const saved = await zimrent.entities.SavedProperty.filter({ user_id: user.id, property_id: propertyId });
        if (saved[0]) await zimrent.entities.SavedProperty.delete(saved[0].id);
        setSavedIds(prev => { const n = new Set(prev); n.delete(propertyId); return n; });
      } else {
        await zimrent.entities.SavedProperty.create({ user_id: user.id, property_id: propertyId });
        setSavedIds(prev => new Set(prev).add(propertyId));
      }
    } catch (e) {}
  };

  const filteredResults = useMemo(() => {
    return listings.filter(listing => {
      const prop = properties[listing.data?.property_id];
      if (!prop) return false;
      const d = prop.data;
      if (city !== "all" && d.city !== city) return false;
      if (propertyType !== "all" && d.property_type !== propertyType) return false;
      if (listing.data?.monthly_rent > maxRent) return false;
      if (d.bedrooms < minBedrooms) return false;
      if (waterSource !== "all" && d.water_source !== waterSource) return false;
      if (backupPower !== "all" && d.backup_power !== backupPower) return false;
      if (furnishedOnly && !d.furnished) return false;
      if (verifiedOnly && d.verification_status !== "verified") return false;
      if (gatedOnly && !d.gated) return false;
      if (petsAllowed && !d.pets_allowed) return false;
      if (d.bathrooms < minBathrooms) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${d.title} ${d.suburb} ${d.city} ${d.area} ${listing.data?.title}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [listings, properties, city, propertyType, maxRent, minBedrooms, waterSource, backupPower, furnishedOnly, verifiedOnly, search]);

  const hasActiveFilters = city !== "all" || propertyType !== "all" || maxRent < 2000 || minBedrooms > 0 || minBathrooms > 0 || waterSource !== "all" || backupPower !== "all" || furnishedOnly || verifiedOnly || gatedOnly || petsAllowed || search;

  const clearFilters = () => {
    setSearch(""); setCity("all"); setPropertyType("all"); setMaxRent(2000); setMinBedrooms(0); setMinBathrooms(0);
    setWaterSource("all"); setBackupPower("all"); setFurnishedOnly(false); setVerifiedOnly(false); setGatedOnly(false); setPetsAllowed(false);
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
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

      {/* Search bar */}
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
                <Label className="text-xs text-muted-foreground">Water source</Label>
                <Select value={waterSource} onValueChange={setWaterSource}>
                  <SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="borehole">Borehole</SelectItem>
                    <SelectItem value="council">Council</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Backup power</Label>
                <Select value={backupPower} onValueChange={setBackupPower}>
                  <SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="solar">Solar</SelectItem>
                    <SelectItem value="inverter">Inverter</SelectItem>
                    <SelectItem value="generator">Generator</SelectItem>
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
              <div className="flex items-center gap-4 col-span-2 lg:col-span-4 flex-wrap">
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

      {/* Results */}
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
            {filteredResults.map(listing => (
              <PropertyCard
                key={listing.id}
                property={properties[listing.data?.property_id]}
                listing={listing}
                ownerProfile={ownerProfiles[listing.created_by_id]}
                saved={savedIds.has(listing.data?.property_id)}
                onToggleSave={() => toggleSave(listing.data?.property_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Trust banner */}
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
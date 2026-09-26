import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Building2, CheckCircle2, ShieldCheck, FileCheck } from "lucide-react";
import { PROPERTY_TYPES } from "@/lib/rental-utils";
import PhotoUploader from "@/components/PhotoUploader";

const CITIES = ["Harare", "Bulawayo", "Chitungwiza", "Mutare", "Gweru", "Kwekwe", "Kadoma", "Masvingo"];
const SUBURBS = {
  Harare: ["Borrowdale", "Mount Pleasant", "Avondale", "Highlands", "Greendale", "Waterfalls", "Warren Park", "Mbare", "Hatfield", "Tynwald"],
  Bulawayo: ["Hillside", "Suburbs", "Burnside", "Khumalo", "Newtown", "Pelendaba"],
  Chitungwiza: ["Unit A", "Unit B", "Unit C", "Unit D", "Seke", "Zengeza"],
  Mutare: ["Avenues", "Murambi", "Greendale", "Yeovil", "Chikanga"],
  Gweru: ["Senga", "Mkoba", "Riverside", "Southview"],
  Kwekwe: ["Mbizo", "Riverside", "Amaveni"],
  Kadoma: ["Riverside", "Chikangwe", "Ngezi"],
  Masvingo: ["Mucheke", "Rujeko", "Target Kopje", "Eastvale"],
};

// REWRITTEN FROM THE OLD VERSION, and deliberately smaller in scope.
//
// The old 6-step wizard collected many fields — water source, electricity,
// backup power, security guard/CCTV/alarm, nearby landmarks/transport/
// schools, reservation fee, application fee, agent fee, payment frequency,
// max occupancy, subletting — that DO NOT EXIST as columns anywhere in the
// real database (confirmed directly against D1's schema, not just against
// the API contract). Persisting them was never possible even before this
// rewrite; the old code just never surfaced that as an error because it was
// calling a route that didn't exist either.
//
// This version only collects fields the `properties` and `listings` tables
// actually have. Restoring the richer set needs a product decision (new D1
// migrations to add real columns, or — for a few of them — storing structured
// extras as JSON the way profiles.preferences_json already does) before more
// UI is rebuilt on top of them. See PHASE-1-IMPLEMENTATION-NOTES.md.
//
// Flow is also restructured to match how the backend actually works: a
// property must exist before a photo can be attached to it (POST /uploads
// requires property_id), so this is now save details → create property +
// listing → then attach photos, not collect everything then save once.
export default function AddProperty() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: details, 2: pricing & rules, 3: photos & authority (property already created)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdProperty, setCreatedProperty] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploadingAuth, setUploadingAuth] = useState(false);
  const [authorityUploaded, setAuthorityUploaded] = useState(false);
  const [authorityAcknowledged, setAuthorityAcknowledged] = useState(false);

  const [form, setForm] = useState({
    title: "", property_type: "house", city: "Harare", suburb: "", address: "",
    bedrooms: 2, bathrooms: 1, furnished: false, pets_allowed: false, gated: true,
    monthly_rent: 300, deposit: 300, currency: "USD", available_from: "",
    description: "", utilities_included: "", security_features: "", rules: "",
  });
  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const suburbs = SUBURBS[form.city] || [];

  const handleCreateListing = async () => {
    if (!form.title.trim() || !form.suburb.trim()) { setError("Please complete the required fields"); return; }
    if (!form.monthly_rent || form.monthly_rent <= 0) { setError("Monthly rent must be greater than zero"); return; }
    setError("");
    setSaving(true);
    try {
      // Creating a property requires the "listing" capability. It's
      // self-declared with no approval gate — grant it if the user doesn't
      // already have it, rather than sending them somewhere else first.
      try { await zimrent.capabilities.grant("listing"); } catch (e) { /* already granted, or will surface below */ }

      const property = await zimrent.properties.create({
        title: form.title.trim(),
        property_type: form.property_type,
        description: form.description.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim(),
        suburb: form.suburb.trim(),
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        monthly_rent: form.monthly_rent,
        deposit: form.deposit || undefined,
        currency: form.currency,
        furnished: form.furnished,
        pets_allowed: form.pets_allowed,
        gated: form.gated,
        utilities_included: form.utilities_included.trim() || undefined,
        security_features: form.security_features.trim() || undefined,
        rules: form.rules.trim() || undefined,
      });

      // listings.create already inserts as status:'pending_verification' —
      // there is no separate "submit for review" call needed (the old code's
      // functions.invoke("transitionListing", ...) call doesn't correspond
      // to anything real).
      await zimrent.listings.create({
        property_id: property.id,
        available_from: form.available_from || undefined,
      });

      setCreatedProperty(property);
      setStep(3);
    } catch (e) {
      setError(e.message || "Failed to create property");
    } finally {
      setSaving(false);
    }
  };

  const handleAuthorityUpload = async (file) => {
    if (!file || !createdProperty) return;
    setUploadingAuth(true);
    setError("");
    try {
      await zimrent.uploads.upload(file, "document", {
        propertyId: createdProperty.id,
        documentType: "authority",
      });
      setAuthorityUploaded(true);
    } catch (e) {
      setError("Upload failed: " + e.message);
    } finally {
      setUploadingAuth(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate("/my-properties")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to my properties
      </button>
      <h1 className="text-2xl font-bold font-heading mb-1">Add a property</h1>
      <p className="text-muted-foreground text-sm mb-6">Step {step} of 3</p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {step === 1 && (
        <Card className="border-border"><CardContent className="p-5 space-y-4">
          <h2 className="font-semibold font-heading flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" /> Property details</h2>
          <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setField("title", e.target.value)} className="mt-1.5" placeholder="e.g. 3-bedroom house in Borrowdale" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Property type</Label>
              <Select value={form.property_type} onValueChange={(v) => setField("property_type", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PROPERTY_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>City</Label>
              <Select value={form.city} onValueChange={(v) => { setField("city", v); setField("suburb", ""); }}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Suburb *</Label>
              <Select value={form.suburb} onValueChange={(v) => setField("suburb", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select suburb" /></SelectTrigger>
                <SelectContent>{suburbs.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Street address</Label><Input value={form.address} onChange={(e) => setField("address", e.target.value)} className="mt-1.5" placeholder="Optional" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Bedrooms</Label><Input type="number" min="0" value={form.bedrooms} onChange={(e) => setField("bedrooms", Number(e.target.value))} className="mt-1.5" /></div>
            <div><Label>Bathrooms</Label><Input type="number" min="0" value={form.bathrooms} onChange={(e) => setField("bathrooms", Number(e.target.value))} className="mt-1.5" /></div>
          </div>
          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.furnished} onChange={(e) => setField("furnished", e.target.checked)} className="rounded" /> Furnished
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.pets_allowed} onChange={(e) => setField("pets_allowed", e.target.checked)} className="rounded" /> Pets allowed
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.gated} onChange={(e) => setField("gated", e.target.checked)} className="rounded" /> Gated
            </label>
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} className="mt-1.5" rows={4} placeholder="Describe what makes this property special..." /></div>
          <Button onClick={() => (form.title.trim() && form.suburb.trim()) ? setStep(2) : setError("Please complete the required fields")} className="w-full">Continue</Button>
        </CardContent></Card>
      )}

      {step === 2 && (
        <Card className="border-border"><CardContent className="p-5 space-y-4">
          <h2 className="font-semibold font-heading">Pricing &amp; rules</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Monthly rent (USD) *</Label><Input type="number" min="0" value={form.monthly_rent} onChange={(e) => setField("monthly_rent", Number(e.target.value))} className="mt-1.5" /></div>
            <div><Label>Deposit (USD)</Label><Input type="number" min="0" value={form.deposit} onChange={(e) => setField("deposit", Number(e.target.value))} className="mt-1.5" /></div>
          </div>
          <div><Label>Available from</Label><Input type="date" value={form.available_from} onChange={(e) => setField("available_from", e.target.value)} className="mt-1.5" /></div>
          <div><Label>Utilities included</Label><Input value={form.utilities_included} onChange={(e) => setField("utilities_included", e.target.value)} className="mt-1.5" placeholder="e.g. water, refuse collection" /></div>
          <div><Label>Security features</Label><Input value={form.security_features} onChange={(e) => setField("security_features", e.target.value)} className="mt-1.5" placeholder="e.g. CCTV, security guard, alarm" /></div>
          <div><Label>House rules</Label><Textarea value={form.rules} onChange={(e) => setField("rules", e.target.value)} className="mt-1.5" rows={3} placeholder="e.g. no smoking indoors, visitors welcome" /></div>
          <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
            Your listing will be submitted for verification. Once our team approves your property and your authority to list it, it will appear on the marketplace.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
            <Button onClick={handleCreateListing} disabled={saving} className="flex-1">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : "Create & continue"}
            </Button>
          </div>
        </CardContent></Card>
      )}

      {step === 3 && createdProperty && (
        <div className="space-y-4">
          <div className="p-3 bg-success/10 text-success rounded-lg text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Property and listing created — now add photos and authority evidence.
          </div>

          <Card className="border-border"><CardContent className="p-5">
            <PhotoUploader propertyId={createdProperty.id} photos={photos} onChange={setPhotos} />
          </CardContent></Card>

          <Card className="border-border"><CardContent className="p-5 space-y-3">
            <h2 className="font-semibold font-heading flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Authority to list</h2>
            <p className="text-sm text-muted-foreground">Verify your authority to rent this property (ownership or agent mandate). This builds trust and is reviewed by our team.</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={authorityAcknowledged} onChange={(e) => setAuthorityAcknowledged(e.target.checked)} className="rounded" />
              I confirm I have the legal right to list this property for rent
            </label>
            <div>
              <Label className="flex items-center gap-1.5"><FileCheck className="w-4 h-4" /> Upload evidence document (optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Title deed, lease agreement, or agent mandate.</p>
              <input
                type="file" accept=".pdf,.jpg,.jpeg,.png"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer"
                onChange={(e) => e.target.files?.[0] && handleAuthorityUpload(e.target.files[0])}
              />
              {uploadingAuth && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
              {authorityUploaded && <p className="text-xs text-success mt-1">✓ Document uploaded</p>}
            </div>
          </CardContent></Card>

          <Button onClick={() => navigate("/my-properties?published=1")} className="w-full">Done</Button>
        </div>
      )}
    </div>
  );
}

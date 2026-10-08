import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import { PROPERTY_TYPES } from "@/lib/rental-utils";
import PhotoUploader from "@/components/PhotoUploader";

const CITIES = [
  "Harare",
  "Bulawayo",
  "Chitungwiza",
  "Mutare",
  "Gweru",
  "Kwekwe",
  "Kadoma",
  "Masvingo",
];

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

export default function AddProperty() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdProperty, setCreatedProperty] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [authorityFile, setAuthorityFile] = useState(null);
  const [authorityAcknowledged, setAuthorityAcknowledged] = useState(false);

  const [form, setForm] = useState({
    title: "",
    property_type: "house",
    city: "Harare",
    suburb: "",
    address: "",
    bedrooms: 2,
    bathrooms: 1,
    furnished: false,
    pets_allowed: false,
    gated: true,
    monthly_rent: 300,
    deposit: 300,
    currency: "USD",
    available_from: "",
    description: "",
    utilities_included: "",
    security_features: "",
    rules: "",
  });

  const setField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const suburbs = SUBURBS[form.city] || [];

  const createProperty = async () => {
    if (!form.title.trim() || !form.suburb.trim()) {
      setError("Please complete the required fields.");
      return;
    }
    if (!form.monthly_rent || form.monthly_rent <= 0) {
      setError("Monthly rent must be greater than zero.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      try {
        await zimrent.capabilities.grant("listing");
      } catch {
        // Capability may already be granted.
      }

      const property = await zimrent.properties.create({
        title: form.title.trim(),
        property_type: form.property_type,
        description: form.description.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city,
        suburb: form.suburb,
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

      setCreatedProperty(property);
      setStep(3);
    } catch (e) {
      setError(e.message || "Failed to create property.");
    } finally {
      setSaving(false);
    }
  };

  const submitAuthority = async () => {
    if (!createdProperty) return;
    if (!authorityAcknowledged) {
      setError("Please confirm that you have the legal right to list this property.");
      return;
    }
    if (!(authorityFile instanceof File)) {
      setError("Please upload evidence of your authority to list this property.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const document = await zimrent.uploads.upload(
        authorityFile,
        "document",
        {
          propertyId: createdProperty.id,
          documentType: "authority",
        }
      );

      if (!document?.id) {
        throw new Error("Authority evidence upload did not return a document id.");
      }

      await zimrent.propertyAuthority.submit(
        createdProperty.id,
        document.id
      );

      navigate("/my-properties?submitted=1");
    } catch (e) {
      setError(e.message || "Failed to submit authority evidence.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate("/my-properties")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to my properties
      </button>

      <h1 className="text-2xl font-bold font-heading mb-1">Add a property</h1>
      <p className="text-muted-foreground text-sm mb-6">Step {step} of 3</p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {step === 1 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold font-heading flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Property details
            </h2>

            <div>
              <Label>Property title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                className="mt-1.5"
                placeholder="e.g. 3-bedroom house in Borrowdale"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Property type</Label>
                <Select
                  value={form.property_type}
                  onValueChange={(v) => setField("property_type", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROPERTY_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>City</Label>
                <Select
                  value={form.city}
                  onValueChange={(v) => {
                    setField("city", v);
                    setField("suburb", "");
                  }}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIES.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Suburb *</Label>
                <Select
                  value={form.suburb}
                  onValueChange={(v) => setField("suburb", v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select suburb" />
                  </SelectTrigger>
                  <SelectContent>
                    {suburbs.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Street address</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  className="mt-1.5"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bedrooms</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.bedrooms}
                  onChange={(e) => setField("bedrooms", Number(e.target.value))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Bathrooms</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.bathrooms}
                  onChange={(e) => setField("bathrooms", Number(e.target.value))}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="flex gap-4 flex-wrap">
              {[
                ["furnished", "Furnished"],
                ["pets_allowed", "Pets allowed"],
                ["gated", "Gated"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setField(key, e.target.checked)}
                    className="rounded"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                className="mt-1.5"
                rows={4}
                placeholder="Describe what makes this property special..."
              />
            </div>

            <Button
              onClick={() =>
                form.title.trim() && form.suburb.trim()
                  ? setStep(2)
                  : setError("Please complete the required fields.")
              }
              className="w-full"
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold font-heading">Pricing &amp; rules</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monthly rent (USD) *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.monthly_rent}
                  onChange={(e) => setField("monthly_rent", Number(e.target.value))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Deposit (USD)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.deposit}
                  onChange={(e) => setField("deposit", Number(e.target.value))}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label>Available from</Label>
              <Input
                type="date"
                value={form.available_from}
                onChange={(e) => setField("available_from", e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Utilities included</Label>
              <Input
                value={form.utilities_included}
                onChange={(e) => setField("utilities_included", e.target.value)}
                className="mt-1.5"
                placeholder="e.g. water, refuse collection"
              />
            </div>

            <div>
              <Label>Security features</Label>
              <Input
                value={form.security_features}
                onChange={(e) => setField("security_features", e.target.value)}
                className="mt-1.5"
                placeholder="e.g. CCTV, security guard, alarm"
              />
            </div>

            <div>
              <Label>House rules</Label>
              <Textarea
                value={form.rules}
                onChange={(e) => setField("rules", e.target.value)}
                className="mt-1.5"
                rows={3}
                placeholder="e.g. no smoking indoors, visitors welcome"
              />
            </div>

            <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
              Your property and authority evidence will be reviewed separately.
              Once authority is approved, you can create the listing from My Properties.
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={createProperty} disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create property"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && createdProperty && (
        <div className="space-y-4">
          <div className="p-3 bg-success/10 text-success rounded-lg text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Property created. Add photos and submit your authority evidence.
          </div>

          <Card>
            <CardContent className="p-5">
              <PhotoUploader
                propertyId={createdProperty.id}
                photos={photos}
                onChange={setPhotos}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <h2 className="font-semibold font-heading flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Authority to list
              </h2>
              <p className="text-sm text-muted-foreground">
                Upload evidence that you have the legal right to rent this property.
                It will be reviewed by an administrator before you can create a listing.
              </p>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={authorityAcknowledged}
                  onChange={(e) => setAuthorityAcknowledged(e.target.checked)}
                  className="rounded"
                />
                I confirm I have the legal right to list this property for rent
              </label>

              <div>
                <Label className="flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4" />
                  Authority evidence
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Title deed, lease agreement, or agent mandate. Stored privately.
                </p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer"
                  onChange={(e) => setAuthorityFile(e.target.files?.[0] || null)}
                />
                {authorityFile && (
                  <p className="text-xs text-success mt-1">
                    ✓ {authorityFile.name}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
              Back
            </Button>
            <Button onClick={submitAuthority} disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit for verification"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
